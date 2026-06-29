import { useState } from "react";
import { api } from "../api";
import type { Block, Workout } from "../types";
import Timer from "./Timer";

function blockRight(b: Block) {
  if (b.watts != null) {
    return (
      <div className="b-right">
        <div className="b-reps">{b.watts}W</div>
        <div className="b-sub">{b.power_pct}% · {fmtSec(b.seconds)}</div>
      </div>
    );
  }
  if (b.reps) {
    return (
      <div className="b-right">
        <div className="b-reps">{b.reps}</div>
        {b.seconds ? <div className="b-sub">{fmtSec(b.seconds)}</div> : null}
      </div>
    );
  }
  if (b.seconds) {
    return (
      <div className="b-right">
        <div className="b-reps">{fmtSec(b.seconds)}</div>
      </div>
    );
  }
  return null;
}

function fmtSec(s?: number | null) {
  if (!s) return "";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m}:${r.toString().padStart(2, "0")}` : `${m} min`;
}

const ENERGY_EMOJI: Record<string, string> = { fresh: "💪", ok: "🙂", wrecked: "🥱" };

export default function WorkoutView({
  workout,
  savedId,
  garminConfigured,
  onToast,
  onSavedChange,
}: {
  workout: Workout;
  savedId?: number | null;
  garminConfigured?: boolean;
  onToast: (m: string) => void;
  onSavedChange?: (id: number) => void;
}) {
  const [showTimer, setShowTimer] = useState(false);
  const [localSavedId, setLocalSavedId] = useState<number | null>(savedId ?? null);
  const [busy, setBusy] = useState(false);

  async function save(rating: "like" | "dislike" | null = null) {
    setBusy(true);
    try {
      if (localSavedId) {
        await api.rateWorkout(localSavedId, { rating });
      } else {
        const row = await api.saveWorkout({ workout, rating });
        setLocalSavedId(row.id);
        onSavedChange?.(row.id);
      }
      onToast(rating === "like" ? "Saved & liked 👍" : rating === "dislike" ? "Saved & noted 👎" : "Saved to your library");
    } catch (e) {
      onToast(`Couldn't save: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function sendGarmin() {
    setBusy(true);
    onToast("Sending to Garmin…");
    try {
      const r = await api.garminUpload({ workout });
      onToast(`Scheduled on Garmin for ${r.scheduled_for} ✅`);
    } catch (e) {
      onToast(`Garmin: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function logSession(
    elapsedSec: number,
    rating: "like" | "dislike" | null,
    difficulty: string | null = null
  ) {
    setShowTimer(false);
    try {
      await api.logSession({ workout, workout_id: localSavedId, duration_actual_sec: elapsedSec, rating, difficulty });
      if (rating && !localSavedId) {
        const row = await api.saveWorkout({ workout, rating });
        setLocalSavedId(row.id);
      } else if (rating && localSavedId) {
        await api.rateWorkout(localSavedId, { rating });
      }
      onToast("Logged to history 🔥");
    } catch (e) {
      onToast(`Couldn't log: ${(e as Error).message}`);
    }
  }

  return (
    <div className="card">
      <div className="badge accent" style={{ display: "inline-block" }}>{workout.format}</div>
      <div className="wk-title">{workout.title}</div>
      <div className="wk-meta">
        <span className="badge">{workout.type === "strength" ? "🏋️ Strength" : "🚲 Bike"}</span>
        <span className="badge">⏱ {workout.duration_min} min</span>
        <span className="badge">{ENERGY_EMOJI[workout.energy]} {workout.energy}</span>
        {workout.source === "ai" && <span className="badge accent">✨ AI</span>}
      </div>
      {workout.summary && <div className="wk-summary">{workout.summary}</div>}
      {workout.ai_error && (
        <div className="wk-summary" style={{ color: "var(--accent)" }}>
          AI unavailable, showing a library workout instead.
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            Reason: {workout.ai_error}
          </div>
        </div>
      )}

      <div className="block-list">
        {workout.blocks.map((b, i) => (
          <div key={i} className={`block ${b.kind === "rest" ? "rest" : ""}`}>
            <div className="num">{b.minute ?? i + 1}</div>
            <div className="b-main">
              <div className="b-label">{b.label}</div>
              {b.notes && <div className="b-notes">{b.notes}</div>}
            </div>
            {blockRight(b)}
          </div>
        ))}
      </div>

      <button className="btn primary block lg mt" onClick={() => setShowTimer(true)}>
        ▶ Start {workout.timer === "emom" ? "EMOM" : workout.timer === "stopwatch" ? "Stopwatch" : "Timer"}
      </button>

      <div className="btn-row mt">
        <button className="btn" disabled={busy} onClick={() => save(null)}>
          {localSavedId ? "✓ Saved" : "♡ Save"}
        </button>
        <button className="btn" disabled={busy} onClick={() => save("like")}>👍 Like</button>
        <button className="btn" disabled={busy} onClick={() => save("dislike")}>👎</button>
      </div>

      {workout.type === "cardio" && (
        <button className="btn ghost block mt" disabled={busy || !garminConfigured} onClick={sendGarmin}>
          {garminConfigured ? "🚲 Send to Garmin Edge" : "🚲 Garmin not configured"}
        </button>
      )}

      {showTimer && <Timer workout={workout} onClose={() => setShowTimer(false)} onLog={logSession} />}
    </div>
  );
}
