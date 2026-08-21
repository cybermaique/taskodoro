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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import type { Note } from "@/types/note";
import type { Profile, ProfileDisplayMode } from "@/types/profile";
import type { Task, TaskPriority } from "@/types/task";

const APP_TITLE = "Taskboard";
const DEFAULT_CATEGORIES = [
  "trabalho",
  "pessoal",
  "saúde",
  "casa",
  "financeiro",
  "estudo",
  "viagem",
  "conteúdo",
  "outros",
];

function sortByMostRecent(tasks: Task[]) {
  return [...tasks].sort(
    (left, right) =>
      new Date(right.created_at).getTime() -
      new Date(left.created_at).getTime(),
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

  const categorySuggestions = useMemo(() => {
    const fromTasks = tasks
      .map((task) => task.category)
      .filter((category): category is string => Boolean(category));

    return Array.from(new Set([...DEFAULT_CATEGORIES, ...fromTasks]));
  }, [tasks]);

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
    category?: string | null;
    attachments?: File[];
    subtasks?: string[];
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

      setTasks((current) => current.filter((task) => task.id !== taskId));
      toast.success("Tarefa excluída!");
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
            />
          </div>
        </header>

        {errorMessage ? (
          <Alert variant="destructive" className="app-message-enter">
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}
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
                  categorySuggestions={categorySuggestions}
                  onRequestCreate={() => setTaskCreateOpen(true)}
                  onEditDirtyChange={setHasUnsavedTaskEdit}
                  onDeleteTask={deleteTask}
                  onUpdateTask={updateTaskWithBusy}
                  onAddAttachment={addTaskAttachment}
                  onDeleteAttachment={deleteTaskAttachment}
                  onCreateSubtask={createSubtask}
                  onToggleSubtask={toggleSubtask}
                  onDeleteSubtask={deleteSubtask}
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
          <DialogContent className="h-svh max-h-svh w-screen max-w-none overflow-y-auto rounded-none border-slate-900/10 bg-white/95 p-2 dark:border-white/10 dark:bg-zinc-950/95 sm:h-[calc(100svh-1rem)] sm:max-h-none sm:w-[calc(100vw-1rem)] sm:max-w-none sm:rounded-3xl sm:p-4">
            <DialogTitle className="sr-only">Nova tarefa</DialogTitle>
            <DialogDescription className="sr-only">
              Crie uma tarefa com descrição, anexos e subtarefas opcionais.
            </DialogDescription>
            <TaskForm
              isSubmitting={creatingTask}
              isCompact={false}
              categorySuggestions={categorySuggestions}
              onDirtyChange={setHasUnsavedTaskForm}
              onCreate={createTask}
            />
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
      <Icon className="size-4 text-teal-600 dark:text-teal-300" />
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
