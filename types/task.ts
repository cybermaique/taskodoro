export type TaskStatus = "pending" | "in_progress" | "completed" | "canceled";
export type TaskPriority = "low" | "medium" | "high";
export type TaskRecurrence = "none" | "daily" | "weekly" | "monthly";

export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaskAttachment {
  id: string;
  task_id: string;
  file_name: string;
  mime_type: string;
  storage_path: string;
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  category: string | null;
  due_date: string | null;
  planned_for: string | null;
  estimated_minutes: number | null;
  recurrence: TaskRecurrence;
  recurring_parent_id: string | null;
  created_at: string;
  completed_at: string | null;
  updated_at: string;
  attachments: TaskAttachment[];
  subtasks: Subtask[];
}

export type TaskFilter = "all" | TaskStatus;
export type TaskView =
  | "all"
  | "today"
  | "overdue"
  | "backlog"
  | "work"
  | "personal"
  | "travel";

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: TaskPriority;
  category?: string | null;
  due_date?: string | null;
  planned_for?: string | null;
  estimated_minutes?: number | null;
  recurrence?: TaskRecurrence;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  category?: string | null;
  due_date?: string | null;
  planned_for?: string | null;
  estimated_minutes?: number | null;
  recurrence?: TaskRecurrence;
}

export interface CreateSubtaskInput {
  task_id: string;
  title: string;
}

export interface UpdateSubtaskInput {
  title?: string;
  is_completed?: boolean;
}
