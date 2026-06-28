import type {
  Energy,
  SavedWorkout,
  SessionLog,
  Settings,
  Workout,
  WorkoutType,
} from "./types";

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = (await res.json()).detail || detail;
    } catch {
      /* ignore */
    }
    const err = new Error(detail) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  authConfig: () => req<{ auth_enabled: boolean }>("/api/auth-config"),
  me: () => req<{ authed: boolean; auth_enabled: boolean }>("/api/me"),
  login: (password: string) =>
    req<{ ok: boolean }>("/api/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),

  templates: () =>
    req<{
      strength: { key: string; title: string; format: string; blurb: string }[];
      cardio: { key: string; title: string; format: string; blurb: string }[];
    }>("/api/templates"),

  generate: (body: {
    type: WorkoutType;
    duration_min: number;
    energy: Energy;
    format?: string | null;
    use_ai?: boolean;
    ftp?: number | null;
  }) => req<Workout>("/api/generate", { method: "POST", body: JSON.stringify(body) }),

  listWorkouts: (params?: { type?: WorkoutType; favorite?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.type) q.set("type", params.type);
    if (params?.favorite != null) q.set("favorite", String(params.favorite));
    const qs = q.toString();
    return req<SavedWorkout[]>(`/api/workouts${qs ? "?" + qs : ""}`);
  },
  saveWorkout: (body: {
    workout: Workout;
    rating?: "like" | "dislike" | null;
    favorite?: boolean;
    notes?: string | null;
  }) => req<SavedWorkout>("/api/workouts", { method: "POST", body: JSON.stringify(body) }),
  rateWorkout: (
    id: number,
    body: { rating?: "like" | "dislike" | null; favorite?: boolean; notes?: string | null }
  ) => req<SavedWorkout>(`/api/workouts/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteWorkout: (id: number) =>
    req<{ deleted: number }>(`/api/workouts/${id}`, { method: "DELETE" }),

  logSession: (body: {
    workout: Workout;
    workout_id?: number | null;
    duration_actual_sec?: number | null;
    rating?: "like" | "dislike" | null;
    notes?: string | null;
  }) => req<SessionLog>("/api/sessions", { method: "POST", body: JSON.stringify(body) }),
  listSessions: () => req<SessionLog[]>("/api/sessions"),

  getSettings: () => req<Settings>("/api/settings"),
  updateSettings: (body: Partial<Settings>) =>
    req<Settings>("/api/settings", { method: "PUT", body: JSON.stringify(body) }),

  aiStatus: () => req<{ configured: boolean }>("/api/ai/status"),

  garminStatus: () => req<{ configured: boolean }>("/api/garmin/status"),
  garminUpload: (body: { workout: Workout; date?: string }) =>
    req<{ ok: boolean; workout_id: number; scheduled_for: string }>("/api/garmin/upload", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
