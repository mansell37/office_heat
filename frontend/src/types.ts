export type Energy = "fresh" | "ok" | "wrecked";
export type WorkoutType = "strength" | "cardio" | "yoga";
export type TimerKind = "emom" | "amrap" | "interval" | "stopwatch";

export interface Block {
  label: string;
  reps?: string | null;
  seconds?: number | null;
  power_pct?: number | null;
  watts?: number | null;
  kind?: string | null;
  notes?: string | null;
  minute?: number;
  sanskrit?: string | null;
  image?: string | null;
  benefits?: string | null;
}

export interface Workout {
  type: WorkoutType;
  title: string;
  format: string;
  duration_min: number;
  energy: Energy;
  source: "template" | "ai";
  timer: TimerKind;
  summary?: string;
  blocks: Block[];
  template_key?: string;
  ai_error?: string;
}

export interface SavedWorkout {
  id: number;
  type: WorkoutType;
  format: string;
  title: string;
  duration_min: number;
  energy: Energy;
  source: string;
  structure: Workout;
  rating: "like" | "dislike" | null;
  favorite: boolean;
  times_done: number;
  notes: string | null;
  created_at: string;
}

export type Difficulty = "too_easy" | "easy" | "right" | "hard" | "too_hard";

export interface SessionLog {
  id: number;
  title: string;
  type: WorkoutType;
  format: string;
  energy: Energy;
  duration_planned_min: number | null;
  duration_actual_sec: number | null;
  rating: "like" | "dislike" | null;
  difficulty: Difficulty | null;
  notes: string | null;
  completed_at: string;
}

export interface Settings {
  ftp: number;
  default_energy: Energy;
  prefs: Record<string, unknown>;
}
