export const PROFILE_ACCENTS = [
  "teal",
  "cyan",
  "blue",
  "indigo",
  "violet",
  "fuchsia",
  "rose",
  "orange",
  "amber",
  "emerald",
] as const;

export type ProfileAccent = (typeof PROFILE_ACCENTS)[number];

export type ProfileDisplayMode = "full" | "compact";

export interface TaskColumnWidths {
  not_started: number;
  in_progress: number;
  waiting: number;
  completed: number;
}

export interface Profile {
  id: string;
  nickname: string;
  avatar_url: string | null;
  accent_color: ProfileAccent;
  display_mode: ProfileDisplayMode;
  task_column_widths: TaskColumnWidths | null;
  created_at: string;
  updated_at: string;
}
