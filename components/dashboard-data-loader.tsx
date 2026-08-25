"use client";

import { useCallback, useEffect, useState } from "react";

import { Dashboard } from "@/components/dashboard";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { Note } from "@/types/note";
import {
  PROFILE_ACCENTS,
  type Profile,
  type TaskColumnWidths,
} from "@/types/profile";
import type {
  Task,
  TaskAttachment,
  TaskDescriptionHistory,
  TaskStatusHistory,
} from "@/types/task";

const TASK_COLUMNS = `
  id,
  title,
  description,
  status,
  priority,
  type,
  category,
  position,
  deleted_at,
  created_at,
  completed_at,
  updated_at,
  task_attachments(
    id,
    task_id,
    file_name,
    mime_type,
    storage_path,
    file_size,
    last_viewed_at,
    created_at
  ),
  subtasks(
    id,
    task_id,
    title,
    is_completed,
    completed_at,
    position,
    created_at,
    updated_at
  ),
  task_status_history(
    id,
    task_id,
    from_status,
    to_status,
    changed_at
  ),
  task_description_history(
    id,
    task_id,
    description,
    changed_at
  ),
  task_date_details(task_id,age,sign,address,height,work,has_children,location,date_at,personality_rating,face_rating,body_rating,sex_rating),
  task_comments(id,task_id,content,created_at)
  )
`;
const PROFILE_COLUMNS =
  "id,nickname,avatar_url,accent_color,display_mode,task_column_widths,created_at,updated_at";

type RawTask = Task & {
  task_attachments?: TaskAttachment[];
  task_status_history?: TaskStatusHistory[];
  task_description_history?: TaskDescriptionHistory[];
};

function mapTask(task: RawTask): Task {
  return {
    ...task,
    attachments: Array.isArray(task.task_attachments)
      ? task.task_attachments
      : [],
    subtasks: Array.isArray(task.subtasks)
      ? [...task.subtasks].sort(
          (left, right) =>
            left.position - right.position ||
            new Date(left.created_at).getTime() - new Date(right.created_at).getTime(),
        )
      : [],
    status_history: Array.isArray(task.task_status_history)
      ? [...task.task_status_history].sort(
          (left, right) =>
            new Date(left.changed_at).getTime() -
            new Date(right.changed_at).getTime(),
        )
      : Array.isArray(task.status_history)
        ? task.status_history
        : [],
    description_history: Array.isArray(task.task_description_history)
      ? [...task.task_description_history].sort(
          (left, right) =>
            new Date(right.changed_at).getTime() -
            new Date(left.changed_at).getTime(),
        )
      : [],
    date_details: Array.isArray((task as RawTask & { task_date_details?: Task["date_details"][] }).task_date_details)
      ? (task as RawTask & { task_date_details?: Task["date_details"][] }).task_date_details?.[0] ?? null
      : null,
    comments: Array.isArray((task as RawTask & { task_comments?: Task["comments"] }).task_comments)
      ? (task as RawTask & { task_comments: Task["comments"] }).task_comments
      : [],
  };
}

function dataVersion(tasks: Task[], notes: Note[]) {
  return [
    tasks.map((task) => `${task.id}:${task.updated_at}`).join(","),
    notes.map((note) => `${note.id}:${note.updated_at}`).join(","),
  ].join("|");
}

function fallbackNickname(email: string | null) {
  return email?.split("@")[0]?.trim() || "Usuário";
}

function mapTaskColumnWidths(value: unknown): TaskColumnWidths | null {
  if (!value || typeof value !== "object") return null;
  const widths = value as Record<string, unknown>;
  const sections = ["not_started", "in_progress", "waiting", "completed"];
  if (
    !sections.every(
      (section) =>
        typeof widths[section] === "number" &&
        Number.isFinite(widths[section]) &&
        (widths[section] as number) > 0,
    )
  ) {
    return null;
  }

  return {
    not_started: widths.not_started as number,
    in_progress: widths.in_progress as number,
    waiting: widths.waiting as number,
    completed: widths.completed as number,
  };
}

