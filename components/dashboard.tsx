"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BellRing,
  CheckCircle2,
  CircleDot,
  ListTodo,
  MoveRight,
  Target,
} from "lucide-react";

import { PomodoroPanel } from "@/components/pomodoro-panel";
import { TaskForm } from "@/components/task-form";
import { TasksList } from "@/components/tasks-list";
import { ThemeToggle } from "@/components/theme-toggle";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePomodoro } from "@/hooks/use-pomodoro";
import type { PomodoroPhase } from "@/types/pomodoro";
import type { Task, TaskPriority, TaskRecurrence } from "@/types/task";

const APP_TITLE = "Taskodoro";
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

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDaysKey(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() + diff);
  return next;
}

function formatFocusTime(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

function playAlertTone() {
  if (typeof window === "undefined") {
    return;
  }

  const Context =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  if (!Context) {
    return;
  }

  const context = new Context();
  const duration = 0.18;

  [0, 0.25, 0.5].forEach((offset, index) => {
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = index === 2 ? 680 : 520;

    gainNode.gain.setValueAtTime(0.001, context.currentTime + offset);
    gainNode.gain.exponentialRampToValueAtTime(
      0.25,
      context.currentTime + offset + 0.02,
    );
    gainNode.gain.exponentialRampToValueAtTime(
      0.001,
      context.currentTime + offset + duration,
    );

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    oscillator.start(context.currentTime + offset);
    oscillator.stop(context.currentTime + offset + duration);
  });
}

function phaseText(phase: PomodoroPhase) {
  return phase === "focus" ? "foco" : "descanso";
}

interface DashboardProps {
  initialTasks: Task[];
}

type DisplayMode = "full" | "compact";
type DashboardTab = "task-form" | "execution";

export function Dashboard({ initialTasks }: DashboardProps) {
  const [tasks, setTasks] = useState<Task[]>(() => sortByMostRecent(initialTasks));
  const [creatingTask, setCreatingTask] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completionMessage, setCompletionMessage] = useState<string | null>(null);
  const [isBlinkingTitle, setIsBlinkingTitle] = useState(false);
  const [focusModeOpen, setFocusModeOpen] = useState(false);
  const [displayMode, setDisplayMode] = useState<DisplayMode>(() => {
    if (typeof window === "undefined") {
      return "full";
    }

    return window.localStorage.getItem("taskodoro_display_mode") === "compact"
      ? "compact"
      : "full";
  });
  const [selectedTab, setSelectedTab] = useState<DashboardTab>(() => {
    if (typeof window === "undefined") {
      return "task-form";
    }

    return window.localStorage.getItem("taskodoro_selected_tab") === "execution"
      ? "execution"
      : "task-form";
  });
  const selectedTaskIdRef = useRef<string | null>(null);
  const isCompact = displayMode === "compact";

  const categorySuggestions = useMemo(() => {
    const fromTasks = tasks
      .map((task) => task.category)
      .filter((category): category is string => Boolean(category));

    return Array.from(new Set([...DEFAULT_CATEGORIES, ...fromTasks]));
  }, [tasks]);

  const recordFocusCycle = useCallback(
    async (taskId: string, durationSeconds: number, completedCycle: boolean) => {
      const response = await fetch(`/api/tasks/${taskId}/focus-sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          duration_seconds: durationSeconds,
          completed_cycle: completedCycle,
        }),
      });

      const data = (await response.json()) as { task?: Task; error?: string };

      if (!response.ok || !data.task) {
        throw new Error(data.error ?? "Não foi possível registrar o foco.");
      }

      setTasks((current) => upsertTask(current, data.task as Task));
    },
    [],
  );

  const onPhaseFinished = useCallback(
    (finishedPhase: PomodoroPhase, nextPhase: PomodoroPhase, durationSeconds: number) => {
      const message =
        finishedPhase === "focus"
          ? "Foco concluído! Hora de fazer uma pausa curta."
          : "Pausa concluída! Pronto para voltar ao foco.";

      setCompletionMessage(message);
      setIsBlinkingTitle(true);
      playAlertTone();

      if (finishedPhase === "focus" && selectedTaskIdRef.current) {
        recordFocusCycle(selectedTaskIdRef.current, durationSeconds, true).catch((error) => {
          setErrorMessage(
            error instanceof Error ? error.message : "Erro ao registrar sessão de foco.",
          );
        });
      }

      if (typeof window !== "undefined" && "Notification" in window) {
        const notify = () => {
          new window.Notification("Pomodoro", {
            body: `Ciclo de ${phaseText(finishedPhase)} finalizado. Próximo: ${phaseText(nextPhase)}.`,
          });
        };

        if (window.Notification.permission === "granted") {
          notify();
        } else if (window.Notification.permission === "default") {
          window.Notification.requestPermission().then((permission) => {
            if (permission === "granted") {
              notify();
            }
          });
        }
      }
    },
    [recordFocusCycle],
  );

  const pomodoro = usePomodoro({ onPhaseFinished });

  useEffect(() => {
    selectedTaskIdRef.current = pomodoro.selectedTaskId;
  }, [pomodoro.selectedTaskId]);

  useEffect(() => {
    window.localStorage.setItem("taskodoro_display_mode", displayMode);
  }, [displayMode]);

  useEffect(() => {
    window.localStorage.setItem("taskodoro_selected_tab", selectedTab);
  }, [selectedTab]);

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === pomodoro.selectedTaskId) ?? null,
    [pomodoro.selectedTaskId, tasks],
  );

  const dashboardStats = useMemo(() => {
    const todayKey = toDateKey(new Date());
    const weekStart = startOfWeek(new Date());
    const pending = tasks.filter((task) => task.status === "pending").length;
    const inProgress = tasks.filter((task) => task.status === "in_progress").length;
    const completed = tasks.filter((task) => task.status === "completed").length;
    const overdue = tasks.filter(
      (task) =>
        task.status !== "completed" &&
        task.status !== "canceled" &&
        task.due_date &&
        task.due_date < todayKey,
    ).length;
    const completedToday = tasks.filter(
      (task) =>
        task.status === "completed" &&
        task.completed_at &&
        task.completed_at.slice(0, 10) === todayKey,
    ).length;
    const completedWeek = tasks.filter(
      (task) =>
        task.status === "completed" &&
        task.completed_at &&
        new Date(task.completed_at) >= weekStart,
    ).length;
    const focusSessions = tasks.flatMap((task) => task.focus_sessions);
    const todaySessions = focusSessions.filter(
      (session) => session.started_at.slice(0, 10) === todayKey,
    );
    const weekSessions = focusSessions.filter(
      (session) => new Date(session.started_at) >= weekStart,
    );
    const focusToday = todaySessions.reduce(
      (total, session) => total + session.duration_seconds,
      0,
    );
    const focusWeek = weekSessions.reduce(
      (total, session) => total + session.duration_seconds,
      0,
    );

    return {
      pending,
      inProgress,
      completed,
      overdue,
      completedToday,
      completedWeek,
      focusToday,
      focusWeek,
      pomodorosToday: todaySessions.filter((session) => session.completed_cycle).length,
      pomodorosWeek: weekSessions.filter((session) => session.completed_cycle).length,
      dueToday: tasks.filter(
        (task) =>
          task.status !== "completed" &&
          task.status !== "canceled" &&
          (task.planned_for === todayKey || task.due_date === todayKey),
      ).length,
    };
  }, [tasks]);

  useEffect(() => {
    if (!isBlinkingTitle) {
      document.title = APP_TITLE;
      return;
    }

    let active = false;
    const interval = window.setInterval(() => {
      document.title = active ? APP_TITLE : "â° Ciclo finalizado";
      active = !active;
    }, 700);

    return () => {
      window.clearInterval(interval);
      document.title = APP_TITLE;
    };
  }, [isBlinkingTitle]);

  useEffect(() => {
    if (!isBlinkingTitle) {
      return;
    }

    const stopBlink = () => setIsBlinkingTitle(false);

    window.addEventListener("click", stopBlink, { once: true });
    window.addEventListener("keydown", stopBlink, { once: true });

    return () => {
      window.removeEventListener("click", stopBlink);
      window.removeEventListener("keydown", stopBlink);
    };
  }, [isBlinkingTitle]);

  const createTask = async (values: {
    title: string;
    description?: string;
    priority?: TaskPriority;
    category?: string | null;
    due_date?: string | null;
    planned_for?: string | null;
    estimated_minutes?: number | null;
    recurrence?: TaskRecurrence;
    pomodoro_minutes?: number | null;
    break_minutes?: number | null;
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

      setTasks((current) => upsertTask(current, data.task as Task));
      if (!pomodoro.selectedTaskId) {
        pomodoro.setSelectedTaskId(data.task.id);
      }
    } finally {
      setCreatingTask(false);
    }
  };

  const updateTask = async (taskId: string, payload: Record<string, unknown>) => {
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

    if (payload.status === "completed" && data.task.recurrence !== "none") {
      const listResponse = await fetch("/api/tasks", { cache: "no-store" });
      const listData = (await listResponse.json()) as { tasks?: Task[]; error?: string };

      if (listResponse.ok && listData.tasks) {
        setTasks(sortByMostRecent(listData.tasks));
      }
    }
  };

  const updateTaskWithBusy = async (taskId: string, payload: Record<string, unknown>) => {
    setBusyTaskId(taskId);
    setErrorMessage(null);

    try {
      await updateTask(taskId, payload);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Erro ao atualizar tarefa.");
    } finally {
      setBusyTaskId(null);
    }
  };

  const toggleTask = async (task: Task) => {
    await updateTaskWithBusy(task.id, {
      status: task.status === "completed" ? "pending" : "completed",
    });
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

      if (pomodoro.selectedTaskId === taskId) {
        pomodoro.setSelectedTaskId(null);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Erro ao excluir tarefa.");
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
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Erro ao criar subtarefa.");
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
        throw new Error(data.error ?? "Não foi possível atualizar a subtarefa.");
      }

      setTasks((current) => upsertTask(current, data.task as Task));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Erro ao atualizar subtarefa.");
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
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Erro ao excluir subtarefa.");
    }
  };

  const moveTodayToTomorrow = async () => {
    const todayKey = toDateKey(new Date());
    const tomorrowKey = addDaysKey(1);
    const tasksToMove = tasks.filter(
      (task) =>
        task.status !== "completed" &&
        task.status !== "canceled" &&
        task.planned_for === todayKey,
    );

    await Promise.all(
      tasksToMove.map((task) => updateTask(task.id, { planned_for: tomorrowKey })),
    );
  };

  const handleUserInteraction = () => {
    setIsBlinkingTitle(false);

    if (typeof window !== "undefined" && "Notification" in window) {
      if (window.Notification.permission === "default") {
        window.Notification.requestPermission().catch(() => null);
      }
    }
  };

  const handleSelectTask = (taskId: string | null) => {
    pomodoro.setSelectedTaskId(taskId);

    if (!taskId) {
      return;
    }

    const task = tasks.find((item) => item.id === taskId);

    if (!task) {
      return;
    }

    if (task.pomodoro_minutes) {
      pomodoro.setFocusMinutes(task.pomodoro_minutes);
    }

    if (task.break_minutes) {
      pomodoro.setBreakMinutes(task.break_minutes);
    }
  };

  const pomodoroPanel = (
    <PomodoroPanel
      selectedTask={selectedTask}
      phase={pomodoro.phase}
      status={pomodoro.status}
      remainingSeconds={pomodoro.remainingSeconds}
      focusMinutes={pomodoro.focusMinutes}
      breakMinutes={pomodoro.breakMinutes}
      onSetFocusMinutes={pomodoro.setFocusMinutes}
      onSetBreakMinutes={pomodoro.setBreakMinutes}
      onStart={pomodoro.start}
      onPause={pomodoro.pause}
      onResume={pomodoro.resume}
      onReset={pomodoro.reset}
      onFinishFocus={pomodoro.finishFocus}
      onSkipToBreak={pomodoro.skipToBreak}
      onUserInteraction={handleUserInteraction}
      isCompact={isCompact}
    />
  );

  if (focusModeOpen && selectedTask) {
    return (
      <main className="min-h-screen bg-zinc-950 p-4 text-white md:p-8">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_420px]">
          <section className="rounded-[28px] border border-white/10 bg-white/[0.06] p-5">
            <Button
              variant="ghost"
              className="mb-6 text-white hover:bg-white/10"
              onClick={() => setFocusModeOpen(false)}
            >
              <ArrowLeft className="size-4" />
              Voltar para lista
            </Button>
            <p className="text-sm uppercase text-teal-200/70">Modo foco</p>
            <h1 className="mt-2 text-4xl font-semibold">{selectedTask.title}</h1>
            {selectedTask.description ? (
              <p className="mt-4 max-w-2xl text-white/60">{selectedTask.description}</p>
            ) : null}
            <div className="mt-8 space-y-3">
              <h2 className="text-sm font-semibold uppercase text-white/50">Subtarefas</h2>
              {selectedTask.subtasks.length ? (
                selectedTask.subtasks.map((subtask) => (
                  <label
                    key={subtask.id}
                    className="flex items-center gap-3 rounded-2xl bg-white/10 p-3"
                  >
                    <Checkbox
                      checked={subtask.is_completed}
                      onCheckedChange={() =>
                        toggleSubtask(subtask.id, !subtask.is_completed)
                      }
                    />
                    <span className={subtask.is_completed ? "text-white/35 line-through" : ""}>
                      {subtask.title}
                    </span>
                  </label>
                ))
              ) : (
                <p className="text-white/45">Sem subtarefas para esta tarefa.</p>
              )}
            </div>
            <div className="mt-8 flex flex-wrap gap-2">
              <Button
                className="bg-emerald-400 text-emerald-950 hover:bg-emerald-300"
                onClick={() => updateTaskWithBusy(selectedTask.id, { status: "completed" })}
              >
                <CheckCircle2 className="size-4" />
                Concluir tarefa
              </Button>
              <Button
                variant="outline"
                className="border-white/10 bg-white/10 text-white hover:bg-white/15"
                onClick={() => updateTaskWithBusy(selectedTask.id, { status: "in_progress" })}
              >
                Marcar em andamento
              </Button>
            </div>
          </section>
          {pomodoroPanel}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7f2e8_0%,#eef4f1_48%,#f7f7fb_100%)] text-slate-950 dark:bg-[linear-gradient(180deg,#090b0d_0%,#101715_48%,#09090b_100%)] dark:text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 md:px-8 md:py-7">
        <header className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="space-y-3">
            {!isCompact ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-900/10 bg-white/70 px-3 py-1 text-xs font-semibold uppercase text-slate-600 shadow-sm dark:border-white/10 dark:bg-white/10 dark:text-white/60">
                <Target className="size-3.5" />
                Foco pessoal e profissional
              </div>
            ) : null}
            <div>
              {!isCompact ? (
                <h1 className="text-4xl font-semibold leading-none md:text-5xl">{APP_TITLE}</h1>
              ) : null}
              {!isCompact ? (
                <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-white/55">
                Organize prioridades, quebre tarefas em passos menores e mantenha o ritmo com Pomodoro.
              </p>
              ) : null}
            </div>
          </div>

          <div
            className={[
              "flex items-center gap-2 justify-self-start lg:justify-self-end",
              isCompact ? "hidden" : "",
            ].join(" ")}
          >
            {!isCompact ? (
              <>
                <StatPill icon={CircleDot} label="Pendentes" value={dashboardStats.pending} />
                <StatPill icon={CheckCircle2} label="Feitas" value={dashboardStats.completed} />
              </>
            ) : null}
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
            <ThemeToggle />
          </div>
        </header>

        {completionMessage ? (
          <Alert className="border-teal-500/30 bg-teal-500/10">
            <BellRing className="size-4" />
            <AlertTitle>Alerta do Pomodoro</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center gap-3">
              <span>{completionMessage}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setCompletionMessage(null);
                  pomodoro.clearCompletionAlert();
                  setIsBlinkingTitle(false);
                }}
              >
                Entendi
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {errorMessage ? (
          <Alert variant="destructive">
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}
        <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value as DashboardTab)} className="gap-4">
          <TabsList className="h-10 w-full justify-start rounded-2xl border border-slate-900/10 bg-white/70 p-1 dark:border-white/10 dark:bg-white/10">
            <TabsTrigger value="task-form" className="h-8 rounded-xl px-3">
              <CircleDot className="size-4" />
              Nova tarefa
            </TabsTrigger>
            <TabsTrigger value="execution" className="h-8 rounded-xl px-3">
              <ListTodo className="size-4" />
              Tarefas e foco
            </TabsTrigger>
          </TabsList>

          <TabsContent value="task-form">
            <TaskForm
              isSubmitting={creatingTask}
              isCompact={isCompact}
              categorySuggestions={categorySuggestions}
              onCreate={createTask}
            />
          </TabsContent>

          <TabsContent value="execution">
            <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
              <div className={["order-2 lg:order-1", isCompact ? "space-y-0" : "space-y-5"].join(" ")}>
                {!isCompact ? (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <MiniMetric title="Hoje" value={dashboardStats.dueToday} caption="planejadas ou com prazo" />
                    <MiniMetric title="Atrasadas" value={dashboardStats.overdue} caption="pedem atenção" />
                    <MiniMetric title="Foco hoje" value={formatFocusTime(dashboardStats.focusToday)} caption={`${dashboardStats.pomodorosToday} pomodoros`} />
                    <MiniMetric title="Semana" value={formatFocusTime(dashboardStats.focusWeek)} caption={`${dashboardStats.completedWeek} concluídas`} />
                  </div>
                ) : null}

                {!isCompact ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className="rounded-full"
                      onClick={() => setFocusModeOpen(Boolean(selectedTask))}
                      disabled={!selectedTask}
                    >
                      <Target className="size-4" />
                      Modo foco
                    </Button>
                    <Button variant="outline" className="rounded-full" onClick={moveTodayToTomorrow}>
                      <MoveRight className="size-4" />
                      Mover hoje para amanhã
                    </Button>
                  </div>
                ) : null}

                <TasksList
                  tasks={tasks}
                  selectedTaskId={pomodoro.selectedTaskId}
                  busyTaskId={busyTaskId}
                  isCompact={isCompact}
                  categorySuggestions={categorySuggestions}
                  onSelectTask={handleSelectTask}
                  onToggleTask={toggleTask}
                  onDeleteTask={deleteTask}
                  onUpdateTask={updateTaskWithBusy}
                  onCreateSubtask={createSubtask}
                  onToggleSubtask={toggleSubtask}
                  onDeleteSubtask={deleteSubtask}
                />
              </div>

              <div className="order-1 lg:order-2">{pomodoroPanel}</div>
            </section>
          </TabsContent>
        </Tabs>

        {isCompact ? (
          <div className="mt-2 flex items-center justify-end gap-2">
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
    <div className="hidden items-center gap-2 rounded-full border border-slate-900/10 bg-white/80 px-3 py-2 text-sm shadow-sm backdrop-blur sm:flex dark:border-white/10 dark:bg-white/10">
      <Icon className="size-4 text-teal-600 dark:text-teal-300" />
      <span className="text-slate-500 dark:text-white/55">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MiniMetric({
  title,
  value,
  caption,
}: {
  title: string;
  value: string | number;
  caption: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-900/10 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/[0.06]">
      <p className="text-xs font-semibold uppercase text-slate-500 dark:text-white/45">{title}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <strong className="text-2xl leading-none">{value}</strong>
        <span className="text-right text-xs text-slate-500 dark:text-white/45">{caption}</span>
      </div>
    </div>
  );
}





