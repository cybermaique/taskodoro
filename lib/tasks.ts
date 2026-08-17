import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import type {
  CreateSubtaskInput,
  CreateTaskInput,
  FocusSession,
  Subtask,
  Task,
  TaskAttachment,
  TaskPriority,
  TaskRecurrence,
  TaskStatus,
  UpdateSubtaskInput,
  UpdateTaskInput,
} from "@/types/task";

const TASK_COLUMNS = `
  id,
  title,
  description,
  status,
  priority,
  category,
  due_date,
  planned_for,
  estimated_minutes,
  focused_seconds,
  pomodoro_count,
  recurrence,
  recurring_parent_id,
  created_at,
  completed_at,
  updated_at,
  pomodoro_minutes,
  break_minutes,
  task_attachments(
    id,
    task_id,
    file_name,
    mime_type,
    storage_path,
    created_at
  ),
  subtasks(
    id,
    task_id,
    title,
    is_completed,
    created_at,
    updated_at
  ),
  focus_sessions(
    id,
    task_id,
    started_at,
    ended_at,
    duration_seconds,
    completed_cycle,
    created_at
  )
`;

const SUBTASK_COLUMNS = "id,task_id,title,is_completed,created_at,updated_at";
const FOCUS_SESSION_COLUMNS =
  "id,task_id,started_at,ended_at,duration_seconds,completed_cycle,created_at";

function normalizeNullableMinutes(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }

  return Math.max(1, Math.floor(value));
}

