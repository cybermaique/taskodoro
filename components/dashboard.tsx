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
import { SoundToggle } from "@/components/sensory-effects";
import { TaskForm } from "@/components/task-form";
import { TasksList } from "@/components/tasks-list";
import { ThemeToggle } from "@/components/theme-toggle";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import type { Note } from "@/types/note";
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
}

type DisplayMode = "full" | "compact";
type DashboardTab = "task-form" | "tasks" | "notes";

export function Dashboard({ initialTasks, initialNotes }: DashboardProps) {
  const [tasks, setTasks] = useState<Task[]>(() =>
    sortByMostRecent(initialTasks),
  );
  const [creatingTask, setCreatingTask] = useState(false);
  const [hasUnsavedTaskForm, setHasUnsavedTaskForm] = useState(false);
  const [hasUnsavedTaskEdit, setHasUnsavedTaskEdit] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const toast = useToast();
  const [displayMode, setDisplayMode] = useState<DisplayMode>(() => {
    if (typeof window === "undefined") {
      return "full";
    }

    return window.localStorage.getItem("taskboard_display_mode") === "compact"
      ? "compact"
      : "full";
  });
  const [selectedTab, setSelectedTab] = useState<DashboardTab>(() => {
    if (typeof window === "undefined") {
      return "tasks";
    }

    const stored = window.localStorage.getItem("taskboard_selected_tab");
    return stored === "task-form" || stored === "tasks" || stored === "notes"
      ? stored
      : "tasks";
  });
  const isCompact = displayMode === "compact";
  const hasUnsavedTaskChanges = hasUnsavedTaskForm || hasUnsavedTaskEdit;

  const categorySuggestions = useMemo(() => {
    const fromTasks = tasks
      .map((task) => task.category)
      .filter((category): category is string => Boolean(category));

    return Array.from(new Set([...DEFAULT_CATEGORIES, ...fromTasks]));
  }, [tasks]);

  useEffect(() => {
    window.localStorage.setItem("taskboard_display_mode", displayMode);
  }, [displayMode]);

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
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Erro ao excluir tarefa.";
      setErrorMessage(msg);
      toast.error(msg);
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
      hasUnsavedTaskChanges &&
      !window.confirm(
        "Você tem alterações não salvas. Deseja continuar mesmo assim?",
      )
    ) {
      return;
    }

    setSelectedTab(nextTab);
  };

  return (
    <main className="app-dashboard-enter relative isolate min-h-svh overflow-x-clip bg-[linear-gradient(180deg,#f7f2e8_0%,#eef4f1_48%,#f7f7fb_100%)] text-slate-950 comfort:bg-[linear-gradient(180deg,#f4ead4_0%,#eee1c5_52%,#f7f0df_100%)] comfort:text-[#463421] dark:bg-[linear-gradient(180deg,#090b0d_0%,#101715_48%,#09090b_100%)] dark:text-white">
      <div className="dashboard-safe-insets app-dashboard-stagger relative z-10 flex w-full min-w-0 flex-col gap-4 sm:gap-6">
        <header
          className={[
            "grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end",
            isCompact ? "gap-0 sm:gap-4" : "",
          ].join(" ")}
        >
          <div className={isCompact ? "hidden" : "min-w-0 space-y-3"}>
            {!isCompact ? (
              <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-slate-900/10 bg-white/70 px-3 py-1 text-[0.68rem] font-semibold uppercase leading-tight text-slate-600 shadow-sm sm:text-xs dark:border-white/10 dark:bg-white/10 dark:text-white/60">
                <ListTodo className="size-3.5" />
                <span className="min-w-0">
                  Organização pessoal e profissional
                </span>
              </div>
            ) : null}
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
              isCompact
                ? "flex w-full items-center justify-end gap-2 sm:hidden"
                : "flex w-full flex-wrap items-center justify-between gap-2 justify-self-start sm:w-auto sm:justify-start lg:justify-self-end",
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
            <div className="flex shrink-0 rounded-full border border-slate-900/10 bg-white/80 p-1 text-sm shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/10">
              <Button
                type="button"
                size="sm"
                variant={displayMode === "full" ? "default" : "ghost"}
                className="h-11 rounded-full px-3 sm:h-8"
                onClick={() => setDisplayMode("full")}
              >
                Completo
              </Button>
              <Button
                type="button"
                size="sm"
                variant={displayMode === "compact" ? "default" : "ghost"}
                className="h-11 rounded-full px-3 sm:h-8"
                onClick={() => setDisplayMode("compact")}
              >
                Compacto
              </Button>
            </div>
            <SoundToggle />
            <ThemeToggle />
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
          className="min-w-0 gap-3 sm:gap-4"
        >
          <TabsList
            className="app-tabs-bar sticky z-30 grid min-h-12 w-full grid-cols-3 justify-stretch rounded-2xl border border-slate-900/10 bg-white/90 p-1 shadow-sm backdrop-blur-xl sm:static sm:min-h-10 sm:justify-start sm:bg-white/70 sm:shadow-none dark:border-white/10 dark:bg-zinc-900/90 sm:dark:bg-white/10"
            style={{ top: "max(0.5rem, var(--safe-area-top))" }}
          >
            <TabsTrigger
              value="task-form"
              aria-label="Nova tarefa"
              className="h-10 min-w-0 rounded-xl px-1 text-xs sm:h-8 sm:px-3 sm:text-sm"
            >
              <CircleDot className="size-4" />
              <span className="sm:hidden">Criar</span>
              <span className="hidden sm:inline">Nova tarefa</span>
            </TabsTrigger>
            <TabsTrigger
              value="tasks"
              aria-label="Tarefas"
              className="h-10 min-w-0 rounded-xl px-1 text-xs sm:h-8 sm:px-3 sm:text-sm"
            >
              <ListTodo className="size-4" />
              <span>Tarefas</span>
            </TabsTrigger>
            <TabsTrigger
              value="notes"
              aria-label="Anotações"
              className="h-10 min-w-0 rounded-xl px-1 text-xs sm:h-8 sm:px-3 sm:text-sm"
            >
              <StickyNote className="size-4" />
              <span className="sm:hidden">Notas</span>
              <span className="hidden sm:inline">Anotações</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="task-form" className="min-w-0">
            <TaskForm
              isSubmitting={creatingTask}
              isCompact={isCompact}
              categorySuggestions={categorySuggestions}
              onDirtyChange={setHasUnsavedTaskForm}
              onCreate={createTask}
            />
          </TabsContent>

          <TabsContent value="tasks" className="min-w-0">
            <section className="min-w-0">
              <div className={isCompact ? "space-y-0" : "space-y-5"}>
                <TasksList
                  tasks={tasks}
                  busyTaskId={busyTaskId}
                  isCompact={isCompact}
                  categorySuggestions={categorySuggestions}
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

          <TabsContent value="notes" className="min-w-0">
            <NotesPanel initialNotes={initialNotes} />
          </TabsContent>
        </Tabs>

        {isCompact ? (
          <div className="mt-2 hidden items-center justify-end gap-2 sm:flex">
            <div className="flex rounded-full border border-slate-900/10 bg-white/80 p-1 text-sm shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/10">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 rounded-full px-3"
                onClick={() => setDisplayMode("full")}
              >
                Completo
              </Button>
              <Button
                type="button"
                size="sm"
                variant="default"
                className="h-8 rounded-full px-3"
                onClick={() => setDisplayMode("compact")}
              >
                Compacto
              </Button>
            </div>
            <SoundToggle />
            <ThemeToggle />
          </div>
        ) : null}
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
    <div className="app-stat-pill hidden items-center gap-2 rounded-full border border-slate-900/10 bg-white/80 px-3 py-2 text-sm shadow-sm backdrop-blur sm:flex dark:border-white/10 dark:bg-white/10">
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
