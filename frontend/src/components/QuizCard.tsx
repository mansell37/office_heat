import { useEffect, useState } from "react";
import type { QuizQ } from "../quiz";

const Q_SECONDS = 20;
const A_SECONDS = 10;

/**
 * Cycles through quiz questions while mounted: 20s showing the question, then
 * 10s revealing the answer, then on to the next. Non-blocking — the ride keeps
 * running underneath. Unmount (Stop) ends the loop.
 */
export default function QuizCard({
  questions,
  onStop,
}: {
  questions: QuizQ[];
  onStop: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"q" | "a">("q");
  const [secs, setSecs] = useState(Q_SECONDS);

  useEffect(() => {
    const dur = phase === "q" ? Q_SECONDS : A_SECONDS;
    setSecs(dur);
    const tick = setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1000);
    const advance = setTimeout(() => {
      if (phase === "q") {
        setPhase("a");
      } else {
        setPhase("q");
        setIndex((i) => (i + 1) % questions.length);
      }
    }, dur * 1000);
    return () => {
      clearInterval(tick);
      clearTimeout(advance);
    };
  }, [index, phase, questions.length]);

  if (!questions.length) return null;
  const cur = questions[index];
  const revealing = phase === "a";
  const total = revealing ? A_SECONDS : Q_SECONDS;

  return (
    <div className="quiz-card">
      <div className="quiz-head">
        <span className="quiz-tag">{revealing ? "Answer" : "Quiz"}</span>
        <span className="quiz-secs">{secs}s</span>
        <button className="btn ghost sm" onClick={onStop}>Stop</button>
      </div>
      <div className="quiz-q">{cur.q}</div>
      <div className="quiz-options">
        {cur.options.map((opt) => {
          const correct = revealing && opt === cur.answer;
          return (
            <div key={opt} className={`quiz-opt ${correct ? "correct" : ""}`}>
              {opt}
            </div>
          );
        })}
      </div>
      <div className="quiz-bar">
        <div style={{ width: `${(secs / total) * 100}%` }} className={revealing ? "rev" : ""} />
      </div>
    </div>
  );
}
