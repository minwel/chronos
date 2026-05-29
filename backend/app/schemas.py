from datetime import datetime

from pydantic import BaseModel


class EventCreate(BaseModel):
    title: str
    start_time: datetime
    end_time: datetime | None = None
    description: str | None = None


class EventOut(BaseModel):
    id: int
    title: str
    start_time: datetime
    end_time: datetime | None = None
    description: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class VoiceRequest(BaseModel):
    text: str


class VoiceResponse(BaseModel):
    action: str
    event: EventOut | None = None
    events: list[EventOut] | None = None
    reply: str
