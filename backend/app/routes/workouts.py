"""Generate / save / rate / history endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc
from sqlalchemy.orm import Session

from .. import ai
from ..auth import require_auth
from ..config import ANTHROPIC_API_KEY
from ..db import get_db
from ..generators import generate, list_templates
from ..models import Settings, Workout, WorkoutSession
from ..schemas import (
    GenerateRequest,
    LogSessionRequest,
    RateRequest,
    SaveWorkoutRequest,
)

router = APIRouter(prefix="/api", tags=["workouts"], dependencies=[Depends(require_auth)])


def _ftp(db: Session) -> int:
    s = db.get(Settings, 1)
    return s.ftp if s else 200


# How much each difficulty rating nudges future strength volume.
_DIFF_DELTA = {"too_easy": 0.10, "easy": 0.05, "right": 0.0, "hard": -0.05, "too_hard": -0.10}


def _strength_intensity(db: Session) -> float:
    """Derive a rep-volume multiplier from recent strength difficulty reviews.

    Recent 'too easy' ratings push volume up, 'too hard' pulls it down, so the
    next workout adapts to how the last few actually felt.
    """
    rows = (db.query(WorkoutSession)
            .filter(WorkoutSession.type == "strength",
                    WorkoutSession.difficulty.isnot(None))
            .order_by(desc(WorkoutSession.completed_at))
            .limit(3).all())
    deltas = [_DIFF_DELTA.get(r.difficulty, 0.0) for r in rows]
    if not deltas:
        return 1.0
    adj = sum(deltas) / len(deltas)
    return max(0.8, min(1.25, 1.0 + adj))


@router.get("/templates")
def templates():
    return list_templates()


@router.get("/ai/status")
def ai_status():
    # Lets the UI disable the ✨ AI button when no key is set (avoids a silent fallback).
    return {"configured": bool(ANTHROPIC_API_KEY)}


@router.get("/quiz")
def quiz():
    # Fresh AI trivia when a key is set; otherwise the frontend uses its local bank.
    try:
        return {"questions": ai.generate_quiz(), "source": "ai"}
    except Exception:
        return {"questions": [], "source": "none"}


@router.post("/generate")
def generate_workout(req: GenerateRequest, db: Session = Depends(get_db)):
    # Per-workout FTP override (e.g. a different rider) falls back to the saved default.
    ftp = req.ftp or _ftp(db)
    # Strength volume adapts to recent difficulty reviews; cardio adapts via FTP.
    intensity = _strength_intensity(db) if req.type == "strength" else 1.0
    # Yoga always uses the curated library (the AI path can't supply pose images).
    if req.use_ai and req.type != "yoga":
        try:
            return ai.generate_ai(req.type, req.duration_min, req.energy, ftp)
        except Exception as e:  # fall back to the library so the user always gets a workout
            wk = generate(req.type, req.duration_min, req.energy, req.format, ftp, intensity=intensity)
            wk["ai_error"] = str(e)
            return wk
    return generate(req.type, req.duration_min, req.energy, req.format, ftp, intensity=intensity)


@router.get("/workouts")
def list_workouts(type: str | None = None, favorite: bool | None = None,
                  db: Session = Depends(get_db)):
    q = db.query(Workout)
    if type:
        q = q.filter(Workout.type == type)
    if favorite is not None:
        q = q.filter(Workout.favorite == favorite)
    return [w.to_dict() for w in q.order_by(desc(Workout.created_at)).all()]


@router.post("/workouts")
def save_workout(req: SaveWorkoutRequest, db: Session = Depends(get_db)):
    w = req.workout
    row = Workout(
        type=w.get("type", "strength"),
        format=w.get("format", "CIRCUIT"),
        title=w.get("title", "Workout"),
        duration_min=w.get("duration_min", 0),
        energy=w.get("energy", "ok"),
        source=w.get("source", "template"),
        structure=w,
        rating=req.rating,
        favorite=req.favorite,
        notes=req.notes,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row.to_dict()


@router.get("/workouts/{wid}")
def get_workout(wid: int, db: Session = Depends(get_db)):
    row = db.get(Workout, wid)
    if not row:
        raise HTTPException(404, "Workout not found")
    return row.to_dict()


@router.patch("/workouts/{wid}")
def rate_workout(wid: int, req: RateRequest, db: Session = Depends(get_db)):
    row = db.get(Workout, wid)
    if not row:
        raise HTTPException(404, "Workout not found")
    if req.rating is not None:
        row.rating = req.rating
    if req.favorite is not None:
        row.favorite = req.favorite
    if req.notes is not None:
        row.notes = req.notes
    db.commit()
    db.refresh(row)
    return row.to_dict()


@router.delete("/workouts/{wid}")
def delete_workout(wid: int, db: Session = Depends(get_db)):
    row = db.get(Workout, wid)
    if not row:
        raise HTTPException(404, "Workout not found")
    db.delete(row)
    db.commit()
    return {"deleted": wid}


@router.post("/sessions")
def log_session(req: LogSessionRequest, db: Session = Depends(get_db)):
    w = req.workout
    row = WorkoutSession(
        workout_id=req.workout_id,
        title=w.get("title", "Workout"),
        type=w.get("type", "strength"),
        format=w.get("format", "CIRCUIT"),
        energy=w.get("energy", "ok"),
        duration_planned_min=w.get("duration_min"),
        duration_actual_sec=req.duration_actual_sec,
        rating=req.rating,
        difficulty=req.difficulty,
        notes=req.notes,
        structure=w,
    )
    db.add(row)
    # Bump the saved workout's done counter if linked.
    if req.workout_id:
        wk = db.get(Workout, req.workout_id)
        if wk:
            wk.times_done = (wk.times_done or 0) + 1
            if req.rating:
                wk.rating = req.rating
    db.commit()
    db.refresh(row)
    return row.to_dict()


@router.get("/sessions")
def list_sessions(limit: int = 50, db: Session = Depends(get_db)):
    rows = (db.query(WorkoutSession)
            .order_by(desc(WorkoutSession.completed_at)).limit(limit).all())
    return [r.to_dict() for r in rows]
