import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.models import Event  # noqa: F401 — ensure model is registered before create_all
from app.routes import events, voice

load_dotenv()

app = FastAPI(
    title="Chronos API",
    description="Voice-first calendar management backend.",
    version="0.1.0",
)


def _get_cors_origins() -> list[str]:
    origins = os.getenv("CORS_ORIGINS", "http://localhost:5173")
    return [origin.strip() for origin in origins.split(",") if origin.strip()]


app.add_middleware(
    CORSMiddleware,
    allow_origins=_get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(events.router)
app.include_router(voice.router)


@app.on_event("startup")
def create_tables():
    Base.metadata.create_all(bind=engine)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
