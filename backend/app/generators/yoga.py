"""Yoga flow builders (mat only).

Assembles a guided sequence — warm-up → main flow → cool-down — where each block
is a held pose with its breathing cue, Sanskrit name and an illustration. Runs on
the same interval timer as the bike workouts, so holds are timed and cued.

Pose data + images come from ``yoga_poses.POSES`` (see that file's credit note).
"""
from .yoga_poses import POSES

# Hold-length multiplier by energy. Wrecked = slower, longer, more restorative.
HOLD_MULT = {"fresh": 0.9, "ok": 1.0, "wrecked": 1.3}

# Main-flow pose order per style. Warm-up and cool-down are shared.
WARMUP = ["cat_cow", "child", "downdog"]
COOLDOWN = ["twist", "seated_fold", "child", "corpse"]

MAIN = {
    # Balanced full-body flow.
    "FLOW": ["forward_fold", "low_lunge", "warrior1", "warrior2", "triangle",
             "tree", "chair", "plank", "sphinx", "bridge", "boat",
             "butterfly", "pigeon", "garland", "seated_fold"],
    # Slow and restorative — minimal standing, longer holds, hip/forward folds.
    "GENTLE": ["forward_fold", "low_lunge", "butterfly", "sphinx", "bridge",
               "seated_fold", "pigeon", "garland"],
    # Stronger core/standing emphasis.
    "CORE": ["chair", "plank", "boat", "low_lunge", "warrior2", "bridge",
             "sphinx", "up_dog", "plank", "tree"],
}

STYLE_TITLE = {
    "FLOW": "Full-Body Flow",
    "GENTLE": "Gentle Restorative",
    "CORE": "Core & Strength Flow",
}


def _hold(key, f, gentle=False):
    base = POSES[key]["hold"] * f * (1.2 if gentle else 1.0)
    return max(15, min(120, round(base / 5) * 5))  # tidy 5s steps


def _pose_blocks(key, f, kind="work", gentle=False):
    """One block, or two (right/left) for one-sided poses."""
    p = POSES[key]
    secs = _hold(key, f, gentle)
    base = {
        "sanskrit": p["sanskrit"],
        "image": p["image"],
        "benefits": p["benefits"],
        "reps": None,
        "power_pct": None,
        "watts": None,
        "kind": kind,
    }
    if p["per_side"]:
        return [
            {**base, "label": f"{p['label']} — right", "seconds": secs,
             "notes": p["cue"] + " (right side)"},
            {**base, "label": f"{p['label']} — left", "seconds": secs,
             "notes": p["cue"] + " (left side)"},
        ]
    return [{**base, "label": p["label"], "seconds": secs, "notes": p["cue"]}]


def build_flow(duration_min, energy, title, style="FLOW"):
    f = HOLD_MULT[energy]
    gentle = style == "GENTLE"
    target = duration_min * 60
    blocks = []

    for k in WARMUP:
        blocks += _pose_blocks(k, f, kind="warmup", gentle=gentle)

    cooldown_blocks = []
    for k in COOLDOWN:
        cooldown_blocks += _pose_blocks(k, f, kind="cooldown", gentle=gentle)
    cd_secs = sum(b["seconds"] for b in cooldown_blocks)

    # Fill the middle by cycling the style's main sequence until we're near the
    # target (leaving room for the cool-down). Long sessions loop the flow again.
    order = MAIN[style]
    used = sum(b["seconds"] for b in blocks)
    i = 0
    while used < target - cd_secs and i < 60:
        new = _pose_blocks(order[i % len(order)], f, gentle=gentle)
        blocks += new
        used += sum(b["seconds"] for b in new)
        i += 1

    blocks += cooldown_blocks

    total_min = round(sum(b["seconds"] for b in blocks) / 60)
    return {
        "format": style,
        "timer": "interval",
        "duration_min": duration_min,
        "blocks": blocks,
        "summary": (
            f"A {total_min}-minute mat flow: warm-up, {STYLE_TITLE[style].lower()}, then a "
            "wind-down to rest. Move with your breath and ease off anything that pinches."
        ),
        "title": title,
    }


def build_FLOW(keys, duration_min, energy, title, intensity=1.0):
    return build_flow(duration_min, energy, title, "FLOW")


def build_GENTLE(keys, duration_min, energy, title, intensity=1.0):
    return build_flow(duration_min, energy, title, "GENTLE")


def build_CORE(keys, duration_min, energy, title, intensity=1.0):
    return build_flow(duration_min, energy, title, "CORE")


BUILDERS = {"FLOW": build_FLOW, "GENTLE": build_GENTLE, "CORE": build_CORE}
