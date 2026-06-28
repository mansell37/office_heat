import { useEffect, useMemo, useRef, useState } from "react";
import type { Workout } from "../types";
import { finish as finishSound, go, initAudio, rest as restSound, tick, vibrate } from "../sound";
import { useTrainer } from "../useTrainer";

const BIAS_MIN = 50;
const BIAS_MAX = 150;
const BIAS_STEP = 5;

interface Phase {
  label: string;
  seconds: number;
  kind: string;
  reps?: string | null;
  notes?: string | null;
  watts?: number | null;
  pct?: number | null;
}

function buildPhases(w: Workout): Phase[] {
  if (w.timer === "emom") {
    return w.blocks.map((b) => ({
      label: b.label, seconds: 60, kind: "work", reps: b.reps, notes: b.notes,
    }));
  }
  if (w.timer === "interval") {
    return w.blocks.map((b) => ({
      label: b.label, seconds: b.seconds || 30, kind: b.kind || "work",
      reps: b.reps, notes: b.notes, watts: b.watts, pct: b.power_pct,
    }));
  }
  if (w.timer === "amrap") {
    return [{ label: "AMRAP", seconds: w.duration_min * 60, kind: "work" }];
  }
  return []; // stopwatch
}

function fmt(total: number): string {
  const s = Math.max(0, Math.ceil(total));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

const isWork = (k: string) => k === "work" || k === "warmup";

export default function Timer({
  workout,
  onClose,
  onLog,
}: {
  workout: Workout;
  onClose: () => void;
  onLog: (elapsedSec: number, rating: "like" | "dislike" | null) => void;
}) {
  const phases = useMemo(() => buildPhases(workout), [workout]);
  const stopwatch = workout.timer === "stopwatch";
  const amrap = workout.timer === "amrap";

  // Bike rides can drive a smart trainer directly (ERG mode) over Web Bluetooth.
  const isRide = workout.type === "cardio" && workout.timer === "interval";
  const trainer = useTrainer();
  const [bias, setBias] = useState(100); // intensity % applied to power targets

  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(stopwatch ? 0 : phases[0]?.seconds ?? 0);
  const [running, setRunning] = useState(true);
  const [done, setDone] = useState(false);
  const [rounds, setRounds] = useState(0); // amrap / stopwatch round counter

  const remainingRef = useRef(remaining);
  const totalRef = useRef(0); // total elapsed seconds
  const indexRef = useRef(0);
  const lastTs = useRef(0);

  // Kick off audio + first cue.
  useEffect(() => {
    initAudio();
    if (!stopwatch) {
      go();
      vibrate(60);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startPhase(i: number) {
    indexRef.current = i;
    remainingRef.current = phases[i].seconds;
    setIndex(i);
    setRemaining(phases[i].seconds);
    if (isWork(phases[i].kind)) {
      go();
      vibrate(60);
    } else {
      restSound();
      vibrate([40, 40]);
    }
  }

  function complete() {
    setRunning(false);
    setDone(true);
    finishSound();
    vibrate([80, 60, 80, 60, 160]);
    // Release the trainer to easy spin so it isn't holding load after you stop.
    if (isRide) trainer.setTargetPower(0);
  }

  useEffect(() => {
    if (!running || done) return;
    lastTs.current = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const dt = (now - lastTs.current) / 1000;
      lastTs.current = now;
      totalRef.current += dt;

      if (stopwatch) {
        setRemaining(Math.floor(totalRef.current));
        return;
      }

      const prev = remainingRef.current;
      const next = prev - dt;
      // 3-2-1 countdown ticks at each phase boundary.
      const pc = Math.ceil(prev);
      const nc = Math.ceil(next);
      if (nc !== pc && nc >= 1 && nc <= 3) tick();

      if (next <= 0) {
        const ni = indexRef.current + 1;
        if (ni >= phases.length) {
          complete();
        } else {
          startPhase(ni);
        }
      } else {
        remainingRef.current = next;
        setRemaining(Math.ceil(next));
      }
    }, 150);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, done, stopwatch]);

  function skip() {
    if (stopwatch) return;
    const ni = indexRef.current + 1;
    if (ni >= phases.length) complete();
    else startPhase(ni);
  }
  function prev() {
    if (stopwatch) return;
    startPhase(Math.max(0, indexRef.current - 1));
  }

  // ---- Trainer / intensity (bike rides only) ----
  const rideWatts = isRide ? phases[index]?.watts ?? null : null;
  const target = rideWatts != null ? Math.round((rideWatts * bias) / 100) : null;
  const adjustBias = (d: number) =>
    setBias((b) => Math.min(BIAS_MAX, Math.max(BIAS_MIN, b + d)));

  // Push the ERG target to the trainer whenever the block, bias, or connection changes.
  useEffect(() => {
    if (isRide && trainer.status === "connected" && target != null) {
      trainer.setTargetPower(target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, trainer.status, isRide]);

  // ---- Done screen ----
  if (done) {
    const elapsed = Math.round(totalRef.current);
    return (
      <div className="timer-overlay">
        <div className="timer-clock work" style={{ flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 48 }}>🔥</div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>Workout done!</div>
          <div className="muted">Elapsed {fmt(elapsed)}{rounds ? ` · ${rounds} rounds` : ""}</div>
        </div>
        <div className="center muted" style={{ marginBottom: 12 }}>How did it feel?</div>
        <div className="btn-row" style={{ marginBottom: 10 }}>
          <button className="btn ghost" onClick={() => onLog(elapsed, "dislike")}>👎 Meh</button>
          <button className="btn ghost" onClick={() => onLog(elapsed, "like")}>👍 Loved it</button>
        </div>
        <div className="btn-row">
          <button className="btn block" onClick={() => onLog(elapsed, null)}>Save to history</button>
          <button className="btn ghost" onClick={onClose}>Discard</button>
        </div>
      </div>
    );
  }

  const cur = phases[index];
  const phaseKind = stopwatch ? "work" : cur?.kind ?? "work";
  const working = isWork(phaseKind);
  const upNext = !stopwatch && phases[index + 1] ? phases[index + 1].label : "";
  const phasePct = cur && cur.seconds ? 1 - remaining / cur.seconds : 0;

  return (
    <div className="timer-overlay">
      <div className="timer-phase">
        {workout.title} ·{" "}
        {stopwatch ? "Stopwatch" : amrap ? "AMRAP" : `${working ? "Work" : "Rest"} · ${index + 1}/${phases.length}`}
      </div>

      <div className="timer-current">
        <div className="lbl">{stopwatch ? workout.title : cur?.label}</div>
        {cur?.reps && <div className="reps">{cur.reps}</div>}
        {cur?.watts != null && (
          <div className="reps">
            {target ?? cur.watts}W
            {bias !== 100 && <span className="muted"> ({bias}%)</span>}
            <span className="muted" style={{ fontSize: 14 }}> · {cur.pct}% FTP</span>
          </div>
        )}
        {cur?.notes && <div className="notes">{cur.notes}</div>}
        {workout.timer === "emom" && cur && (
          <div className="round-pips">
            {phases.map((_, i) => (
              <span key={i} className={`pip ${i < index ? "done" : i === index ? "current" : ""}`} />
            ))}
          </div>
        )}
      </div>

      <div className={`timer-clock ${working ? "work" : "rest"}`}>
        <div className="big">{stopwatch ? fmt(totalRef.current) : fmt(remaining)}</div>
      </div>

      {!stopwatch && (
        <>
          <div className="timer-up-next">{upNext ? `Up next: ${upNext}` : "Last one — finish strong!"}</div>
          <div className="timer-progress">
            <div style={{ width: `${Math.min(100, phasePct * 100)}%` }} />
          </div>
        </>
      )}

      {isRide && (
        <div className="trainer-panel">
          <div className="trainer-bias">
            <button className="btn ghost" onClick={() => adjustBias(-BIAS_STEP)} disabled={bias <= BIAS_MIN}>
              − Easier
            </button>
            <div className="trainer-bias-val">
              <div className="big-pct">{bias}%</div>
              <div className="muted" style={{ fontSize: 12 }}>
                {target != null ? `${target}W target` : "intensity"}
              </div>
            </div>
            <button className="btn ghost" onClick={() => adjustBias(BIAS_STEP)} disabled={bias >= BIAS_MAX}>
              Harder +
            </button>
          </div>

          {trainer.status === "connected" ? (
            <div className="trainer-live">
              <div className="metric">
                <span className="m-val">{trainer.data.power ?? "–"}</span>
                <span className="m-lbl">watts</span>
              </div>
              <div className="metric">
                <span className="m-val">
                  {trainer.data.cadence != null ? Math.round(trainer.data.cadence) : "–"}
                </span>
                <span className="m-lbl">rpm</span>
              </div>
              <button className="btn ghost sm" onClick={() => trainer.disconnect()}>Disconnect</button>
            </div>
          ) : trainer.status === "unsupported" ? (
            <div className="muted center" style={{ fontSize: 12 }}>
              Pair a smart trainer in Chrome or Edge (computer / Android) to auto-set resistance.
            </div>
          ) : (
            <button
              className="btn block"
              onClick={() => trainer.connect()}
              disabled={trainer.status === "connecting"}
            >
              {trainer.status === "connecting" ? <span className="spinner" /> : "🔌 Connect trainer"}
            </button>
          )}
          {trainer.status === "error" && trainer.error && (
            <div className="center" style={{ fontSize: 12, color: "var(--accent)", marginTop: 6 }}>
              {trainer.error}
            </div>
          )}
        </div>
      )}

      {(amrap || stopwatch) && (
        <div className="row-between" style={{ marginBottom: 12 }}>
          <button className="btn ghost" onClick={() => setRounds((r) => Math.max(0, r - 1))}>−</button>
          <div className="center">
            <div style={{ fontSize: 26, fontWeight: 800 }}>{rounds}</div>
            <div className="muted" style={{ fontSize: 12 }}>rounds done</div>
          </div>
          <button className="btn primary" onClick={() => { setRounds((r) => r + 1); vibrate(40); }}>+ Round</button>
        </div>
      )}

      <div className="timer-controls">
        {!stopwatch && <button className="btn ghost" onClick={prev}>‹ Back</button>}
        <button className="btn primary" onClick={() => { initAudio(); setRunning((r) => !r); }}>
          {running ? "Pause" : "Resume"}
        </button>
        {!stopwatch && <button className="btn ghost" onClick={skip}>Skip ›</button>}
      </div>
      <div className="btn-row" style={{ marginTop: 10 }}>
        <button className="btn block" onClick={complete}>Finish</button>
        <button className="btn ghost" onClick={onClose}>Quit</button>
      </div>
    </div>
  );
}
