"""Optional Claude-powered workout generation (server-side only).

Produces a workout in the SAME schema as the curated builders so the frontend
timer and the Garmin uploader work identically whether the source is a template
or the AI.
"""
import json

from .config import ANTHROPIC_API_KEY, ANTHROPIC_MODEL

_SCHEMA_HINT = """
Return ONLY a JSON object (no prose, no markdown fences) with this shape:

{
  "title": "short punchy name",
  "format": "EMOM | AMRAP | CIRCUIT | TABATA | LADDER" (strength)
            or "ENDURANCE | SWEETSPOT | THRESHOLD | VO2 | PYRAMID | RECOVERY" (cardio),
  "timer": "emom | amrap | interval | stopwatch",
  "summary": "1-2 sentence how-to",
  "blocks": [
    {
      "label": "movement or interval name",
      "reps": "8-10 / side"  (strength, omit for timed cardio),
      "seconds": 60          (duration of this block; required for interval/emom/cardio),
      "power_pct": 90        (cardio only: percent of FTP),
      "kind": "work | rest | warmup | cooldown",
      "notes": "short cue"
    }
  ]
}
"""


def _system_prompt(wtype, duration_min, energy, ftp):
    if wtype == "strength":
        equip = ("ONE 16kg kettlebell and a yoga mat only. No other weights. "
                 "Single-bell movements only (goblet squat, swings, clean & press, "
                 "floor press, rows, snatch, get-ups, etc.).")
        timer = "Use timer 'emom' for EMOM, 'interval' for circuits/tabata, 'stopwatch' for ladders/AMRAP-for-time."
        power = ""
    else:
        equip = "A bike on a Wahoo smart trainer. Prescribe efforts as % of FTP."
        timer = "Use timer 'interval'. Every block needs seconds, power_pct and kind (warmup/work/rest/cooldown)."
        power = f" The athlete's FTP is {ftp}W."
    energy_note = {
        "fresh": "Athlete is well-rested — full prescribed volume/intensity.",
        "ok": "Athlete is okay — moderate, sustainable volume.",
        "wrecked": "Athlete had bad sleep (newborn). Keep it SHORT and EASY, generous rest, lower intensity.",
    }[energy]
    return (
        f"You are a strength & conditioning coach writing a {duration_min}-minute "
        f"{wtype} maintenance workout. Equipment: {equip}{power} {energy_note} {timer} "
        f"Total work should fit roughly {duration_min} minutes. {_SCHEMA_HINT}"
    )


def _extract_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        if text.startswith("json"):
            text = text[4:]
    start, end = text.find("{"), text.rfind("}")
    return json.loads(text[start:end + 1])


def generate_ai(wtype, duration_min, energy, ftp=200):
    if not ANTHROPIC_API_KEY:
        raise RuntimeError("ANTHROPIC_API_KEY is not set — AI generation is unavailable.")

    # Imported lazily so the app boots even if the SDK/key is absent.
    from anthropic import Anthropic

    client = Anthropic(api_key=ANTHROPIC_API_KEY)
    msg = client.messages.create(
        model=ANTHROPIC_MODEL,
        # A full workout (warm-up + many intervals + cool-down, each with notes)
        # can run well past 1.5k tokens; too small a cap truncates the JSON mid-object
        # and the parse fails. 16k is the safe non-streaming default for this model.
        max_tokens=16000,
        system=_system_prompt(wtype, duration_min, energy, ftp),
        messages=[{"role": "user",
                   "content": f"Generate the {duration_min}-minute {wtype} workout now. JSON only."}],
    )
    # If we hit the token ceiling the JSON is incomplete — surface a clear reason
    # rather than a downstream "Expecting ',' delimiter" parse error.
    if msg.stop_reason == "max_tokens":
        raise RuntimeError("AI response was cut off (hit the token limit) — try again.")
    data = _extract_json("".join(b.text for b in msg.content if b.type == "text"))

    # Normalise / fill required fields and compute watts for cardio.
    data.setdefault("timer", "interval" if wtype == "cardio" else "stopwatch")
    blocks = data.get("blocks", [])
    for b in blocks:
        b.setdefault("reps", None)
        b.setdefault("seconds", None)
        b.setdefault("power_pct", None)
        b.setdefault("notes", "")
        b.setdefault("kind", "work")
        if wtype == "cardio" and b.get("power_pct"):
            b["watts"] = round(ftp * b["power_pct"] / 100)
    data.update({
        "type": wtype,
        "energy": energy,
        "duration_min": duration_min,
        "source": "ai",
        "blocks": blocks,
    })
    return data
