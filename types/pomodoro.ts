export type PomodoroPhase = "focus" | "break";
export type PomodoroStatus = "idle" | "running" | "paused" | "finished";

export interface PomodoroSnapshot {
  selectedTaskId: string | null;
  phase: PomodoroPhase;
  status: PomodoroStatus;
  focusMinutes: number;
  breakMinutes: number;
  remainingSeconds: number;
  endAt: number | null;
  startedAt: number | null;
  completedPhaseLabel: PomodoroPhase | null;
}
