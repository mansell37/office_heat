"""Pydantic request/response models."""
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

Energy = Literal["fresh", "ok", "wrecked"]
WorkoutType = Literal["strength", "cardio", "yoga"]


class LoginRequest(BaseModel):
    password: str


class GenerateRequest(BaseModel):
    type: WorkoutType
    duration_min: int = Field(ge=5, le=120)
    energy: Energy = "ok"
    format: Optional[str] = None       # optional: request a specific format
    use_ai: bool = False               # use Claude instead of the curated library
    ftp: Optional[int] = Field(default=None, ge=50, le=600)  # per-workout rider FTP override


class Block(BaseModel):
    label: str
    reps: Optional[str] = None
    seconds: Optional[int] = None
    power_pct: Optional[int] = None
    notes: Optional[str] = None
    kind: Optional[str] = None         # work | rest | warmup | cooldown (cardio)
    sanskrit: Optional[str] = None     # yoga: pose name
    image: Optional[str] = None        # yoga: illustration URL
    benefits: Optional[str] = None     # yoga: what the pose does


class WorkoutOut(BaseModel):
    type: WorkoutType
    title: str
    format: str
    duration_min: int
    energy: Energy
    source: Literal["template", "ai"]
    blocks: list[Block]
    summary: Optional[str] = None


class SaveWorkoutRequest(BaseModel):
    workout: dict[str, Any]
    rating: Optional[Literal["like", "dislike"]] = None
    favorite: bool = False
    notes: Optional[str] = None


class RateRequest(BaseModel):
    rating: Optional[Literal["like", "dislike"]] = None
    favorite: Optional[bool] = None
    notes: Optional[str] = None


Difficulty = Literal["too_easy", "easy", "right", "hard", "too_hard"]


class LogSessionRequest(BaseModel):
    workout: dict[str, Any]
    workout_id: Optional[int] = None
    duration_actual_sec: Optional[int] = None
    rating: Optional[Literal["like", "dislike"]] = None
    difficulty: Optional[Difficulty] = None
    notes: Optional[str] = None


class SettingsUpdate(BaseModel):
    ftp: Optional[int] = Field(default=None, ge=50, le=600)
    default_energy: Optional[Energy] = None
    prefs: Optional[dict[str, Any]] = None


class GarminUploadRequest(BaseModel):
    workout: dict[str, Any]
    date: Optional[str] = None          # YYYY-MM-DD, defaults to today
