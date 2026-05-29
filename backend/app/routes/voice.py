from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import EventCreate, EventOut, VoiceRequest, VoiceResponse
from app.services import llm
from app.services.calendar import (
    create_event,
    delete_events_by_match,
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


@router.post("", response_model=VoiceResponse)
def handle_voice(req: VoiceRequest, db: Session = Depends(get_db)):
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
        deleted = delete_events_by_match(db, title=title, start=start, end=end)
        return VoiceResponse(
            action=action,
            events=[EventOut.model_validate(e) for e in deleted],
            reply=reply if deleted else "未找到匹配的事件",
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
