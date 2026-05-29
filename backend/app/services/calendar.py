from datetime import datetime

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
    query = db.query(Event)
    if title:
        query = query.filter(Event.title.contains(title))
    if start:
        query = query.filter(Event.start_time >= start)
    if end:
        query = query.filter(Event.start_time <= end)
    events = query.all()
    for event in events:
        db.delete(event)
    db.commit()
    return events
