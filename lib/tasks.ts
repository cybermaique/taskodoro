import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import type {
  CreateSubtaskInput,
  CreateTaskInput,
  Subtask,
  Task,
  TaskAttachment,
  TaskPriority,
  TaskStatusHistory,
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
  created_at,
  completed_at,
  updated_at,
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
  task_status_history(
    id,
    task_id,
    from_status,
    to_status,
    changed_at
  )
`;

const SUBTASK_COLUMNS = "id,task_id,title,is_completed,created_at,updated_at";

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
    value === "not_started" ||
    value === "in_progress" ||
    value === "completed" ||
    value === "waiting"
  ) {
    return value;
  }

  return "not_started";
}

function mapTask(task: Task): Task {
  const rawTask = task as Task & {
    task_attachments?: TaskAttachment[];
    task_status_history?: TaskStatusHistory[];
  };
  const statusHistory = Array.isArray(rawTask.task_status_history)
    ? rawTask.task_status_history
    : Array.isArray(task.status_history)
      ? task.status_history
      : [];

  return {
    ...task,
    attachments: Array.isArray(rawTask.task_attachments)
      ? rawTask.task_attachments
      : [],
    subtasks: Array.isArray(task.subtasks)
      ? [...task.subtasks].sort(
          (left, right) =>
            new Date(left.created_at).getTime() - new Date(right.created_at).getTime(),
        )
      : [],
    status_history: [...statusHistory].sort(
      (left, right) =>
        new Date(left.changed_at).getTime() -
        new Date(right.changed_at).getTime(),
    ),
  };
}

export async function createTaskAttachment({
  taskId,
  file,
}: {
  taskId: string;
  file: File;
}) {
  const supabase = await createSupabaseServerClient();
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
  const supabase = await createSupabaseServerClient();
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
  const supabase = await createSupabaseServerClient();
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
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_COLUMNS)
    .order("created_at", { ascending: false })
    .order("created_at", { foreignTable: "subtasks", ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as Task[]).map(mapTask);
}

export async function getTaskById(id: string) {
  const supabase = await createSupabaseServerClient();
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
  const supabase = await createSupabaseServerClient();
  const payload = {
    title: input.title.trim(),
    description: normalizeNullableText(input.description),
    status: "not_started" as const,
    priority: normalizePriority(input.priority),
    category: normalizeNullableText(input.category),
    completed_at: null,
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
  const supabase = await createSupabaseServerClient();
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

  if (!Object.keys(updatePayload).length) {
    return getTaskById(id);
  }

  const { error } = await supabase.from("tasks").update(updatePayload).eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  return getTaskById(id);
}

export async function deleteTask(id: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("tasks").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function createSubtask(input: CreateSubtaskInput) {
  const supabase = await createSupabaseServerClient();
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
  const supabase = await createSupabaseServerClient();
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
  const supabase = await createSupabaseServerClient();
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
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("subtasks").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}
