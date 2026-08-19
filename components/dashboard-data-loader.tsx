"use client";

import { useEffect, useState } from "react";

import { Dashboard } from "@/components/dashboard";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { Note } from "@/types/note";
import type { Task, TaskAttachment } from "@/types/task";

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
  recurrence,
  recurring_parent_id,
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
  )
`;

type RawTask = Task & { task_attachments?: TaskAttachment[] };

function mapTask(task: RawTask): Task {
  return {
    ...task,
    recurrence: task.recurrence ?? "none",
    attachments: Array.isArray(task.task_attachments)
      ? task.task_attachments
      : [],
    subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
  };
}

function dataVersion(tasks: Task[], notes: Note[]) {
  return [
    tasks.map((task) => `${task.id}:${task.updated_at}`).join(","),
    notes.map((note) => `${note.id}:${note.updated_at}`).join(","),
  ].join("|");
}

interface DashboardDataLoaderProps {
  initialTasks: Task[];
  initialNotes: Note[];
}

export function DashboardDataLoader({
  initialTasks,
  initialNotes,
}: DashboardDataLoaderProps) {
  const [tasks, setTasks] = useState(initialTasks);
  const [notes, setNotes] = useState(initialNotes);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    async function loadAuthenticatedData() {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError || !sessionData.session) {
        if (isCurrent && sessionError) setLoadError(sessionError.message);
        return;
      }

      const [tasksResult, notesResult] = await Promise.all([
        supabase
          .from("tasks")
          .select(TASK_COLUMNS)
          .order("created_at", { ascending: false })
          .order("created_at", { foreignTable: "subtasks", ascending: true }),
        supabase.from("notes").select("id,title,content,tags,created_at,updated_at").order("created_at", {
          ascending: false,
        }),
      ]);

      if (!isCurrent) return;

      const error = tasksResult.error ?? notesResult.error;
      if (error) {
        setLoadError(error.message);
        return;
      }

      setTasks(((tasksResult.data ?? []) as unknown as RawTask[]).map(mapTask));
      setNotes((notesResult.data ?? []) as Note[]);
      setLoadError(null);
    }

    loadAuthenticatedData();
    return () => {
      isCurrent = false;
    };
  }, []);

  return (
    <>
      {loadError ? (
        <p className="fixed inset-x-3 top-16 z-50 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Não foi possível carregar seus dados: {loadError}
        </p>
      ) : null}
      <Dashboard
        key={dataVersion(tasks, notes)}
        initialTasks={tasks}
        initialNotes={notes}
      />
    </>
  );
}
