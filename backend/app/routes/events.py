from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import EventCreate, EventOut
from app.services.calendar import create_event, delete_event, list_events

router = APIRouter(prefix="/api/events", tags=["events"])


@router.get("", response_model=list[EventOut])
def get_events(
    start: datetime | None = None,
    end: datetime | None = None,
    db: Session = Depends(get_db),
):
    return list_events(db, start=start, end=end)


@router.post("", response_model=EventOut, status_code=201)
def post_event(data: EventCreate, db: Session = Depends(get_db)):
    return create_event(db, data)


@router.delete("/{event_id}", status_code=204)
def remove_event(event_id: int, db: Session = Depends(get_db)):
    ok = delete_event(db, event_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Event not found")