function normalizeNullableText(value: string | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizePriority(value: string | undefined): TaskPriority {
  if (value === "low" || value === "high") {
    return value;
  }

  return "medium";
}

function normalizeStatus(value: string | undefined): TaskStatus {
  if (
    value === "in_progress" ||
    value === "completed" ||
    value === "canceled" ||
    value === "pending"
  ) {
    return value;
  }

  return "pending";
}

function normalizeRecurrence(value: string | undefined): TaskRecurrence {
  if (value === "daily" || value === "weekly" || value === "monthly") {
    return value;
  }

  return "none";
}

function normalizeDate(value: string | null | undefined, fieldLabel: string) {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const isDate = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
  if (!isDate) {
    throw new Error(`${fieldLabel} invalida. Use o formato YYYY-MM-DD.`);
  }

  return trimmed;
}

function addRecurrenceDate(value: string | null, recurrence: TaskRecurrence) {
  if (!value || recurrence === "none") {
    return value;
  }

  const date = new Date(`${value}T00:00:00`);

  if (recurrence === "daily") {
    date.setDate(date.getDate() + 1);
  }

  if (recurrence === "weekly") {
    date.setDate(date.getDate() + 7);
  }

  if (recurrence === "monthly") {
    date.setMonth(date.getMonth() + 1);
  }

  return date.toISOString().slice(0, 10);
}

function mapTask(task: Task): Task {
  const rawTask = task as Task & { task_attachments?: TaskAttachment[] };

  return {
    ...task,
    focused_seconds: task.focused_seconds ?? 0,
    pomodoro_count: task.pomodoro_count ?? 0,
    recurrence: task.recurrence ?? "none",
    attachments: Array.isArray(rawTask.task_attachments)
      ? rawTask.task_attachments
      : [],
    subtasks: Array.isArray(task.subtasks)
      ? [...task.subtasks].sort(
          (left, right) =>
            new Date(left.created_at).getTime() - new Date(right.created_at).getTime(),
        )
      : [],
    focus_sessions: Array.isArray(task.focus_sessions)
      ? [...task.focus_sessions].sort(
          (left, right) =>
            new Date(right.started_at).getTime() - new Date(left.started_at).getTime(),
        )
      : [],
  };
}

export async function createTaskAttachment({
  taskId,
  file,
}: {
  taskId: string;
  file: File;
}) {
  const supabase = createSupabaseServerClient();
  const extension = file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || "bin";
  const storagePath = `${taskId}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from("task-attachments")
    .upload(storagePath, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { error: insertError } = await supabase.from("task_attachments").insert({
    task_id: taskId,
    file_name: file.name || `arquivo.${extension}`,
    mime_type: file.type || "application/octet-stream",
    storage_path: storagePath,
  });

  if (insertError) {
    await supabase.storage.from("task-attachments").remove([storagePath]);
    throw new Error(insertError.message);
  }

  return getTaskById(taskId);
}

export async function getTaskAttachment(taskId: string, attachmentId: string) {
  const supabase = createSupabaseServerClient();
  const { data: attachment, error } = await supabase
    .from("task_attachments")
    .select("id,task_id,file_name,mime_type,storage_path,created_at")
    .eq("id", attachmentId)
    .eq("task_id", taskId)
    .single();

  if (error) throw new Error(error.message);
  const { data, error: downloadError } = await supabase.storage
    .from("task-attachments")
    .download((attachment as TaskAttachment).storage_path);
  if (downloadError) throw new Error(downloadError.message);
  return { attachment: attachment as TaskAttachment, data };
}

export async function deleteTaskAttachment(taskId: string, attachmentId: string) {
  const supabase = createSupabaseServerClient();
  const { data: attachment, error: findError } = await supabase
    .from("task_attachments")
    .select("storage_path")
    .eq("id", attachmentId)
    .eq("task_id", taskId)
    .single();
  if (findError) throw new Error(findError.message);

  const { error: deleteError } = await supabase
    .from("task_attachments")
    .delete()
    .eq("id", attachmentId)
    .eq("task_id", taskId);
  if (deleteError) throw new Error(deleteError.message);

  const { error: storageError } = await supabase.storage
    .from("task-attachments")
    .remove([(attachment as { storage_path: string }).storage_path]);
  if (storageError) throw new Error(storageError.message);

  return getTaskById(taskId);
}

export async function listTasks() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_COLUMNS)
    .order("created_at", { ascending: false })
    .order("created_at", { foreignTable: "subtasks", ascending: true })
    .order("started_at", { foreignTable: "focus_sessions", ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as Task[]).map(mapTask);
}

export async function getTaskById(id: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_COLUMNS)
    .eq("id", id)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapTask(data as unknown as Task);
}

export async function createTask(input: CreateTaskInput) {
  const supabase = createSupabaseServerClient();
  const payload = {
    title: input.title.trim(),
    description: normalizeNullableText(input.description),
    status: "pending" as const,
    priority: normalizePriority(input.priority),
    category: normalizeNullableText(input.category),
    due_date: normalizeDate(input.due_date, "Data limite"),
    planned_for: normalizeDate(input.planned_for, "Data planejada"),
    estimated_minutes: normalizeNullableMinutes(input.estimated_minutes),
    recurrence: normalizeRecurrence(input.recurrence),
    completed_at: null,
    focused_seconds: 0,
    pomodoro_count: 0,
    pomodoro_minutes: normalizeNullableMinutes(input.pomodoro_minutes),
    break_minutes: normalizeNullableMinutes(input.break_minutes),
  };

  const { data, error } = await supabase
    .from("tasks")
    .insert(payload)
    .select(TASK_COLUMNS)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapTask(data as unknown as Task);
}

export async function updateTask(id: string, input: UpdateTaskInput) {
  const supabase = createSupabaseServerClient();
  const previousTask = input.status === "completed" ? await getTaskById(id) : null;
  const updatePayload: Record<string, string | number | null> = {};

  if (typeof input.title === "string") {
    updatePayload.title = input.title.trim();
  }

  if (input.description !== undefined) {
    updatePayload.description = normalizeNullableText(input.description);
  }

  if (input.status) {
    updatePayload.status = normalizeStatus(input.status);
    updatePayload.completed_at =
      input.status === "completed" ? new Date().toISOString() : null;
  }

  if (input.priority !== undefined) {
    updatePayload.priority = normalizePriority(input.priority);
  }

  if (input.category !== undefined) {
    updatePayload.category = normalizeNullableText(input.category);
  }

  if (input.due_date !== undefined) {
    updatePayload.due_date = normalizeDate(input.due_date, "Data limite");
  }

  if (input.planned_for !== undefined) {
    updatePayload.planned_for = normalizeDate(input.planned_for, "Data planejada");
  }

  if (input.estimated_minutes !== undefined) {
    updatePayload.estimated_minutes = normalizeNullableMinutes(input.estimated_minutes);
  }

  if (input.focused_seconds !== undefined) {
    updatePayload.focused_seconds = Math.max(0, Math.floor(input.focused_seconds));
  }

  if (input.pomodoro_count !== undefined) {
    updatePayload.pomodoro_count = Math.max(0, Math.floor(input.pomodoro_count));
  }

  if (input.recurrence !== undefined) {
    updatePayload.recurrence = normalizeRecurrence(input.recurrence);
  }

  if (input.pomodoro_minutes !== undefined) {
    updatePayload.pomodoro_minutes = normalizeNullableMinutes(input.pomodoro_minutes);
  }

  if (input.break_minutes !== undefined) {
    updatePayload.break_minutes = normalizeNullableMinutes(input.break_minutes);
  }

  if (!Object.keys(updatePayload).length) {
    return getTaskById(id);
  }

  const { error } = await supabase.from("tasks").update(updatePayload).eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  const updatedTask = await getTaskById(id);

  if (
    previousTask &&
    previousTask.status !== "completed" &&
    updatedTask.status === "completed" &&
    updatedTask.recurrence !== "none"
  ) {
    await createNextRecurringTask(updatedTask);
  }

  return updatedTask;
}

async function createNextRecurringTask(task: Task) {
  const supabase = createSupabaseServerClient();
  const recurrence = task.recurrence;

  if (recurrence === "none") {
    return;
  }

  const { error } = await supabase.from("tasks").insert({
    title: task.title,
    description: task.description,
    status: "pending",
    priority: task.priority,
    category: task.category,
    due_date: addRecurrenceDate(task.due_date, recurrence),
    planned_for: addRecurrenceDate(task.planned_for, recurrence),
    estimated_minutes: task.estimated_minutes,
    recurrence,
    recurring_parent_id: task.recurring_parent_id ?? task.id,
    pomodoro_minutes: task.pomodoro_minutes,
    break_minutes: task.break_minutes,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteTask(id: string) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("tasks").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function createSubtask(input: CreateSubtaskInput) {
  const supabase = createSupabaseServerClient();
  const payload = {
    task_id: input.task_id,
    title: input.title.trim(),
    is_completed: false,
  };

  const { data, error } = await supabase
    .from("subtasks")
    .insert(payload)
    .select(SUBTASK_COLUMNS)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Subtask;
}

export async function getSubtaskById(id: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("subtasks")
    .select(SUBTASK_COLUMNS)
    .eq("id", id)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Subtask;
}

export async function updateSubtask(id: string, input: UpdateSubtaskInput) {
  const supabase = createSupabaseServerClient();
  const updatePayload: Record<string, string | boolean> = {};

  if (typeof input.title === "string") {
    updatePayload.title = input.title.trim();
  }

  if (typeof input.is_completed === "boolean") {
    updatePayload.is_completed = input.is_completed;
  }

  if (!Object.keys(updatePayload).length) {
    const { data, error } = await supabase
      .from("subtasks")
      .select(SUBTASK_COLUMNS)
      .eq("id", id)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data as Subtask;
  }

  const { data, error } = await supabase
    .from("subtasks")
    .update(updatePayload)
    .eq("id", id)
    .select(SUBTASK_COLUMNS)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Subtask;
}

export async function deleteSubtask(id: string) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("subtasks").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function recordFocusSession({
  taskId,
  durationSeconds,
  completedCycle,
}: {
  taskId: string;
  durationSeconds: number;
  completedCycle: boolean;
}) {
  const supabase = createSupabaseServerClient();
  const duration = Math.max(1, Math.floor(durationSeconds));
  const endedAt = new Date();
  const startedAt = new Date(endedAt.getTime() - duration * 1000);

  const { data, error } = await supabase
    .from("focus_sessions")
    .insert({
      task_id: taskId,
      started_at: startedAt.toISOString(),
      ended_at: endedAt.toISOString(),
      duration_seconds: duration,
      completed_cycle: completedCycle,
    })
    .select(FOCUS_SESSION_COLUMNS)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const task = await getTaskById(taskId);
  await updateTask(taskId, {
    focused_seconds: task.focused_seconds + duration,
    pomodoro_count: task.pomodoro_count + (completedCycle ? 1 : 0),
    status: task.status === "pending" ? "in_progress" : task.status,
  });

  return data as FocusSession;
}
