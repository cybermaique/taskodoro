"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import confetti from "canvas-confetti";
import {
  CheckCircle2,
  CircleDot,
  ListTodo,
  StickyNote,
} from "lucide-react";

import { NotesPanel } from "@/components/notes-panel";
import { ProfileSettings } from "@/components/profile-settings";
import { TaskForm } from "@/components/task-form";
import { TasksList } from "@/components/tasks-list";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { formatDateTime } from "@/lib/format";
import type { Note } from "@/types/note";
import type { Profile, ProfileDisplayMode } from "@/types/profile";
import type { DateDetails, Task, TaskPriority, TaskType } from "@/types/task";

const APP_TITLE = "Taskboard";
function sortByMostRecent(tasks: Task[]) {
  return [...tasks].sort(
    (left, right) =>
      left.position - right.position ||
      new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
  );
}
function upsertTask(tasks: Task[], nextTask: Task) {
  const exists = tasks.some((task) => task.id === nextTask.id);
  const updated = exists
    ? tasks.map((task) => (task.id === nextTask.id ? nextTask : task))
    : [nextTask, ...tasks];

  return sortByMostRecent(updated);
}

interface DashboardProps {
  initialTasks: Task[];
  initialNotes: Note[];
  profile: Profile | null;
  userEmail: string | null;
  onProfileChange: (profile: Profile) => void;
  onProfilePreferenceChange: (
    updates: Partial<Pick<Profile, "display_mode" | "task_column_widths">>,
  ) => Promise<void>;
}

type DashboardTab = "tasks" | "notes";

type PendingConfirmation =
  | { kind: "switch-tab"; tab: DashboardTab }
  | { kind: "close-task-create" };

