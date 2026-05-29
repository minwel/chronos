from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.models.event import Event
from app.schemas import EventCreate


def create_event(db: Session, data: EventCreate) -> Event:
    event = Event(
        title=data.title,
        start_time=data.start_time,
        end_time=data.end_time,
        description=data.description,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def list_events(
    db: Session,
    start: datetime | None = None,
    end: datetime | None = None,
) -> list[Event]:
    query = db.query(Event)
    if start:
        query = query.filter(Event.start_time >= start)
    if end:
        query = query.filter(Event.start_time <= end)
    return query.order_by(Event.start_time).all()


def get_event(db: Session, event_id: int) -> Event | None:
    return db.query(Event).filter(Event.id == event_id).first()


def delete_event(db: Session, event_id: int) -> bool:
    event = get_event(db, event_id)
    if not event:
        return False
    db.delete(event)
    db.commit()
    return True


def delete_events_by_match(
    db: Session,
    title: str | None,
    start: datetime | None,
    end: datetime | None,
) -> list[Event]:
    """按标题（模糊）和时间范围匹配删除事件，返回被删除的事件列表。"""
    events = find_events_by_match(db, title=title, start=start, end=end)
    delete_events(db, events)
    return events


def find_events_by_match(
    db: Session,
    title: str | None,
    start: datetime | None,
    end: datetime | None,
) -> list[Event]:
    """按标题（模糊）和时间范围匹配事件，不执行删除。"""
    query = db.query(Event)
    if title:
        query = query.filter(Event.title.contains(title))
    if start:
        query = query.filter(Event.start_time >= start)
    if end:
        query = query.filter(Event.start_time <= end)
    return query.order_by(Event.start_time).all()


def find_delete_candidates(
    db: Session,
    title: str | None,
    start: datetime | None,
    end: datetime | None,
    limit: int = 5,
) -> list[Event]:
    """查找删除反问候选：优先标题相似，其次时间前后 30 分钟。"""
    seen: set[int] = set()
    candidates: list[Event] = []

    def add_events(events: list[Event]) -> None:
        for event in events:
            if event.id in seen:
                continue
            seen.add(event.id)
            candidates.append(event)

    if title:
        add_events(
            db.query(Event)
            .filter(Event.title.contains(title))
            .order_by(Event.start_time)
            .limit(limit)
            .all()
        )

    if start and len(candidates) < limit:
        window_start = start - timedelta(minutes=30)
        window_end = (end or start) + timedelta(minutes=30)
        add_events(
            db.query(Event)
            .filter(Event.start_time >= window_start, Event.start_time <= window_end)
            .order_by(Event.start_time)
            .limit(limit)
            .all()
        )

    return candidates[:limit]


def delete_events(db: Session, events: list[Event]) -> None:
    for event in events:
        db.delete(event)
    db.commit()
