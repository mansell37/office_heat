"""Strength workout builders (single 16kg kettlebell + mat).

Each builder takes a list of movement keys + duration + energy and returns a
fully-expanded workout dict in the shared schema. The frontend timer type is
chosen by the ``timer`` field.
"""
from . import movements

# Volume multiplier by energy level — drives reps and round counts.
ENERGY = {
    "fresh": {"reps": 1.0, "rounds": 1.0, "work": 1.0, "rest": 1.0},
    "ok": {"reps": 0.85, "rounds": 1.0, "work": 0.9, "rest": 1.15},
    "wrecked": {"reps": 0.6, "rounds": 0.7, "work": 0.75, "rest": 1.4},
}


def reps_for(key: str, energy: str, intensity: float = 1.0) -> str:
    m = movements.get(key)
    factor = ENERGY[energy]["reps"] * intensity
    scaled = max(1, round(m["base_reps"] * factor))
    low = max(1, round(scaled * 0.8))
    rng = str(scaled) if low >= scaled else f"{low}-{scaled}"
    return rng + (" / side" if m["per_side"] else "")


def _block(key: str, energy: str, seconds=None, kind="work", intensity=1.0):
    m = movements.get(key)
    return {
        "label": m["label"],
        "reps": reps_for(key, energy, intensity) if seconds is None else None,
        "seconds": seconds,
        "notes": m["notes"],
        "kind": kind,
        "power_pct": None,
    }


def build_emom(keys, duration_min, energy, title, intensity=1.0):
    """One movement per minute, cycling through ``keys`` for ``duration_min`` minutes."""
    blocks = []
    for i in range(duration_min):
        key = keys[i % len(keys)]
        b = _block(key, energy, seconds=60, kind="work")
        # Show prescribed reps inside the minute, then rest the remainder.
        b["reps"] = reps_for(key, energy, intensity)
        b["minute"] = i + 1
        blocks.append(b)
    return {
        "format": "EMOM",
        "timer": "emom",
        "duration_min": duration_min,
        "blocks": blocks,
        "summary": (
            f"Every Minute On the Minute for {duration_min} rounds. At the top of each "
            "minute do the prescribed reps, then rest until the next minute."
        ),
        "title": title,
    }


def build_amrap(keys, duration_min, energy, title, intensity=1.0):
    """A fixed circuit repeated for as many rounds as possible within the cap."""
    circuit = [_block(k, energy, intensity=intensity) for k in keys]
    return {
        "format": "AMRAP",
        "timer": "amrap",
        "duration_min": duration_min,
        "blocks": circuit,
        "summary": (
            f"AMRAP — as many rounds as possible in {duration_min} minutes. Move through "
            "the circuit, rest only when you need to, count your rounds."
        ),
        "title": title,
    }


def build_circuit(keys, duration_min, energy, title, intensity=1.0, work=40):
    """Stations of timed work, repeated for as many rounds as the duration allows."""
    e = ENERGY[energy]
    work_s = round(work * e["work"])
    rest_s = round(20 * e["rest"])
    round_rest = round(45 * e["rest"])
    per_round = len(keys) * (work_s + rest_s) + round_rest
    rounds = max(2, round((duration_min * 60 * e["rounds"]) / per_round))

    blocks = []
    for r in range(rounds):
        for k in keys:
            blocks.append(_block(k, energy, seconds=work_s, kind="work"))
            blocks.append({"label": "Transition", "reps": None, "seconds": rest_s,
                           "notes": "Move to the next station.", "kind": "rest", "power_pct": None})
        if r < rounds - 1:
            blocks.append({"label": "Round rest", "reps": None, "seconds": round_rest,
                           "notes": "Catch your breath.", "kind": "rest", "power_pct": None})
    return {
        "format": "CIRCUIT",
        "timer": "interval",
        "duration_min": duration_min,
        "rounds": rounds,
        "blocks": blocks,
        "summary": f"{rounds} rounds of {len(keys)} stations — {work_s}s work / {rest_s}s transition.",
        "title": title,
    }


def build_tabata(keys, duration_min, energy, title, intensity=1.0):
    """4-minute Tabata blocks (8 x 20s work / 10s rest), one movement per block."""
    e = ENERGY[energy]
    n_blocks = max(1, duration_min // 4)
    work_s = round(20 * e["work"])
    rest_s = round(10 * e["rest"])
    blocks = []
    for i in range(n_blocks):
        key = keys[i % len(keys)]
        m = movements.get(key)
        for rnd in range(8):
            blocks.append({"label": m["label"], "reps": "max", "seconds": work_s,
                           "notes": m["notes"], "kind": "work", "power_pct": None})
            blocks.append({"label": "Rest", "reps": None, "seconds": rest_s,
                           "notes": "Breathe.", "kind": "rest", "power_pct": None})
        if i < n_blocks - 1:
            blocks.append({"label": "Block rest", "reps": None, "seconds": round(60 * e["rest"]),
                           "notes": "Recover before the next movement.", "kind": "rest", "power_pct": None})
    return {
        "format": "TABATA",
        "timer": "interval",
        "duration_min": duration_min,
        "blocks": blocks,
        "summary": f"{n_blocks} Tabata block(s): 8 × {work_s}s all-out / {rest_s}s rest.",
        "title": title,
    }


def build_ladder(keys, duration_min, energy, title, intensity=1.0):
    """A descending/ascending rep ladder couplet — rep-based, run with the stopwatch."""
    e = ENERGY[energy]
    top = max(4, round(10 * e["reps"] * intensity))
    a, b = movements.get(keys[0]), movements.get(keys[1])
    blocks = [
        {"label": f"{a['label']} ladder", "reps": f"{top} down to 1",
         "seconds": None, "notes": a["notes"], "kind": "work", "power_pct": None},
        {"label": f"{b['label']} ladder", "reps": f"1 up to {top}",
         "seconds": None, "notes": b["notes"], "kind": "work", "power_pct": None},
    ]
    return {
        "format": "LADDER",
        "timer": "stopwatch",
        "duration_min": duration_min,
        "blocks": blocks,
        "summary": (
            f"Ladder: {a['label']} {top}→1 paired with {b['label']} 1→{top}. "
            f"Do {top} + 1, then {top - 1} + 2, and so on. Use the stopwatch, beat your time."
        ),
        "title": title,
    }


BUILDERS = {
    "EMOM": build_emom,
    "AMRAP": build_amrap,
    "CIRCUIT": build_circuit,
    "TABATA": build_tabata,
    "LADDER": build_ladder,
}
