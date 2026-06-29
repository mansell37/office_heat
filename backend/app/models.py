"""Database models. JSON columns work on both SQLite (local) and Postgres (Railway)."""
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Integer,
    JSON,
    String,
    Text,
)

from .config import DEFAULT_FTP
from .db import Base, SessionLocal


def _now():
    return datetime.now(timezone.utc)


class Workout(Base):
    """A saved workout (generated then kept by the user), with its rating."""

    __tablename__ = "workouts"

    id = Column(Integer, primary_key=True)
    type = Column(String(16), nullable=False)        # strength | cardio
    format = Column(String(24), nullable=False)      # EMOM, AMRAP, SWEETSPOT, ...
    title = Column(String(120), nullable=False)
    duration_min = Column(Integer, nullable=False)
    energy = Column(String(12), nullable=False)      # fresh | ok | wrecked
    source = Column(String(12), nullable=False)      # template | ai
    structure = Column(JSON, nullable=False)         # full workout JSON (blocks etc.)
    rating = Column(String(8), nullable=True)        # like | dislike | None
    favorite = Column(Boolean, default=False)
    times_done = Column(Integer, default=0)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_now)

    def to_dict(self):
        return {
            "id": self.id,
            "type": self.type,
            "format": self.format,
            "title": self.title,
            "duration_min": self.duration_min,
            "energy": self.energy,
            "source": self.source,
            "structure": self.structure,
            "rating": self.rating,
            "favorite": self.favorite,
            "times_done": self.times_done,
            "notes": self.notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class WorkoutSession(Base):
    """A completed session logged from the timer (history)."""

    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True)
    workout_id = Column(Integer, nullable=True)      # optional link to saved Workout
    title = Column(String(120), nullable=False)
    type = Column(String(16), nullable=False)
    format = Column(String(24), nullable=False)
    energy = Column(String(12), nullable=False)
    duration_planned_min = Column(Integer, nullable=True)
    duration_actual_sec = Column(Integer, nullable=True)
    rating = Column(String(8), nullable=True)        # like | dislike | None
    # Post-workout difficulty review: too_easy | easy | right | hard | too_hard
    difficulty = Column(String(12), nullable=True)
    notes = Column(Text, nullable=True)
    structure = Column(JSON, nullable=True)          # snapshot of what was done
    completed_at = Column(DateTime, default=_now)

    def to_dict(self):
        return {
            "id": self.id,
            "workout_id": self.workout_id,
            "title": self.title,
            "type": self.type,
            "format": self.format,
            "energy": self.energy,
            "duration_planned_min": self.duration_planned_min,
            "duration_actual_sec": self.duration_actual_sec,
            "rating": self.rating,
            "difficulty": self.difficulty,
            "notes": self.notes,
            "structure": self.structure,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }


class Settings(Base):
    """Singleton settings row (id=1)."""

    __tablename__ = "settings"

    id = Column(Integer, primary_key=True)
    ftp = Column(Integer, default=DEFAULT_FTP)
    default_energy = Column(String(12), default="ok")
    prefs = Column(JSON, default=dict)

    def to_dict(self):
        return {
            "ftp": self.ftp,
            "default_energy": self.default_energy,
            "prefs": self.prefs or {},
        }


class GarminToken(Base):
    """Cached Garmin auth session (id=1) so we avoid re-login each request."""

    __tablename__ = "garmin_token"

    id = Column(Integer, primary_key=True)
    token_json = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=_now, onupdate=_now)


def ensure_default_settings():
    """Insert the singleton settings row if missing."""
    db = SessionLocal()
    try:
        if db.get(Settings, 1) is None:
            db.add(Settings(id=1, ftp=DEFAULT_FTP, default_energy="ok", prefs={}))
            db.commit()
    finally:
        db.close()
