"""Core workout builders (bodyweight + mat; the 16kg kettlebell is optional).

Short, sharp core sessions (5–15 min). Most formats are timed stations that run
on the interval timer (no rep-counting needed); AMRAP is rep-based with a round
counter. Moves marked ``kb`` can optionally use the kettlebell.
"""

# label, notes, per_side, hold (isometric), reps (suggested for AMRAP), kb (optional)
CORE_MOVES = {
    "plank": {"label": "Plank", "per_side": False, "hold": True, "reps": "30s",
              "notes": "Shoulders over elbows, straight line head to heels, brace the abs."},
    "side_plank": {"label": "Side Plank", "per_side": True, "hold": True, "reps": "20s",
                   "notes": "Stack the feet, lift the hips, reach the top arm up."},
    "hollow_hold": {"label": "Hollow Hold", "per_side": False, "hold": True, "reps": "20s",
                    "notes": "Low back pressed to the mat, shoulders and legs lifted, arms overhead."},
    "bear_hold": {"label": "Bear Hold", "per_side": False, "hold": True, "reps": "20s",
                  "notes": "On hands and toes, knees hovering 2cm off the floor, flat back."},
    "mountain_climbers": {"label": "Mountain Climbers", "per_side": False, "hold": False, "reps": "30",
                          "notes": "Plank position, drive knees to chest, quick and controlled."},
    "bicycle_crunch": {"label": "Bicycle Crunches", "per_side": False, "hold": False, "reps": "20",
                       "notes": "Opposite elbow to knee, extend the other leg, twist from the core."},
    "dead_bug": {"label": "Dead Bug", "per_side": False, "hold": False, "reps": "12",
                 "notes": "On your back, lower opposite arm and leg, keep the low back down."},
    "bird_dog": {"label": "Bird Dog", "per_side": True, "hold": False, "reps": "10",
                 "notes": "On all fours, extend opposite arm and leg, pause, stay square."},
    "flutter_kicks": {"label": "Flutter Kicks", "per_side": False, "hold": False, "reps": "30",
                      "notes": "Legs straight and low, small fast alternating kicks, low back down."},
    "leg_raises": {"label": "Leg Raises", "per_side": False, "hold": False, "reps": "12",
                   "notes": "Legs straight, lower slowly to hover, lift without arching the back."},
    "reverse_crunch": {"label": "Reverse Crunch", "per_side": False, "hold": False, "reps": "15",
                       "notes": "Knees to chest, curl the hips off the mat, control the lower."},
    "v_up": {"label": "V-Up", "per_side": False, "hold": False, "reps": "10",
             "notes": "Reach hands to feet, lift together into a V, lower with control."},
    "shoulder_taps": {"label": "Plank Shoulder Taps", "per_side": False, "hold": False, "reps": "20",
                      "notes": "High plank, tap opposite shoulder, keep the hips still."},
    "glute_bridge": {"label": "Glute Bridge", "per_side": False, "hold": False, "reps": "15",
                     "notes": "Heels in, drive hips up, squeeze the glutes, brace the abs."},
    "superman": {"label": "Superman", "per_side": False, "hold": False, "reps": "12",
                 "notes": "Face down, lift chest and legs together, squeeze the back, pause."},
    "heel_taps": {"label": "Heel Taps", "per_side": False, "hold": False, "reps": "20",
                  "notes": "Shoulders curled up, reach side to side tapping the heels."},
    "russian_twist": {"label": "Russian Twist", "per_side": False, "hold": False, "reps": "20", "kb": True,
                      "notes": "Lean back, feet up, rotate side to side. Add the 16kg KB to load it."},
    "weighted_situp": {"label": "Weighted Sit-Up", "per_side": False, "hold": False, "reps": "15", "kb": True,
                       "notes": "Full sit-up; hug the KB at your chest for extra load (optional)."},
}

# Volume by energy: scales work, rest and round count.
ENERGY = {
    "fresh": {"work": 1.0, "rest": 1.0, "rounds": 1.0},
    "ok": {"work": 0.9, "rest": 1.15, "rounds": 1.0},
    "wrecked": {"work": 0.75, "rest": 1.4, "rounds": 0.7},
}


def _stations(keys):
    """Expand per-side moves into two stations (right then left)."""
    out = []
    for k in keys:
        if CORE_MOVES[k]["per_side"]:
            out.append((k, "right"))
            out.append((k, "left"))
        else:
            out.append((k, None))
    return out


