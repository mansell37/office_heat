"""Curated workout library + the top-level ``generate`` dispatcher.

Each template names a format and (for strength) a movement set. The builders in
``strength.py`` / ``cardio.py`` scale that template to the requested duration and
energy level, so a handful of templates cover every time/energy combination.
"""
import random

from . import cardio, strength

STRENGTH_TEMPLATES = [
    {"key": "emom_engine", "title": "16kg EMOM Engine", "format": "EMOM",
     "keys": ["goblet_squat", "two_hand_swing", "floor_press", "bent_over_row"],
     "blurb": "Balanced full-body EMOM — squat, swing, press, row on rotation."},
    {"key": "swing_snatch_emom", "title": "Swing & Snatch EMOM", "format": "EMOM",
     "keys": ["two_hand_swing", "high_pull", "snatch", "goblet_squat"],
     "blurb": "Cardio-leaning EMOM built around ballistic hip power."},
    {"key": "full_body_amrap", "title": "Full-Body AMRAP", "format": "AMRAP",
     "keys": ["clean_and_press", "reverse_lunge", "bent_over_row", "two_hand_swing"],
     "blurb": "One circuit, as many rounds as possible. Count and chase rounds."},
    {"key": "push_pull_circuit", "title": "Push / Pull Circuit", "format": "CIRCUIT",
     "keys": ["floor_press", "bent_over_row", "push_press", "halo"],
     "blurb": "Upper-body timed stations, work/rest intervals."},
    {"key": "grind_strength", "title": "Grind Strength", "format": "CIRCUIT",
     "keys": ["romanian_deadlift", "goblet_squat", "clean_and_press", "single_leg_deadlift"],
     "blurb": "Slower, heavier-feeling strength circuit — control every rep."},
    {"key": "tabata_torch", "title": "Tabata Torch", "format": "TABATA",
     "keys": ["two_hand_swing", "goblet_squat", "high_pull"],
     "blurb": "20s on / 10s off all-out blocks. Quick and brutal."},
    {"key": "core_conditioning", "title": "Core & Conditioning", "format": "CIRCUIT",
     "keys": ["two_hand_swing", "russian_twist", "around_the_world", "weighted_situp"],
     "blurb": "Midline-focused circuit with a conditioning kicker."},
    {"key": "swing_squat_ladder", "title": "Swing & Squat Ladder", "format": "LADDER",
     "keys": ["two_hand_swing", "goblet_squat"],
     "blurb": "Descending/ascending rep ladder. Beat the clock."},
    {"key": "getup_grind", "title": "Get-Up Grind", "format": "CIRCUIT",
     "keys": ["turkish_get_up", "goblet_squat", "floor_press", "two_hand_swing"],
     "blurb": "Skill + strength circuit anchored by the Turkish get-up."},
]

CARDIO_TEMPLATES = [
    {"key": "endurance_spin", "title": "Endurance Spin", "format": "ENDURANCE",
     "blurb": "Steady Zone 2 aerobic base with a couple of tempo lifts."},
    {"key": "sweet_spot", "title": "Sweet Spot Builder", "format": "SWEETSPOT",
     "blurb": "~90% FTP efforts — the best maintenance bang for your buck."},
    {"key": "threshold", "title": "Threshold Blocks", "format": "THRESHOLD",
     "blurb": "Sustained efforts right at FTP to hold your top end."},
    {"key": "vo2", "title": "VO2 Sharpener", "format": "VO2",
     "blurb": "Short, sharp 3-min efforts above threshold."},
    {"key": "pyramid", "title": "Power Pyramid", "format": "PYRAMID",
     "blurb": "Climb from endurance to threshold and back down."},
    {"key": "recovery", "title": "Recovery Spin", "format": "RECOVERY",
     "blurb": "Gentle flush — perfect for a wrecked-sleep day."},
]


def list_templates():
    return {
        "strength": [{"key": t["key"], "title": t["title"], "format": t["format"],
                      "blurb": t["blurb"]} for t in STRENGTH_TEMPLATES],
        "cardio": [{"key": t["key"], "title": t["title"], "format": t["format"],
                    "blurb": t["blurb"]} for t in CARDIO_TEMPLATES],
    }


def _pick(templates, fmt, key=None):
    if key:
        match = [t for t in templates if t["key"] == key]
        if match:
            return match[0]
    if fmt:
        pool = [t for t in templates if t["format"] == fmt]
        if pool:
            return random.choice(pool)
    return random.choice(templates)


def generate(wtype, duration_min, energy, fmt=None, ftp=200, key=None, intensity=1.0):
    """Build a scaled workout for the given type/duration/energy.

    ``intensity`` (strength only) nudges rep volume based on recent difficulty
    reviews — >1 makes it harder, <1 easier.
    """
    if wtype == "strength":
        t = _pick(STRENGTH_TEMPLATES, fmt, key)
        wk = strength.BUILDERS[t["format"]](t["keys"], duration_min, energy, t["title"], intensity)
    else:
        templates = CARDIO_TEMPLATES
        # On a wrecked day with no specific ask, steer toward easy rides.
        if fmt is None and key is None and energy == "wrecked":
            templates = [t for t in CARDIO_TEMPLATES if t["format"] in ("RECOVERY", "ENDURANCE")]
        t = _pick(templates, fmt, key)
        wk = cardio.BUILDERS[t["format"]](duration_min, energy, ftp, t["title"])

    wk.update({"type": wtype, "energy": energy, "source": "template", "template_key": t["key"]})
    return wk
