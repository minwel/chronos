import re
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.event import Event
from app.schemas import EventCreate, EventOut, PendingAction, VoiceRequest, VoiceResponse
from app.services import llm
from app.services.calendar import (
    create_event,
    delete_events,
    find_delete_candidates,
    find_events_by_match,
    list_events,
)

router = APIRouter(prefix="/api/voice", tags=["voice"])


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _event_reply_label(event: EventOut) -> str:
    start = event.start_time.strftime("%m月%d日%H点%M分")
    return f"{start}的{event.title}"


def _pending_delete_response(candidates: list[EventOut], fallback_reply: str) -> VoiceResponse:
    if not candidates:
        return VoiceResponse(action="delete", events=[], reply=fallback_reply)

    if len(candidates) == 1:
        reply = f"没有找到完全匹配的事件，你是要删除{_event_reply_label(candidates[0])}吗？"
    else:
        options = "，还是".join(_event_reply_label(candidate) for candidate in candidates[:3])
        reply = f"找到了{len(candidates)}个可能的事件，你要删除哪个？{options}？"

    return VoiceResponse(action="pending_delete", candidates=candidates, reply=reply)


def _is_negative_answer(text: str) -> bool:
    return any(word in text for word in ("不用", "不是", "不要", "取消", "算了", "否", "不删"))


def _is_positive_answer(text: str) -> bool:
    return any(word in text for word in ("是", "对", "确认", "删除", "删掉", "可以", "嗯"))


def _select_pending_candidate(text: str, pending_action: PendingAction) -> EventOut | None:
    candidates = pending_action.candidates
    if not candidates:
        return None

    ordinal_map = {
        "第一个": 0,
        "第1个": 0,
        "第二个": 1,
        "第2个": 1,
        "第三个": 2,
        "第3个": 2,
    }
    for word, index in ordinal_map.items():
        if word in text and index < len(candidates):
            return candidates[index]

    ordinal_match = re.fullmatch(r"\s*([123一二三])\s*", text)
    if ordinal_match:
        ordinal_indexes = {"1": 0, "一": 0, "2": 1, "二": 1, "3": 2, "三": 2}
        index = ordinal_indexes[ordinal_match.group(1)]
        if index < len(candidates):
            return candidates[index]

    match = re.search(r"(\d{1,2})\s*[点:：]\s*(\d{1,2})?", text)
    if match:
        hour = int(match.group(1))
        minute = int(match.group(2) or 0)
        if ("下午" in text or "晚上" in text) and hour < 12:
            hour += 12
        if "上午" in text and hour == 12:
            hour = 0
        for candidate in candidates:
            if candidate.start_time.hour == hour and candidate.start_time.minute == minute:
                return candidate

    chinese_hours = {
        "零": 0,
        "一": 1,
        "二": 2,
        "两": 2,
        "三": 3,
        "四": 4,
        "五": 5,
        "六": 6,
        "七": 7,
        "八": 8,
        "九": 9,
        "十": 10,
        "十一": 11,
        "十二": 12,
    }
    for word, hour in chinese_hours.items():
        if f"{word}点" not in text:
            continue
        if ("下午" in text or "晚上" in text) and hour < 12:
            hour += 12
        if "上午" in text and hour == 12:
            hour = 0
        for candidate in candidates:
            if candidate.start_time.hour == hour:
                return candidate

    for candidate in candidates:
        if candidate.title and candidate.title in text:
            return candidate

    if len(candidates) == 1 and _is_positive_answer(text):
        return candidates[0]

    return None


def _handle_pending_delete(req: VoiceRequest, db: Session) -> VoiceResponse | None:
    pending_action = req.pending_action
    if not pending_action or pending_action.type != "delete":
        return None

    if _is_negative_answer(req.text):
        return VoiceResponse(action="delete", events=[], reply="好的，已取消删除。")

    selected = _select_pending_candidate(req.text, pending_action)
    if not selected:
        return VoiceResponse(
            action="pending_delete",
            candidates=pending_action.candidates,
            reply="还不能确定要删除哪一个，请说第几个，或说取消。",
        )

    event = db.query(Event).filter(Event.id == selected.id).first()
    if not event:
        return VoiceResponse(action="delete", events=[], reply="这个事件已经不存在了。")

    deleted = EventOut.model_validate(event)
    delete_events(db, [event])
    return VoiceResponse(
        action="delete",
        events=[deleted],
        reply=f"已删除：{deleted.title}",
    )


@router.post("", response_model=VoiceResponse)
def handle_voice(req: VoiceRequest, db: Session = Depends(get_db)):
    pending_response = _handle_pending_delete(req, db)
    if pending_response:
        return pending_response

    try:
        parsed = llm.parse_voice_command(req.text)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM error: {e}")

    action: str = parsed.get("action", "query")
    raw_event: dict | None = parsed.get("event")
    reply: str = parsed.get("reply", "操作完成")

    if action == "add":
        if not raw_event:
            raise HTTPException(status_code=422, detail="LLM returned no event data for add action")
        start = _parse_dt(raw_event.get("start_time"))
        if not start:
            raise HTTPException(status_code=422, detail="Invalid start_time from LLM")
        data = EventCreate(
            title=raw_event.get("title", "未命名事件"),
            start_time=start,
            end_time=_parse_dt(raw_event.get("end_time")),
            description=raw_event.get("description"),
        )
        created = create_event(db, data)
        return VoiceResponse(
            action=action,
            event=EventOut.model_validate(created),
            reply=reply,
        )

    elif action == "delete":
        title = raw_event.get("title") if raw_event else None
        start = _parse_dt(raw_event.get("start_time")) if raw_event else None
        end = _parse_dt(raw_event.get("end_time")) if raw_event else None
        matches = find_events_by_match(db, title=title, start=start, end=end)
        if len(matches) != 1:
            candidates = matches or find_delete_candidates(db, title=title, start=start, end=end)
            return _pending_delete_response(
                [EventOut.model_validate(e) for e in candidates],
                "未找到匹配的事件",
            )

        deleted = [EventOut.model_validate(matches[0])]
        delete_events(db, matches)
        return VoiceResponse(
            action=action,
            events=deleted,
            reply=reply,
        )

    else:  # query
        start = _parse_dt(raw_event.get("start_time")) if raw_event else None
        end = _parse_dt(raw_event.get("end_time")) if raw_event else None
        results = list_events(db, start=start, end=end)
        return VoiceResponse(
            action=action,
            events=[EventOut.model_validate(e) for e in results],
            reply=reply,
        )