function mapProfile(value: unknown): Profile | null {
  if (!value || typeof value !== "object") return null;
  const profile = value as Partial<Profile>;
  if (
    typeof profile.id !== "string" ||
    typeof profile.created_at !== "string" ||
    typeof profile.updated_at !== "string"
  ) {
    return null;
  }

  return {
    id: profile.id,
    nickname:
      typeof profile.nickname === "string" && profile.nickname.trim()
        ? profile.nickname.trim()
        : "Usuário",
    avatar_url: typeof profile.avatar_url === "string" ? profile.avatar_url : null,
    accent_color: PROFILE_ACCENTS.includes(profile.accent_color as Profile["accent_color"])
      ? (profile.accent_color as Profile["accent_color"])
      : "teal",
    display_mode: profile.display_mode === "compact" ? "compact" : "full",
    task_column_widths: mapTaskColumnWidths(profile.task_column_widths),
    created_at: profile.created_at,
    updated_at: profile.updated_at,
  };
}

interface DashboardDataLoaderProps {
  initialTasks: Task[];
  initialNotes: Note[];
  initialProfile?: Profile | null;
}

export function DashboardDataLoader({
  initialTasks,
  initialNotes,
  initialProfile = null,
}: DashboardDataLoaderProps) {
  const [tasks, setTasks] = useState(initialTasks);
  const [notes, setNotes] = useState(initialNotes);
  const [profile, setProfile] = useState<Profile | null>(initialProfile);
  const [userEmail, setUserEmail] = useState<string | null>(null);
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

      const sessionUser = sessionData.session.user;
      setUserEmail(sessionUser.email ?? null);

      const [tasksResult, notesResult, profileResult] = await Promise.all([
        supabase
          .from("tasks")
          .select(TASK_COLUMNS)
          .is("deleted_at", null)
          .order("position", { ascending: true })
          .order("position", { foreignTable: "subtasks", ascending: true }),
        supabase.from("notes").select("id,title,content,tags,is_pinned,deleted_at,created_at,updated_at,note_attachments(id,note_id,file_name,mime_type,storage_path,file_size,created_at)").is("deleted_at", null).order("created_at", {
          ascending: false,
        }),
        supabase
          .from("profiles")
          .select(PROFILE_COLUMNS)
          .eq("id", sessionUser.id)
          .maybeSingle(),
      ]);

      if (!isCurrent) return;

      const error = tasksResult.error ?? notesResult.error;
      if (error) {
        setLoadError(error.message);
        return;
      }

      setTasks(((tasksResult.data ?? []) as unknown as RawTask[]).map(mapTask));
      setNotes(
        ((notesResult.data ?? []) as unknown as Array<
          Note & { note_attachments?: Note["attachments"] }
        >).map((note) => ({ ...note, attachments: note.note_attachments ?? [] })),
      );

      let nextProfile = profileResult.error
        ? null
        : mapProfile(profileResult.data);
      if (!nextProfile && !profileResult.error) {
        const { data: createdProfile } = await supabase
          .from("profiles")
          .insert({
            id: sessionUser.id,
            nickname: fallbackNickname(sessionUser.email ?? null),
          })
          .select(PROFILE_COLUMNS)
          .single();
        nextProfile = mapProfile(createdProfile);
      }
      setProfile(nextProfile);
      setLoadError(null);
    }

    loadAuthenticatedData();
    return () => {
      isCurrent = false;
    };
  }, []);

  const saveProfilePreferences = useCallback(
    async (
      updates: Partial<
        Pick<Profile, "display_mode" | "task_column_widths">
      >,
    ) => {
      if (!profile) return;

      const { data, error } = await createSupabaseBrowserClient()
        .from("profiles")
        .update(updates)
        .eq("id", profile.id)
        .select(PROFILE_COLUMNS)
        .single();

      if (error || !data) {
        setLoadError(error?.message ?? "Não foi possível salvar as preferências.");
        return;
      }

      const nextProfile = mapProfile(data);
      if (nextProfile) setProfile(nextProfile);
    },
    [profile],
  );

  return (
    <>
      {loadError ? (
        <p className="app-message-enter fixed inset-x-3 top-16 z-50 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Não foi possível carregar seus dados: {loadError}
        </p>
      ) : null}
      <Dashboard
        key={dataVersion(tasks, notes)}
        initialTasks={tasks}
        initialNotes={notes}
        profile={profile}
        userEmail={userEmail}
        onProfileChange={setProfile}
        onProfilePreferenceChange={saveProfilePreferences}
      />
    </>
  );
}
