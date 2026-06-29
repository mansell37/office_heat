import { useEffect, useMemo, useRef, useState } from "react";
import type { Workout } from "../types";
import { finish as finishSound, go, initAudio, rest as restSound, tick, vibrate } from "../sound";
import { useTrainer } from "../useTrainer";
import { loadQuiz, type QuizQ } from "../quiz";
import QuizCard from "./QuizCard";
import RideChart, { type Sample } from "./RideChart";

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
  const [started, setStarted] = useState(false); // ready screen until pressed
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [rounds, setRounds] = useState(0); // amrap / stopwatch round counter
  const [elapsed, setElapsed] = useState(0); // total elapsed seconds (reactive)

  // Quiz mode: cycles questions while on (20s question, 10s answer).
  const [quizOn, setQuizOn] = useState(false);
  const [quizQs, setQuizQs] = useState<QuizQ[]>([]);
  const [quizLoading, setQuizLoading] = useState(false);

  // Live power/cadence samples for the ride chart.
  const [samples, setSamples] = useState<Sample[]>([]);

  const totalPlanned = useMemo(
    () => (stopwatch ? 0 : phases.reduce((a, p) => a + (p.seconds || 0), 0)),
    [phases, stopwatch]
  );

  const remainingRef = useRef(remaining);
  const totalRef = useRef(0); // total elapsed seconds
  const indexRef = useRef(0);
  const lastTs = useRef(0);
  const runningRef = useRef(false);
  const dataRef = useRef(trainer.data);
  runningRef.current = running;
  dataRef.current = trainer.data;

  // Prepare audio (cues play on Start, not on mount).
  useEffect(() => {
    initAudio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startWorkout() {
    initAudio();
    setStarted(true);
    setRunning(true);
    if (stopwatch) {
      lastTs.current = performance.now();
    } else {
      startPhase(0); // first cue; ERG target is pushed by the effect below
    }
  }

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
    if (!started || !running || done) return;
    lastTs.current = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const dt = (now - lastTs.current) / 1000;
      lastTs.current = now;
      totalRef.current += dt;
      setElapsed(Math.floor(totalRef.current));

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
  }, [started, running, done, stopwatch]);

  // Sample live power/cadence every 2s (while pedalling) for the chart.
  useEffect(() => {
    if (!isRide || !started) return;
    const id = setInterval(() => {
      if (runningRef.current) {
        setSamples((s) => [...s, { p: dataRef.current.power, c: dataRef.current.cadence }]);
      }
    }, 2000);
    return () => clearInterval(id);
  }, [isRide, started]);

  async function toggleQuiz() {
    if (quizOn) {
      setQuizOn(false);
      return;
    }
    setQuizLoading(true);
    try {
      const qs = await loadQuiz();
      setQuizQs(qs);
      setQuizOn(qs.length > 0);
    } finally {
      setQuizLoading(false);
    }
  }

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

  // ---- Done screen / post-workout summary ----
  if (done) {
    const elapsedSec = Math.round(totalRef.current);
    const powers = samples.map((s) => s.p).filter((p): p is number => p != null && p > 0);
    const cads = samples.map((s) => s.c).filter((c): c is number => c != null && c > 0);
    const mean = (a: number[]) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0);
    const avgPower = mean(powers);
    const maxPower = powers.length ? Math.max(...powers) : 0;
    const avgCad = mean(cads);
    const hasRideStats = isRide && samples.length > 1;

    return (
      <div className="timer-overlay done-screen">
        <div className="done-hero">
          <div className="emoji">🔥</div>
          <div className="title">Workout done!</div>
          <div className="sub">{fmt(elapsedSec)} elapsed{rounds ? ` · ${rounds} rounds` : ""}</div>
        </div>

        {hasRideStats && (
          <>
            <div className="ride-metrics">
              <div className="rm-tile"><div className="rm-val">{avgPower}</div><div className="rm-lbl">Avg · W</div></div>
              <div className="rm-tile accent"><div className="rm-val">{maxPower}</div><div className="rm-lbl">Max · W</div></div>
              <div className="rm-tile"><div className="rm-val">{avgCad || "–"}</div><div className="rm-lbl">Avg · rpm</div></div>
            </div>
            <RideChart samples={samples} />
          </>
        )}

        <div className="center muted" style={{ margin: "10px 0 12px" }}>How did it feel?</div>
        <div className="btn-row" style={{ marginBottom: 10 }}>
          <button className="btn ghost" onClick={() => onLog(elapsedSec, "dislike")}>👎 Meh</button>
          <button className="btn ghost" onClick={() => onLog(elapsedSec, "like")}>👍 Loved it</button>
        </div>
        <div className="btn-row">
          <button className="btn block" onClick={() => onLog(elapsedSec, null)}>Save to history</button>
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
  const overallLeft = Math.max(0, totalPlanned - elapsed);
  const overallPct = totalPlanned ? Math.min(100, (elapsed / totalPlanned) * 100) : 0;

  return (
    <div className="timer-overlay">
      {quizOn && quizQs.length > 0 && (
        <QuizCard questions={quizQs} onStop={() => setQuizOn(false)} />
      )}

      <div className="timer-phase">
        {workout.title} ·{" "}
        {!started
          ? "Ready"
          : stopwatch ? "Stopwatch" : amrap ? "AMRAP" : `${working ? "Work" : "Rest"} · ${index + 1}/${phases.length}`}
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

      {isRide && (
        <div className="ride-metrics">
          <div className="rm-tile">
            <div className="rm-val">{trainer.data.power ?? "–"}</div>
            <div className="rm-lbl">Power · W</div>
          </div>
          <div className="rm-tile">
            <div className="rm-val">
              {trainer.data.cadence != null ? Math.round(trainer.data.cadence) : "–"}
            </div>
            <div className="rm-lbl">Cadence · rpm</div>
          </div>
          <div className="rm-tile accent">
            <div className="rm-val">{target ?? cur?.watts ?? "–"}</div>
            <div className="rm-lbl">Target · W</div>
          </div>
        </div>
      )}

      {!stopwatch && (
        <>
          <div className="timer-up-next">
            {!started
              ? (isRide ? "Connect your trainer, then press Start" : "Press Start when you're ready")
              : upNext ? `Up next: ${upNext}` : "Last one — finish strong!"}
          </div>
          <div className="timer-progress">
            <div style={{ width: `${Math.min(100, phasePct * 100)}%` }} />
          </div>
          <div className="timer-overall">
            <span>{fmt(elapsed)} elapsed</span>
            <div className="timer-overall-bar"><div style={{ width: `${overallPct}%` }} /></div>
            <span>{fmt(overallLeft)} left</span>
          </div>
        </>
      )}

      {isRide && started && <RideChart samples={samples} />}

      {isRide && (
        <div className="trainer-panel">
          <div className="trainer-status">
            {trainer.status === "connected" ? (
              <>
                <span className="ts-state"><span className="ts-dot on" /> Trainer connected — auto-setting resistance</span>
                <button className="btn ghost sm" onClick={() => trainer.disconnect()}>Disconnect</button>
              </>
            ) : trainer.status === "unsupported" ? (
              <span className="muted" style={{ fontSize: 12 }}>
                Trainer control needs Chrome or Edge on a computer or Android.
              </span>
            ) : (
              <button
                className="btn connect"
                onClick={() => trainer.connect()}
                disabled={trainer.status === "connecting"}
              >
                {trainer.status === "connecting"
                  ? <span className="spinner" />
                  : <><span className="ts-dot" /> 🔌 Connect trainer</>}
              </button>
            )}
          </div>
          {trainer.status === "error" && trainer.error && (
            <div className="center" style={{ fontSize: 12, color: "var(--accent)" }}>
              {trainer.error}
            </div>
          )}

          <div className="trainer-bias">
            <button className="btn bias" onClick={() => adjustBias(-BIAS_STEP)} disabled={bias <= BIAS_MIN}>
              − Easier
            </button>
            <div className="trainer-bias-val">
              <div className="big-pct">{bias}%</div>
              <div className="muted" style={{ fontSize: 11 }}>intensity</div>
            </div>
            <button className="btn bias" onClick={() => adjustBias(BIAS_STEP)} disabled={bias >= BIAS_MAX}>
              Harder +
            </button>
          </div>
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

      {started && (
        <button
          className={`btn block ${quizOn ? "primary" : "ghost"}`}
          style={{ marginBottom: 10 }}
          onClick={toggleQuiz}
          disabled={quizLoading}
        >
          {quizLoading ? <span className="spinner" /> : quizOn ? "■ Stop quiz" : "🧠 Quiz me"}
        </button>
      )}

      {started ? (
        <div className="timer-controls">
          {!stopwatch && <button className="btn ghost" onClick={prev}>‹ Back</button>}
          <button className="btn primary" onClick={() => { initAudio(); setRunning((r) => !r); }}>
            {running ? "Pause" : "Resume"}
          </button>
          {!stopwatch && <button className="btn ghost" onClick={skip}>Skip ›</button>}
        </div>
      ) : (
        <button className="btn primary block lg" onClick={startWorkout}>
          ▶ Start {isRide ? "ride" : "workout"}
        </button>
      )}

      <div className="btn-row" style={{ marginTop: 10 }}>
        {started && <button className="btn block" onClick={complete}>Finish</button>}
        <button className="btn ghost block" onClick={onClose}>{started ? "Quit" : "Back"}</button>
      </div>
    </div>
  );
}