export function Dashboard({
  initialTasks,
  initialNotes,
  profile,
  userEmail,
  onProfileChange,
  onProfilePreferenceChange,
}: DashboardProps) {
  const [tasks, setTasks] = useState<Task[]>(() =>
    sortByMostRecent(initialTasks),
  );
  const [creatingTask, setCreatingTask] = useState(false);
  const [taskCreateOpen, setTaskCreateOpen] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] =
    useState<PendingConfirmation | null>(null);
  const [newlyCreatedTaskId, setNewlyCreatedTaskId] = useState<string | null>(
    null,
  );
  const [hasUnsavedTaskForm, setHasUnsavedTaskForm] = useState(false);
  const [hasUnsavedTaskEdit, setHasUnsavedTaskEdit] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastDeletedTask, setLastDeletedTask] = useState<Task | null>(null);
  const [trashedTasks, setTrashedTasks] = useState<Task[]>([]);
  const [trashedNotes, setTrashedNotes] = useState<Note[]>([]);
  const [trashOpen, setTrashOpen] = useState(false);
  const toast = useToast();
  const [displayMode, setDisplayMode] = useState<ProfileDisplayMode>("full");
  const [selectedTab, setSelectedTab] = useState<DashboardTab>(() => {
    if (typeof window === "undefined") {
      return "tasks";
    }

    const stored = window.localStorage.getItem("taskboard_selected_tab");
    return stored === "tasks" || stored === "notes"
      ? stored
      : "tasks";
  });
  const isCompact = displayMode === "compact";
  const hasUnsavedTaskChanges = hasUnsavedTaskForm || hasUnsavedTaskEdit;
  const greetedProfileIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!profile) return;

    const timeoutId = window.setTimeout(() => {
      setDisplayMode(profile.display_mode);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [profile]);

  useEffect(() => {
    const accent = profile?.accent_color ?? "teal";
    document.documentElement.dataset.profileAccent = accent;

    return () => {
      document.documentElement.dataset.profileAccent = "teal";
    };
  }, [profile?.accent_color]);

  useEffect(() => {
    if (!profile || greetedProfileIdRef.current === profile.id) return;
    greetedProfileIdRef.current = profile.id;

    const greetingKey = `taskboard_greeting_seen:${profile.id}`;
    if (window.sessionStorage.getItem(greetingKey) === "true") return;

    window.sessionStorage.setItem(greetingKey, "true");
    toast.success(`Bom te ver, ${profile.nickname}!`);
  }, [profile, toast]);

  useEffect(() => {
    if (!hasUnsavedTaskChanges) return;

    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [hasUnsavedTaskChanges]);

  useEffect(() => {
    window.localStorage.setItem("taskboard_selected_tab", selectedTab);
  }, [selectedTab]);

  useEffect(() => {
    if (!newlyCreatedTaskId) return;

    const timeoutId = window.setTimeout(() => {
      setNewlyCreatedTaskId(null);
    }, 2800);

    return () => window.clearTimeout(timeoutId);
  }, [newlyCreatedTaskId]);

  const dashboardStats = useMemo(() => {
    const notStarted = tasks.filter(
      (task) => task.status === "not_started",
    ).length;
    const completed = tasks.filter(
      (task) => task.status === "completed",
    ).length;

    return {
      notStarted,
      completed,
    };
  }, [tasks]);

  const createTask = async (values: {
    title: string;
    description?: string;
    priority?: TaskPriority;
    type?: TaskType;
    category?: string | null;
    attachments?: File[];
    subtasks?: string[];
    date_details?: Partial<Omit<DateDetails, "task_id">>;
  }) => {
    setCreatingTask(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const data = (await response.json()) as { task?: Task; error?: string };

      if (!response.ok || !data.task) {
        throw new Error(data.error ?? "Não foi possível criar a tarefa.");
      }

      let createdTask = data.task as Task;
      for (const attachment of values.attachments ?? []) {
        const formData = new FormData();
        formData.append("file", attachment);
        const uploadResponse = await fetch(
          `/api/tasks/${createdTask.id}/attachments`,
          {
            method: "POST",
            body: formData,
          },
        );
        const uploadData = (await uploadResponse.json()) as {
          task?: Task;
          error?: string;
        };
        if (!uploadResponse.ok || !uploadData.task) {
          throw new Error(
            uploadData.error ??
              "A tarefa foi criada, mas não foi possível anexar um arquivo.",
          );
        }
        createdTask = uploadData.task;
      }

      setTasks((current) => upsertTask(current, createdTask));
      setNewlyCreatedTaskId(createdTask.id);
      setSelectedTab("tasks");
      setTaskCreateOpen(false);
      toast.success("Tarefa criada com sucesso!");
    } finally {
      setCreatingTask(false);
    }
  };

  const updateTask = async (
    taskId: string,
    payload: Record<string, unknown>,
  ) => {
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as { task?: Task; error?: string };

    if (!response.ok || !data.task) {
      throw new Error(data.error ?? "Não foi possível atualizar a tarefa.");
    }

    setTasks((current) => upsertTask(current, data.task as Task));

  };

  const updateTaskWithBusy = async (
    taskId: string,
    payload: Record<string, unknown>,
  ) => {
    setBusyTaskId(taskId);
    setErrorMessage(null);

    try {
      await updateTask(taskId, payload);
      toast.success("Tarefa atualizada!");
      return true;
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Erro ao atualizar tarefa.";
      setErrorMessage(msg);
      toast.error(msg);
      return false;
    } finally {
      setBusyTaskId(null);
    }
  };

  const deleteTask = async (taskId: string) => {
    setBusyTaskId(taskId);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Não foi possível excluir a tarefa.");
      }

      setLastDeletedTask(tasks.find((task) => task.id === taskId) ?? null);
      setTasks((current) => current.filter((task) => task.id !== taskId));
      toast.success("Tarefa movida para a lixeira!");
      return true;
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Erro ao excluir tarefa.";
      setErrorMessage(msg);
      toast.error(msg);
      return false;
    } finally {
      setBusyTaskId(null);
    }
  };

  const addTaskAttachment = async (taskId: string, file: File) => {
    setBusyTaskId(taskId);
    setErrorMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`/api/tasks/${taskId}/attachments`, {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as { task?: Task; error?: string };
      if (!response.ok || !data.task)
        throw new Error(data.error ?? "Não foi possível anexar a imagem.");
      setTasks((current) => upsertTask(current, data.task as Task));
      toast.success("Arquivo anexado!");
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Erro ao anexar imagem.";
      setErrorMessage(msg);
      toast.error(msg);
      throw error;
    } finally {
      setBusyTaskId(null);
    }
  };

  const deleteTaskAttachment = async (taskId: string, attachmentId: string) => {
    setBusyTaskId(taskId);
    setErrorMessage(null);
    try {
      const response = await fetch(
        `/api/tasks/${taskId}/attachments/${attachmentId}`,
        { method: "DELETE" },
      );
      const data = (await response.json()) as { task?: Task; error?: string };
      if (!response.ok || !data.task)
        throw new Error(data.error ?? "Não foi possível excluir a imagem.");
      setTasks((current) => upsertTask(current, data.task as Task));
      toast.success("Anexo removido!");
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Erro ao excluir imagem.";
      setErrorMessage(msg);
      toast.error(msg);
      throw error;
    } finally {
      setBusyTaskId(null);
    }
  };

  const createSubtask = async (taskId: string, title: string) => {
    setBusyTaskId(taskId);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/tasks/${taskId}/subtasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title }),
      });

      const data = (await response.json()) as { task?: Task; error?: string };

      if (!response.ok || !data.task) {
        throw new Error(data.error ?? "Não foi possível criar a subtarefa.");
      }

      setTasks((current) => upsertTask(current, data.task as Task));
      toast.success("Subtarefa criada!");
      return true;
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Erro ao criar subtarefa.";
      setErrorMessage(msg);
      toast.error(msg);
      return false;
    } finally {
      setBusyTaskId(null);
    }
  };

  const toggleSubtask = async (subtaskId: string, isCompleted: boolean) => {
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/subtasks/${subtaskId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ is_completed: isCompleted }),
      });

      const data = (await response.json()) as { task?: Task; error?: string };

      if (!response.ok || !data.task) {
        throw new Error(
          data.error ?? "Não foi possível atualizar a subtarefa.",
        );
      }

      setTasks((current) => upsertTask(current, data.task as Task));
      const completedAllSubtasks =
        isCompleted &&
        data.task.subtasks.length > 0 &&
        data.task.subtasks.every((subtask) => subtask.is_completed);
      if (completedAllSubtasks) {
        toast.success("Todas as subtarefas concluídas! ✨");
        void confetti({
          particleCount: 58,
          spread: 78,
          startVelocity: 34,
          gravity: 0.75,
          scalar: 0.82,
          origin: { x: 0.5, y: 0.7 },
          colors: ["#2dd4bf", "#34d399", "#facc15", "#818cf8"],
          disableForReducedMotion: false,
          zIndex: 120,
        });
      }
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Erro ao atualizar subtarefa.";
      setErrorMessage(msg);
      toast.error(msg);
    }
  };

  const deleteSubtask = async (subtaskId: string) => {
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/subtasks/${subtaskId}`, {
        method: "DELETE",
      });

      const data = (await response.json()) as { task?: Task; error?: string };

      if (!response.ok || !data.task) {
        throw new Error(data.error ?? "Não foi possível excluir a subtarefa.");
      }

      setTasks((current) => upsertTask(current, data.task as Task));
      toast.success("Subtarefa excluída!");
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Erro ao excluir subtarefa.";
      setErrorMessage(msg);
      toast.error(msg);
    }
  };

  const handleTabChange = (value: string) => {
    const nextTab = value as DashboardTab;
    if (
      nextTab !== selectedTab &&
      hasUnsavedTaskChanges
    ) {
      setPendingConfirmation({ kind: "switch-tab", tab: nextTab });
      return;
    }

    setSelectedTab(nextTab);
  };

  const restoreDeletedTask = async () => {
    if (!lastDeletedTask) return;
    const response = await fetch(`/api/tasks/${lastDeletedTask.id}/restore`, { method: "POST" });
    const data = (await response.json()) as { task?: Task; error?: string };
    if (!response.ok || !data.task) { toast.error(data.error ?? "Não foi possível restaurar a tarefa."); return; }
    setTasks((current) => upsertTask(current, data.task as Task));
    setLastDeletedTask(null);
    toast.success("Tarefa restaurada!");
  };

  const openTrash = async () => {
    const response = await fetch("/api/trash");
    const data = (await response.json()) as { tasks?: Task[]; notes?: Note[]; error?: string };
    if (!response.ok || !data.tasks || !data.notes) { toast.error(data.error ?? "Não foi possível abrir a lixeira."); return; }
    setTrashedTasks(data.tasks); setTrashedNotes(data.notes); setTrashOpen(true);
  };

  const restoreNoteFromTrash = async (noteId: string) => {
    const response = await fetch(`/api/notes/${noteId}/restore`, { method: "POST" });
    const data = (await response.json()) as { note?: Note; error?: string };
    if (!response.ok || !data.note) { toast.error(data.error ?? "Não foi possível restaurar a anotação."); return; }
    setTrashedNotes((current) => current.filter((note) => note.id !== noteId));
    toast.success("Anotação restaurada!");
    window.location.reload();
  };

  const restoreFromTrash = async (taskId: string) => {
    const response = await fetch(`/api/tasks/${taskId}/restore`, { method: "POST" });
    const data = (await response.json()) as { task?: Task; error?: string };
    if (!response.ok || !data.task) { toast.error(data.error ?? "Não foi possível restaurar a tarefa."); return; }
    setTasks((current) => upsertTask(current, data.task as Task));
    setTrashedTasks((current) => current.filter((task) => task.id !== taskId));
    setLastDeletedTask((current) => current?.id === taskId ? null : current);
    toast.success("Tarefa restaurada!");
  };

  const renameSubtask = async (subtaskId: string, title: string) => {
    const response = await fetch(`/api/subtasks/${subtaskId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
    const data = (await response.json()) as { task?: Task; error?: string };
    if (!response.ok || !data.task) throw new Error(data.error ?? "Não foi possível editar a subtarefa.");
    setTasks((current) => upsertTask(current, data.task as Task));
  };

  const restoreTaskDescription = async (taskId: string, historyId: string) => {
    setBusyTaskId(taskId);
    setErrorMessage(null);

    try {
      const response = await fetch(
        `/api/tasks/${taskId}/description-history/${historyId}/restore`,
        { method: "POST" },
      );
      const data = (await response.json()) as { task?: Task; error?: string };

      if (!response.ok || !data.task) {
        throw new Error(data.error ?? "Não foi possível restaurar a descrição.");
      }

      setTasks((current) => upsertTask(current, data.task as Task));
      toast.success("Descrição restaurada!");
      return true;
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Erro ao restaurar descrição.";
      setErrorMessage(msg);
      toast.error(msg);
      return false;
    } finally {
      setBusyTaskId(null);
    }
  };

  const reorderSubtasks = async (
    taskId: string,
    subtaskIds: string[],
  ): Promise<boolean> => {
    setBusyTaskId(taskId);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/tasks/${taskId}/subtasks/reorder`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ subtask_ids: subtaskIds }),
      });
      const data = (await response.json()) as { task?: Task; error?: string };

      if (!response.ok || !data.task) {
        throw new Error(data.error ?? "Não foi possível reordenar as subtarefas.");
      }

      setTasks((current) => upsertTask(current, data.task as Task));
      return true;
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message
          : "Erro ao reordenar subtarefas.";
      setErrorMessage(msg);
      toast.error(msg);
      return false;
    } finally {
      setBusyTaskId(null);
    }
  };

  const reorderTasks = async (taskIds: string[]) => {
    const response = await fetch("/api/tasks/reorder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task_ids: taskIds }) });
    const data = (await response.json()) as { tasks?: Task[]; error?: string };
    if (!response.ok || !data.tasks) throw new Error(data.error ?? "Não foi possível ordenar as tarefas.");
    setTasks(data.tasks);
  };

  const addTaskComment = async (taskId: string, content: string) => {
    const response = await fetch(`/api/tasks/${taskId}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) });
    const data = (await response.json()) as { task?: Task; error?: string };
    if (!response.ok || !data.task) throw new Error(data.error ?? "Não foi possível adicionar o comentário.");
    setTasks((current) => upsertTask(current, data.task as Task));
  };

  const removeTaskComment = async (taskId: string, commentId: string) => {
    const response = await fetch(`/api/tasks/${taskId}/comments/${commentId}`, { method: "DELETE" });
    const data = (await response.json()) as { task?: Task; error?: string };
    if (!response.ok || !data.task) throw new Error(data.error ?? "Não foi possível excluir o comentário.");
    setTasks((current) => upsertTask(current, data.task as Task));
  };

  const handleTaskCreateDialogChange = (open: boolean) => {
    if (!open && hasUnsavedTaskForm) {
      setPendingConfirmation({ kind: "close-task-create" });
      return;
    }

    setTaskCreateOpen(open);
  };

  const confirmPendingAction = () => {
    if (!pendingConfirmation) return;

    if (pendingConfirmation.kind === "switch-tab") {
      setHasUnsavedTaskForm(false);
      setHasUnsavedTaskEdit(false);
      setSelectedTab(pendingConfirmation.tab);
      if (taskCreateOpen) setTaskCreateOpen(false);
      return;
    }

    setHasUnsavedTaskForm(false);
    setTaskCreateOpen(false);
  };

  return (
    <main className="app-dashboard-enter relative isolate min-h-svh overflow-x-clip bg-[linear-gradient(180deg,#f7f2e8_0%,#eef4f1_48%,#f7f7fb_100%)] text-slate-950 comfort:bg-[linear-gradient(180deg,#f4ead4_0%,#eee1c5_52%,#f7f0df_100%)] comfort:text-[#463421] dark:bg-[linear-gradient(180deg,#090b0d_0%,#101715_48%,#09090b_100%)] dark:text-white">
      <div className="dashboard-boot-layer" aria-hidden="true">
        <span className="dashboard-boot-orb dashboard-boot-orb-primary" />
        <span className="dashboard-boot-orb dashboard-boot-orb-secondary" />
        <span className="dashboard-boot-scan" />
      </div>
      <div className="dashboard-safe-insets app-dashboard-stagger relative z-10 flex w-full min-w-0 flex-col gap-4 sm:gap-6">
        <header
          className={[
            "dashboard-reveal-header grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end",
            isCompact ? "gap-0 sm:gap-4" : "",
          ].join(" ")}
        >
          <div
            className={
              isCompact
                ? "hidden"
                : "dashboard-reveal-brand min-w-0 space-y-3"
            }
          >
            <div>
              {!isCompact ? (
                <h1 className="break-words text-3xl font-semibold leading-none sm:text-4xl md:text-5xl">
                  {APP_TITLE}
                </h1>
              ) : null}
              {!isCompact ? (
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-white/55">
                  Organize prioridades, quebre tarefas em passos menores e
                  mantenha suas anotações sempre à mão.
                </p>
              ) : null}
            </div>
          </div>

          <div
            className={[
              "dashboard-reveal-account flex w-full flex-wrap items-center justify-between gap-2 justify-self-start sm:w-auto sm:justify-start lg:justify-self-end",
            ].join(" ")}
          >
            {!isCompact ? (
              <>
                <StatPill
                  icon={CircleDot}
                  label="Não iniciadas"
                  value={dashboardStats.notStarted}
                />
                <StatPill
                  icon={CheckCircle2}
                  label="Feitas"
                  value={dashboardStats.completed}
                />
              </>
            ) : null}
            <ProfileSettings
              key={profile?.id ?? "profile-loading"}
              profile={profile}
              userEmail={userEmail}
              onProfileChange={onProfileChange}
              displayMode={displayMode}
              onDisplayModeChange={(mode) => {
                setDisplayMode(mode);
                void onProfilePreferenceChange({ display_mode: mode });
              }}
              onOpenTrash={() => void openTrash()}
            />
          </div>
        </header>

        {errorMessage ? (
          <Alert variant="destructive" className="app-message-enter">
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}
        {lastDeletedTask ? (
          <Alert className="border-teal-500/30 bg-teal-500/10">
            <AlertTitle>Tarefa na lixeira</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center gap-2">{lastDeletedTask.title}<Button size="sm" variant="outline" onClick={() => void restoreDeletedTask()}>Desfazer</Button></AlertDescription>
          </Alert>
        ) : null}
        <Dialog open={trashOpen} onOpenChange={setTrashOpen}>
          <DialogContent className="max-w-lg"><DialogTitle>Lixeira</DialogTitle><DialogDescription>Restaure tarefas e anotações quando precisar.</DialogDescription>
            <div className="max-h-80 space-y-3 overflow-y-auto">
              {trashedTasks.length ? <section><p className="mb-1 text-xs font-semibold uppercase text-slate-500">Tarefas</p>{trashedTasks.map((task) => <div key={task.id} className="mb-2 flex items-center gap-2 rounded-xl border p-2"><span className="min-w-0 flex-1"><span className="block truncate">{task.title}</span><span className="block text-xs text-slate-500 dark:text-white/45">Excluída em {formatDateTime(task.deleted_at)}</span></span><Button size="sm" onClick={() => void restoreFromTrash(task.id)}>Restaurar</Button></div>)}</section> : null}
              {trashedNotes.length ? <section><p className="mb-1 text-xs font-semibold uppercase text-slate-500">Anotações</p>{trashedNotes.map((note) => <div key={note.id} className="mb-2 flex items-center gap-2 rounded-xl border p-2"><span className="min-w-0 flex-1"><span className="block truncate">{note.title}</span><span className="block text-xs text-slate-500 dark:text-white/45">Excluída em {formatDateTime(note.deleted_at)}</span></span><Button size="sm" onClick={() => void restoreNoteFromTrash(note.id)}>Restaurar</Button></div>)}</section> : null}
              {!trashedTasks.length && !trashedNotes.length ? <p className="text-sm text-slate-500">A lixeira está vazia.</p> : null}
            </div>
          </DialogContent>
        </Dialog>
        <Tabs
          value={selectedTab}
          onValueChange={handleTabChange}
          className="dashboard-reveal-tabs min-w-0 gap-3 sm:gap-4"
        >
          <TabsList
            className="app-tabs-bar app-tabs-live sticky z-30 grid min-h-12 w-full grid-cols-2 justify-stretch rounded-2xl border border-slate-900/10 bg-white/90 p-1 shadow-sm backdrop-blur-xl sm:static sm:min-h-10 sm:justify-start sm:bg-white/70 sm:shadow-none dark:border-white/10 dark:bg-zinc-900/90 sm:dark:bg-white/10"
            style={{ top: "max(0.5rem, var(--safe-area-top))" }}
          >
            <TabsTrigger
              value="tasks"
              aria-label="Tarefas"
              className="app-tab-live-trigger h-10 min-w-0 rounded-xl px-1 text-xs sm:h-8 sm:px-3 sm:text-sm"
            >
              <ListTodo className="size-4" />
              <span>Tarefas</span>
            </TabsTrigger>
            <TabsTrigger
              value="notes"
              aria-label="Anotações"
              className="app-tab-live-trigger h-10 min-w-0 rounded-xl px-1 text-xs sm:h-8 sm:px-3 sm:text-sm"
            >
              <StickyNote className="size-4" />
              <span className="sm:hidden">Notas</span>
              <span className="hidden sm:inline">Anotações</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="dashboard-scene min-w-0">
            <section className="min-w-0">
              <div className={isCompact ? "space-y-0" : "space-y-5"}>
                <TasksList
                  tasks={tasks}
                  newlyCreatedTaskId={newlyCreatedTaskId}
                  busyTaskId={busyTaskId}
                  isCompact={isCompact}
                  initialColumnWidths={profile?.task_column_widths ?? null}
                  onColumnWidthsChange={(widths) =>
                    onProfilePreferenceChange({ task_column_widths: widths })
                  }
                  onRequestCreate={() => setTaskCreateOpen(true)}
                  onEditDirtyChange={setHasUnsavedTaskEdit}
                  onDeleteTask={deleteTask}
                  onUpdateTask={updateTaskWithBusy}
                  onRestoreTaskDescription={restoreTaskDescription}
                  onAddAttachment={addTaskAttachment}
                  onDeleteAttachment={deleteTaskAttachment}
                  onCreateSubtask={createSubtask}
                  onToggleSubtask={toggleSubtask}
                  onRenameSubtask={renameSubtask}
                  onDeleteSubtask={deleteSubtask}
                  onReorderSubtasks={reorderSubtasks}
                  onReorderTasks={reorderTasks}
                  onAddTaskComment={addTaskComment}
                  onDeleteTaskComment={removeTaskComment}
                />
              </div>
            </section>
          </TabsContent>

          <TabsContent value="notes" className="dashboard-scene min-w-0">
            <NotesPanel initialNotes={initialNotes} />
          </TabsContent>
        </Tabs>

        <Dialog
          open={taskCreateOpen}
          onOpenChange={handleTaskCreateDialogChange}
        >
          <DialogContent className="grid h-svh max-h-svh w-screen max-w-none grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden rounded-none border-slate-900/10 bg-white/95 p-4 pt-16 dark:border-white/10 dark:bg-zinc-950/95 sm:h-[calc(100svh-1rem)] sm:max-h-none sm:w-[calc(100vw-1rem)] sm:max-w-none sm:rounded-3xl sm:px-4 sm:pb-4 sm:pt-16">
            <DialogTitle className="sr-only">Nova tarefa</DialogTitle>
            <DialogDescription className="sr-only">
              Crie uma tarefa com descrição, anexos e subtarefas opcionais.
            </DialogDescription>
            <div className="min-h-0 overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable]">
              <TaskForm
                isSubmitting={creatingTask}
                isCompact={false}
                onDirtyChange={setHasUnsavedTaskForm}
                onCreate={createTask}
              />
            </div>
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          open={pendingConfirmation !== null}
          onOpenChange={(open) => {
            if (!open) setPendingConfirmation(null);
          }}
          title={
            pendingConfirmation?.kind === "close-task-create"
              ? "Fechar criação da tarefa?"
              : "Alterações não salvas"
          }
          description={
            pendingConfirmation?.kind === "close-task-create"
              ? "Você tem uma tarefa em edição. Deseja fechar e descartar o rascunho?"
              : "Você tem alterações não salvas nesta tarefa. Deseja sair mesmo assim e descartá-las?"
          }
          confirmLabel={
            pendingConfirmation?.kind === "close-task-create"
              ? "Descartar rascunho"
              : "Sair sem salvar"
          }
          cancelLabel="Continuar editando"
          onConfirm={confirmPendingAction}
        />

      </div>
    </main>
  );
}

function StatPill({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ListTodo;
  label: string;
  value: number;
}) {
  return (
    <div className="app-stat-pill app-stat-live hidden items-center gap-2 rounded-full border border-slate-900/10 bg-white/80 px-3 py-2 text-sm shadow-sm backdrop-blur sm:flex dark:border-white/10 dark:bg-white/10">
      <Icon className="size-4 text-[var(--profile-accent)]" />
      <span className="text-slate-500 dark:text-white/55">{label}</span>
      <AnimatedNumber value={value} />
    </div>
  );
}

function AnimatedNumber({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(value);
  const previousValueRef = useRef(value);

  useEffect(() => {
    const from = previousValueRef.current;
    previousValueRef.current = value;
    if (from === value) return;

    const startedAt = performance.now();
    let frameId = 0;
    const animate = (now: number) => {
      const progress = Math.min((now - startedAt) / 520, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(from + (value - from) * eased));
      if (progress < 1) frameId = window.requestAnimationFrame(animate);
    };

    frameId = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frameId);
  }, [value]);

  return (
    <strong key={value} className="app-stat-number tabular-nums">
      {displayValue}
    </strong>
  );
}
