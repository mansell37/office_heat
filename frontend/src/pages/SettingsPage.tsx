import { useEffect, useState } from "react";
import { api } from "../api";
import type { Energy } from "../types";

export default function SettingsPage({ onToast }: { onToast: (m: string) => void }) {
  const [ftp, setFtp] = useState(200);
  const [energy, setEnergy] = useState<Energy>("ok");
  const [garmin, setGarmin] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getSettings().then((s) => { setFtp(s.ftp); setEnergy(s.default_energy); }).catch(() => {});
    api.garminStatus().then((s) => setGarmin(s.configured)).catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    try {
      await api.updateSettings({ ftp, default_energy: energy });
      onToast("Settings saved");
    } catch (e) {
      onToast((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="card">
        <div className="label">FTP — Functional Threshold Power (watts)</div>
        <input
          className="input"
          type="number"
          inputMode="numeric"
          value={ftp}
          onChange={(e) => setFtp(parseInt(e.target.value || "0", 10))}
        />
        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          Your default for bike power targets. You can override it per workout on the
          Generate screen (handy when someone else rides). Update as your fitness changes.
        </div>

        <div className="label mt">Default energy</div>
        <div className="seg">
          {(["fresh", "ok", "wrecked"] as Energy[]).map((e) => (
            <button key={e} className={energy === e ? "active" : ""} onClick={() => setEnergy(e)}>{e}</button>
          ))}
        </div>

        <button className="btn primary block lg mt" disabled={saving} onClick={save}>
          {saving ? <span className="spinner" /> : "Save settings"}
        </button>
      </div>

      <div className="card">
        <div className="row-between">
          <div>
            <div className="b-label">Garmin Connect</div>
            <div className="b-notes">For uploading bike workouts to your Edge</div>
          </div>
          <span className={`badge ${garmin ? "accent" : ""}`}>{garmin ? "✅ Connected" : "Not set"}</span>
        </div>
        {!garmin && (
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            Set <code>GARMIN_EMAIL</code> and <code>GARMIN_PASSWORD</code> as environment variables to enable upload.
          </div>
        )}
      </div>

      <div className="card center muted" style={{ fontSize: 12 }}>
        Office Heat · your equipment: 16kg kettlebell · yoga mat · Wahoo trainer
      </div>
    </div>
  );
}
