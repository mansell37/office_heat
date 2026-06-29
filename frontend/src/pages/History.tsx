import { useEffect, useState } from "react";
import { api } from "../api";
import type { SessionLog } from "../types";

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}
function fmtDur(sec: number | null) {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const DIFF_LABEL: Record<string, string> = {
  too_easy: "😴 too easy",
  easy: "🙂 easy",
  right: "💪 just right",
  hard: "😤 hard",
  too_hard: "🥵 too hard",
};

export default function History() {
  const [items, setItems] = useState<SessionLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listSessions().then(setItems).finally(() => setLoading(false));
  }, []);

  const totalMin = Math.round(items.reduce((a, s) => a + (s.duration_actual_sec || 0), 0) / 60);

  return (
    <div>
      {!loading && items.length > 0 && (
        <div className="card center">
          <div style={{ fontSize: 28, fontWeight: 800 }}>{items.length}</div>
          <div className="muted">sessions logged · {totalMin} min total</div>
        </div>
      )}
      {loading && <div className="empty"><span className="spinner" /></div>}
      {!loading && items.length === 0 && (
        <div className="empty">
          <div className="big-emoji">📈</div>
          <p>No sessions yet. Finish a timed workout to log it here.</p>
        </div>
      )}
      {items.map((s) => (
        <div key={s.id} className="card" style={{ padding: 0 }}>
          <div className="list-item" style={{ cursor: "default" }}>
            <div className="num" style={{ fontSize: 18 }}>{s.type === "strength" ? "🏋️" : "🚲"}</div>
            <div className="b-main">
              <div className="b-label">{s.title}</div>
              <div className="b-notes">
                {fmtDate(s.completed_at)} · {s.format}
                {s.difficulty ? ` · ${DIFF_LABEL[s.difficulty] ?? s.difficulty}` : ` · ${s.energy}`}
              </div>
            </div>
            <div className="b-right">
              <div className="b-reps">{fmtDur(s.duration_actual_sec)}</div>
              <div className="b-sub">{s.rating === "like" ? "👍" : s.rating === "dislike" ? "👎" : ""}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
