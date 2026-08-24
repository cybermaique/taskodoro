export type TaskStatus =
  | "not_started"
  | "in_progress"
  | "waiting"
  | "completed";
export type TaskPriority = "low" | "medium" | "high";
export type TaskType = "feature" | "bug" | "improvement" | "task" | "date";

export const TASK_TYPE_OPTIONS = [
  { value: "feature", label: "Feature" },
  { value: "bug", label: "Bug" },
  { value: "improvement", label: "Melhoria" },
  { value: "task", label: "Tarefa" },
  { value: "date", label: "Date" },
] as const satisfies ReadonlyArray<{ value: TaskType; label: string }>;

export function getTaskTypeOptions(category: string | null | undefined) {
  return category?.trim().toLocaleLowerCase("pt-BR") === "pessoal"
    ? TASK_TYPE_OPTIONS
    : TASK_TYPE_OPTIONS.filter((option) => option.value !== "date");
}

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

export interface TaskStatusHistory {
  id: string;
  task_id: string;
  from_status: TaskStatus | null;
  to_status: TaskStatus;
  changed_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  type: TaskType;
  category: string | null;
  created_at: string;
  completed_at: string | null;
  updated_at: string;
  attachments: TaskAttachment[];
  subtasks: Subtask[];
  status_history: TaskStatusHistory[];
}

export type TaskView = "all" | "work" | "personal" | "travel";

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: TaskPriority;
  type?: TaskType;
  category?: string | null;
  subtasks?: string[];
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  type?: TaskType;
  category?: string | null;
}

export interface CreateSubtaskInput {
  task_id: string;
  title: string;
}

export interface UpdateSubtaskInput {
  title?: string;
  is_completed?: boolean;
}