def _work(key, seconds, side=None):
    m = CORE_MOVES[key]
    label = m["label"] + (f" — {side}" if side else "")
    return {"label": label, "reps": None, "seconds": seconds, "kind": "work",
            "power_pct": None, "notes": m["notes"]}


def _rest(seconds, nxt=""):
    note = f"Up next: {nxt}." if nxt else "Breathe and reset."
    return {"label": "Rest", "reps": None, "seconds": seconds, "kind": "rest",
            "power_pct": None, "notes": note}


def _trim_trailing_rest(blocks):
    while blocks and blocks[-1]["kind"] == "rest":
        blocks.pop()
    return blocks


def build_circuit(keys, duration_min, energy, title, work=35):
    e = ENERGY[energy]
    work_s = max(15, round(work * e["work"]))
    rest_s = max(8, round(15 * e["rest"]))
    round_rest = round(30 * e["rest"])
    stations = _stations(keys)
    per_round = len(stations) * (work_s + rest_s) + round_rest
    rounds = max(1, round((duration_min * 60 * e["rounds"]) / per_round))

    blocks = []
    for r in range(rounds):
        for i, (k, side) in enumerate(stations):
            blocks.append(_work(k, work_s, side))
            nxt = CORE_MOVES[stations[i + 1][0]]["label"] if i + 1 < len(stations) else ""
            blocks.append(_rest(rest_s, nxt))
        if r < rounds - 1:
            blocks.append(_rest(round_rest, "next round"))
    _trim_trailing_rest(blocks)
    return _wrap("CIRCUIT", "interval", duration_min, blocks, title,
                 f"{rounds} round(s) of {len(stations)} core stations — {work_s}s work / {rest_s}s rest.")


def build_holds(keys, duration_min, energy, title):
    """Isometric holds — longer work, short rest."""
    e = ENERGY[energy]
    work_s = max(20, round(45 * e["work"]))
    rest_s = max(10, round(20 * e["rest"]))
    stations = _stations(keys)
    per_round = len(stations) * (work_s + rest_s)
    rounds = max(1, round((duration_min * 60 * e["rounds"]) / per_round))

    blocks = []
    for r in range(rounds):
        for i, (k, side) in enumerate(stations):
            blocks.append(_work(k, work_s, side))
            nxt = CORE_MOVES[stations[i + 1][0]]["label"] if i + 1 < len(stations) else ""
            blocks.append(_rest(rest_s, nxt))
    _trim_trailing_rest(blocks)
    return _wrap("HOLDS", "interval", duration_min, blocks, title,
                 f"Isometric holds — {work_s}s on / {rest_s}s off. Keep breathing through each hold.")


def build_tabata(keys, duration_min, energy, title):
    """20s on / 10s off blocks, one move per 4-minute block."""
    e = ENERGY[energy]
    work_s = max(15, round(20 * e["work"]))
    rest_s = max(8, round(10 * e["rest"]))
    n_blocks = max(1, round(duration_min / 4))
    moves = keys
    blocks = []
    for i in range(n_blocks):
        m = moves[i % len(moves)]
        for _ in range(8):
            blocks.append(_work(m, work_s))
            blocks.append(_rest(rest_s))
        if i < n_blocks - 1:
            blocks.append(_rest(round(45 * e["rest"]), "next move"))
    _trim_trailing_rest(blocks)
    return _wrap("TABATA", "interval", duration_min, blocks, title,
                 f"{n_blocks} Tabata block(s): 8 × {work_s}s all-out / {rest_s}s rest.")


def build_amrap(keys, duration_min, energy, title):
    """Rep-based circuit, as many rounds as possible — uses the round counter."""
    circuit = []
    for k in keys:
        m = CORE_MOVES[k]
        reps = m["reps"] + (" / side" if m["per_side"] else "")
        circuit.append({"label": m["label"], "reps": reps, "seconds": None,
                        "kind": "work", "power_pct": None, "notes": m["notes"]})
    return _wrap("AMRAP", "amrap", duration_min, circuit, title,
                 f"AMRAP — as many rounds as possible in {duration_min} min. "
                 "Move through the circuit, rest as needed, count your rounds.")


def _wrap(fmt, timer, duration_min, blocks, title, summary):
    return {"format": fmt, "timer": timer, "duration_min": duration_min,
            "blocks": blocks, "summary": summary, "title": title}


BUILDERS = {
    "CIRCUIT": build_circuit,
    "HOLDS": build_holds,
    "TABATA": build_tabata,
    "AMRAP": build_amrap,
}
