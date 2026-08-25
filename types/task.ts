export type TaskStatus =
  | "not_started"
  | "in_progress"
  | "waiting"
  | "completed";
export type TaskPriority = "low" | "medium" | "high";
export type TaskType =
  | "feature"
  | "bug"
  | "improvement"
  | "date"
  | "study"
  | "travel"
  | "health"
  | "finance"
  | "personal";

export const WORK_TASK_TYPE_OPTIONS = [
  { value: "feature", label: "Feature" },
  { value: "bug", label: "Bug" },
  { value: "improvement", label: "Melhoria" },
] as const satisfies ReadonlyArray<{ value: TaskType; label: string }>;

export const PERSONAL_TASK_TYPE_OPTIONS = [
  { value: "date", label: "Date" },
  { value: "study", label: "Estudos" },
  { value: "travel", label: "Viagem" },
  { value: "health", label: "Saúde" },
  { value: "finance", label: "Financeiro" },
  { value: "personal", label: "Outros" },
] as const satisfies ReadonlyArray<{ value: TaskType; label: string }>;

export const TASK_TYPE_OPTIONS = [
  ...WORK_TASK_TYPE_OPTIONS,
  ...PERSONAL_TASK_TYPE_OPTIONS,
] as const;

export const TASK_CATEGORY_OPTIONS = [
  { value: "trabalho", label: "Trabalho" },
  { value: "pessoal", label: "Pessoal" },
] as const;

export const DATE_DESCRIPTION_TEMPLATE = `Idade:
Signo:
Endereço:
Altura:
Tem filho:
Data date:

Nota personalidade:
Nota rosto:
Nota corpo:
Nota sexo:
`;

export function isPersonalCategory(category: string | null | undefined) {
  return category?.trim().toLocaleLowerCase("pt-BR") === "pessoal";
}

export function getTaskTypeOptions(category: string | null | undefined) {
  return isPersonalCategory(category)
    ? PERSONAL_TASK_TYPE_OPTIONS
    : WORK_TASK_TYPE_OPTIONS;
}

export function getDefaultTaskType(category: string | null | undefined): TaskType {
  return isPersonalCategory(category) ? "personal" : "feature";
}

export function getTaskCategoryLabel(category: string | null | undefined) {
  return TASK_CATEGORY_OPTIONS.find((option) => option.value === category)?.label ?? category;
}

export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  is_completed: boolean;
  completed_at: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface TaskAttachment {
  id: string;
  task_id: string;
  file_name: string;
  mime_type: string;
  storage_path: string;
  file_size: number | null;
  last_viewed_at: string | null;
  created_at: string;
}

export interface DateDetails {
  task_id: string;
  age: number | null;
  sign: string | null;
  address: string | null;
  height: string | null;
  work: string | null;
  has_children: boolean | null;
  location: string | null;
  date_at: string | null;
  personality_rating: number | null;
  face_rating: number | null;
  body_rating: number | null;
  sex_rating: number | null;
}

export interface TaskComment {
  id: string;
  task_id: string;
  content: string;
  created_at: string;
}

export interface TaskStatusHistory {
  id: string;
  task_id: string;
  from_status: TaskStatus | null;
  to_status: TaskStatus;
  changed_at: string;
}

export interface TaskDescriptionHistory {
  id: string;
  task_id: string;
  description: string | null;
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
  position: number;
  deleted_at: string | null;
  created_at: string;
  completed_at: string | null;
  updated_at: string;
  attachments: TaskAttachment[];
  subtasks: Subtask[];
  status_history: TaskStatusHistory[];
  description_history: TaskDescriptionHistory[];
  date_details: DateDetails | null;
  comments: TaskComment[];
}

export type TaskView = "all" | "work" | "personal" | "study" | "travel";

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: TaskPriority;
  type?: TaskType;
  category?: string | null;
  subtasks?: string[];
  date_details?: Partial<Omit<DateDetails, "task_id">> | null;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  type?: TaskType;
  category?: string | null;
  date_details?: Partial<Omit<DateDetails, "task_id">> | null;
}

export interface CreateSubtaskInput {
  task_id: string;
  title: string;
}

export interface UpdateSubtaskInput {
  title?: string;
  is_completed?: boolean;
}
