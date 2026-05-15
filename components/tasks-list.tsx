"use client";

import { FormEvent, type Dispatch, type SetStateAction, useMemo, useState } from "react";
import {
  CalendarClock,
  CalendarCheck,
  CheckCircle2,
  Circle,
  CirclePlus,
  Pencil,
  Repeat,
  Search,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatDateTime } from "@/lib/format";
import type { Task, TaskFilter, TaskPriority, TaskRecurrence, TaskView } from "@/types/task";

interface TasksListProps {
  tasks: Task[];
  selectedTaskId: string | null;
  busyTaskId: string | null;
  isCompact?: boolean;
  categorySuggestions: string[];
  onSelectTask: (taskId: string | null) => void;
  onToggleTask: (task: Task) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onUpdateTask: (taskId: string, payload: Record<string, unknown>) => Promise<void>;
  onCreateSubtask: (taskId: string, title: string) => Promise<void>;
  onToggleSubtask: (subtaskId: string, isCompleted: boolean) => Promise<void>;
  onDeleteSubtask: (subtaskId: string) => Promise<void>;
}

type PriorityFilter = "all" | TaskPriority;
type DueBucket = "overdue" | "today" | "week" | "later" | "none";

interface EditingState {
  title: string;
  category: string;
  due_date: string;
  planned_for: string;
  estimated_minutes: string;
  priority: TaskPriority;
  recurrence: TaskRecurrence;
}

function getPriorityLabel(priority: TaskPriority) {
  if (priority === "high") {
    return "Alta";
  }

  if (priority === "low") {
    return "Baixa";
  }

  return "Média";
}

function getPriorityClass(priority: TaskPriority) {
  if (priority === "high") {
    return "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-200";
  }

  if (priority === "low") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200";
  }

  return "border-amber-500/30 bg-amber-400/15 text-amber-700 dark:text-amber-200";
}

function getStatusLabel(status: Task["status"]) {
  if (status === "in_progress") {
    return "Em andamento";
  }

  if (status === "completed") {
    return "Concluída";
  }

  if (status === "canceled") {
    return "Cancelada";
  }

  return "Pendente";
}

function getRecurrenceLabel(recurrence: TaskRecurrence) {
  if (recurrence === "daily") {
    return "Diária";
  }

  if (recurrence === "weekly") {
    return "Semanal";
  }

  if (recurrence === "monthly") {
    return "Mensal";
  }

  return "Sem recorrência";
}

function getTodayKey() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function formatFocusTime(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getDueBucket(dueDate: string | null): DueBucket {
  if (!dueDate) {
    return "none";
  }

  const now = new Date();
  const today = startOfDay(now);
  const due = startOfDay(new Date(`${dueDate}T00:00:00`));
  const diffInDays = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffInDays < 0) {
    return "overdue";
  }

  if (diffInDays === 0) {
    return "today";
  }

  if (diffInDays <= 7) {
    return "week";
  }

  return "later";
}

const bucketOrder: DueBucket[] = ["overdue", "today", "week", "later", "none"];

const bucketLabels: Record<DueBucket, string> = {
  overdue: "Vencidas",
  today: "Hoje",
  week: "Semana",
  later: "Depois",
  none: "Sem prazo",
};

const bucketStyles: Record<DueBucket, string> = {
  overdue: "border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-200",
  today: "border-teal-500 bg-teal-500/10 text-teal-700 dark:text-teal-200",
  week: "border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-200",
  later: "border-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-200",
  none: "border-slate-400 bg-slate-500/10 text-slate-600 dark:text-white/60",
};

export function TasksList({
  tasks,
  selectedTaskId,
  busyTaskId,
  isCompact = false,
  categorySuggestions,
  onSelectTask,
  onToggleTask,
  onDeleteTask,
  onUpdateTask,
  onCreateSubtask,
  onToggleSubtask,
  onDeleteSubtask,
}: TasksListProps) {
  const [statusFilter, setStatusFilter] = useState<TaskFilter>("all");
  const [viewFilter, setViewFilter] = useState<TaskView>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingState, setEditingState] = useState<EditingState | null>(null);
  const [subtaskDraftByTaskId, setSubtaskDraftByTaskId] = useState<Record<string, string>>({});

  const availableCategories = useMemo(() => {
    const fromTasks = tasks
      .map((task) => task.category)
      .filter((category): category is string => Boolean(category));

    return Array.from(new Set([...categorySuggestions, ...fromTasks])).sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    );
  }, [categorySuggestions, tasks]);

  const filteredTasks = useMemo(() => {
    const todayKey = getTodayKey();

    return tasks.filter((task) => {
      if (statusFilter !== "all" && task.status !== statusFilter) {
        return false;
      }

      if (viewFilter === "today" && task.planned_for !== todayKey && task.due_date !== todayKey) {
        return false;
      }

      if (
        viewFilter === "overdue" &&
        (!task.due_date ||
          task.due_date >= todayKey ||
          task.status === "completed" ||
          task.status === "canceled")
      ) {
        return false;
      }

      if (
        viewFilter === "backlog" &&
        (task.planned_for ||
          task.due_date ||
          task.status === "completed" ||
          task.status === "canceled")
      ) {
        return false;
      }

      if (viewFilter === "work" && task.category !== "trabalho") {
        return false;
      }

      if (viewFilter === "personal" && task.category !== "pessoal") {
        return false;
      }

      if (viewFilter === "completed" && task.status !== "completed") {
        return false;
      }

      if (priorityFilter !== "all" && task.priority !== priorityFilter) {
        return false;
      }

      if (categoryFilter !== "all" && (task.category ?? "") !== categoryFilter) {
        return false;
      }

      if (!search.trim()) {
        return true;
      }

      const query = search.trim().toLocaleLowerCase("pt-BR");
      const inSubtasks = task.subtasks.some((subtask) =>
        subtask.title.toLocaleLowerCase("pt-BR").includes(query),
      );

      return (
        task.title.toLocaleLowerCase("pt-BR").includes(query) ||
        (task.description ?? "").toLocaleLowerCase("pt-BR").includes(query) ||
        (task.category ?? "").toLocaleLowerCase("pt-BR").includes(query) ||
        inSubtasks
      );
    });
  }, [categoryFilter, priorityFilter, search, statusFilter, tasks, viewFilter]);

  const groupedTasks = useMemo(() => {
    const groups: Record<DueBucket, Task[]> = {
      overdue: [],
      today: [],
      week: [],
      later: [],
      none: [],
    };

    for (const task of filteredTasks) {
      groups[getDueBucket(task.due_date)].push(task);
    }

    return groups;
  }, [filteredTasks]);

  const startEdit = (task: Task) => {
    setEditingTaskId(task.id);
    setEditingState({
      title: task.title,
      category: task.category ?? "",
      due_date: task.due_date ?? "",
      planned_for: task.planned_for ?? "",
      estimated_minutes: task.estimated_minutes?.toString() ?? "",
      priority: task.priority,
      recurrence: task.recurrence,
    });
  };

  const cancelEdit = () => {
    setEditingTaskId(null);
    setEditingState(null);
  };

  const submitSubtask = async (event: FormEvent, taskId: string) => {
    event.preventDefault();
    const title = (subtaskDraftByTaskId[taskId] ?? "").trim();

    if (!title) {
      return;
    }

    await onCreateSubtask(taskId, title);
    setSubtaskDraftByTaskId((current) => ({ ...current, [taskId]: "" }));
  };

  return (
    <section className="space-y-4">
      <div className="rounded-3xl border border-slate-900/10 bg-white/80 p-4 shadow-sm shadow-slate-950/5 backdrop-blur dark:border-white/10 dark:bg-white/[0.07]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Tarefas</h2>
            <p className="text-sm text-slate-500 dark:text-white/45">
              {filteredTasks.length} de {tasks.length} na visão atual
            </p>
          </div>

          {!isCompact ? (
            <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as TaskFilter)}>
            <TabsList className="grid w-full min-w-96 grid-cols-5 rounded-full bg-slate-950/[0.06] p-1 dark:bg-white/10">
              <TabsTrigger value="all" className="rounded-full">Todas</TabsTrigger>
              <TabsTrigger value="pending" className="rounded-full">Pendentes</TabsTrigger>
              <TabsTrigger value="in_progress" className="rounded-full">Andamento</TabsTrigger>
              <TabsTrigger value="completed" className="rounded-full">Feitas</TabsTrigger>
              <TabsTrigger value="canceled" className="rounded-full">Canceladas</TabsTrigger>
            </TabsList>
          </Tabs>
          ) : null}
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {[
            ["all", "Todas"],
            ["today", "Hoje"],
            ["overdue", "Atrasadas"],
            ["backlog", "Backlog"],
            ["work", "Trabalho"],
            ["personal", "Pessoal"],
            ["completed", "Concluídas"],
          ].map(([value, label]) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={viewFilter === value ? "default" : "outline"}
              className="rounded-full"
              onClick={() => setViewFilter(value as TaskView)}
            >
              {label}
            </Button>
          ))}
        </div>

        <div className={isCompact ? "mt-4" : "mt-4 grid gap-2 md:grid-cols-[1.4fr_0.8fr_0.9fr]"}>
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="h-10 rounded-2xl border-slate-900/10 bg-white pl-9 shadow-none dark:border-white/10 dark:bg-black/20"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar tarefa, categoria ou subtarefa"
            />
          </label>

          {!isCompact ? (
            <Select
            value={priorityFilter}
            onValueChange={(value) => setPriorityFilter((value ?? "all") as PriorityFilter)}
          >
            <SelectTrigger className="h-10 w-full rounded-2xl border-slate-900/10 bg-white py-0 shadow-none dark:border-white/10 dark:bg-black/20">
              <span className="flex h-full items-center text-sm">
                {priorityFilter === "all"
                  ? "Todas prioridades"
                  : getPriorityLabel(priorityFilter)}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas prioridades</SelectItem>
              <SelectItem value="high">Alta</SelectItem>
              <SelectItem value="medium">Média</SelectItem>
              <SelectItem value="low">Baixa</SelectItem>
            </SelectContent>
          </Select>
          ) : null}

          {!isCompact ? (
            <Select
            value={categoryFilter}
            onValueChange={(value) => setCategoryFilter(value ?? "all")}
          >
            <SelectTrigger className="h-10 w-full rounded-2xl border-slate-900/10 bg-white py-0 shadow-none dark:border-white/10 dark:bg-black/20">
              <span className="flex h-full items-center text-sm">
                {categoryFilter === "all" ? "Todas categorias" : categoryFilter}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {availableCategories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          ) : null}
        </div>
      </div>

      {filteredTasks.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-900/15 bg-white/55 p-10 text-center shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
          <CirclePlus className="mx-auto size-8 text-slate-400" />
          <p className="mt-3 font-medium">Nada por aqui nesta vista.</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-white/45">
            Ajuste os filtros ou crie uma nova tarefa acima.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {bucketOrder.map((bucket) => {
            const tasksByBucket = groupedTasks[bucket];

            if (!tasksByBucket.length) {
              return null;
            }

            return (
              <section key={bucket} className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className={`h-7 rounded-full border px-3 py-1 text-xs font-semibold ${bucketStyles[bucket]}`}>
                    {bucketLabels[bucket]}
                  </span>
                  <div className="h-px flex-1 bg-slate-900/10 dark:bg-white/10" />
                  <span className="text-xs text-slate-500 dark:text-white/45">
                    {tasksByBucket.length}
                  </span>
                </div>

                <ul className="space-y-3">
                  {tasksByBucket.map((task) => {
                    const isCompleted = task.status === "completed";
                    const isActive = task.id === selectedTaskId;
                    const isBusy = busyTaskId === task.id;
                    const isEditing = editingTaskId === task.id && editingState;

                    const completedSubtasks = task.subtasks.filter((item) => item.is_completed).length;
                    const hasSubtasks = task.subtasks.length > 0;
                    const subtaskPercent = hasSubtasks
                      ? Math.round((completedSubtasks / task.subtasks.length) * 100)
                      : 0;
                    const shouldSuggestComplete =
                      task.status !== "completed" &&
                      task.status !== "canceled" &&
                      hasSubtasks &&
                      completedSubtasks === task.subtasks.length;

                    return (
                      <li
                        key={task.id}
                        className={[
                          "group border bg-white/85 shadow-sm shadow-slate-950/5 transition duration-200 hover:-translate-y-0.5 hover:shadow-md dark:bg-zinc-950/70 dark:shadow-black/20",
                          isCompact ? "rounded-2xl p-2.5" : "rounded-3xl p-4",
                          isCompleted
                            ? "border-emerald-500/25"
                            : "border-slate-900/10 dark:border-white/10",
                          isActive ? "ring-2 ring-teal-400/70" : "",
                        ].join(" ")}
                      >
                        <div className="grid gap-4 md:grid-cols-[auto_1fr_auto] md:items-start">
                          <Checkbox
                            checked={isCompleted}
                            onCheckedChange={() => onToggleTask(task)}
                            disabled={isBusy}
                            aria-label="Concluir tarefa"
                            className="mt-1"
                          />

                          <div className={["min-w-0", isCompact ? "space-y-2" : "space-y-3"].join(" ")}>
                            {isEditing ? (
                              <TaskEditForm
                                editingState={editingState}
                                setEditingState={setEditingState}
                                onCancel={cancelEdit}
                                onSave={async () => {
                                  const nextTitle = editingState.title.trim();

                                  if (!nextTitle) {
                                    return;
                                  }

                                  await onUpdateTask(task.id, {
                                    title: nextTitle,
                                    priority: editingState.priority,
                                    category: editingState.category.trim() || null,
                                    due_date: editingState.due_date || null,
                                    planned_for: editingState.planned_for || null,
                                    estimated_minutes: editingState.estimated_minutes
                                      ? Number(editingState.estimated_minutes)
                                      : null,
                                    recurrence: editingState.recurrence,
                                  });
                                  cancelEdit();
                                }}
                              />
                            ) : (
                              <>
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p
                                      className={[
                                        isCompact
                                          ? "text-base font-semibold leading-snug"
                                          : "text-lg font-semibold leading-snug",
                                        isCompleted ? "text-slate-400 line-through dark:text-white/35" : "",
                                      ].join(" ")}
                                    >
                                      {task.title}
                                    </p>
                                    {!isCompact && task.description ? (
                                      <p className="mt-1 text-sm text-slate-500 dark:text-white/45">
                                        {task.description}
                                      </p>
                                    ) : null}
                                  </div>

                                  {isActive ? (
                                    <Badge className="border-teal-500/30 bg-teal-500/15 text-teal-700 dark:text-teal-200">
                                      Em foco
                                    </Badge>
                                  ) : null}
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant={isCompleted ? "secondary" : "default"}>
                                    {getStatusLabel(task.status)}
                                  </Badge>
                                  <Badge className={getPriorityClass(task.priority)}>
                                    {getPriorityLabel(task.priority)}
                                  </Badge>
                                  {task.category ? <Badge variant="outline">{task.category}</Badge> : null}
                                  <Badge variant="outline" className="gap-1">
                                    <CalendarClock className="size-3" />
                                    Prazo {formatDate(task.due_date)}
                                  </Badge>
                                  {!isCompact ? (
                                    <Badge variant="outline" className="gap-1">
                                    <CalendarCheck className="size-3" />
                                    Fazer {formatDate(task.planned_for)}
                                  </Badge>
                                  ) : null}
                                  {!isCompact && task.estimated_minutes ? (
                                    <Badge variant="outline">
                                      Est. {task.estimated_minutes}m
                                    </Badge>
                                  ) : null}
                                  {!isCompact ? (
                                    <Badge variant="outline">
                                    {formatFocusTime(task.focused_seconds)} foco
                                  </Badge>
                                  ) : null}
                                  {!isCompact ? (
                                    <Badge variant="outline">
                                    {task.pomodoro_count} pomodoros
                                  </Badge>
                                  ) : null}
                                  {!isCompact && task.recurrence !== "none" ? (
                                    <Badge variant="outline" className="gap-1">
                                      <Repeat className="size-3" />
                                      {getRecurrenceLabel(task.recurrence)}
                                    </Badge>
                                  ) : null}
                                </div>
                              </>
                            )}

                            <div
                              className={[
                                "flex flex-wrap gap-2 text-xs text-slate-500 dark:text-white/40",
                                isCompact ? "hidden" : "",
                              ].join(" ")}
                            >
                              <span>Criada em {formatDateTime(task.created_at)}</span>
                              {task.completed_at ? (
                                <span>Concluída em {formatDateTime(task.completed_at)}</span>
                              ) : null}
                              <span>Atualizada em {formatDateTime(task.updated_at)}</span>
                            </div>

                            {isCompact && hasSubtasks ? (
                              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-white/45">
                                <span>Subtarefas {completedSubtasks}/{task.subtasks.length}</span>
                                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-900/10 dark:bg-white/10">
                                  <div
                                    className="h-full rounded-full bg-teal-500"
                                    style={{ width: `${subtaskPercent}%` }}
                                  />
                                </div>
                                {shouldSuggestComplete ? (
                                  <Button
                                    size="sm"
                                    className="h-7 rounded-full bg-emerald-500 px-3 text-xs text-white hover:bg-emerald-600"
                                    onClick={async () => {
                                      await onUpdateTask(task.id, { status: "completed" });
                                    }}
                                  >
                                    Concluir
                                  </Button>
                                ) : null}
                              </div>
                            ) : null}

                            <div
                              className={[
                                "space-y-3 rounded-2xl bg-slate-950/[0.035] p-3 dark:bg-white/[0.045]",
                                isCompact ? "hidden" : "",
                              ].join(" ")}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <p className="text-xs font-semibold uppercase text-slate-500 dark:text-white/45">
                                    Subtarefas {completedSubtasks}/{task.subtasks.length}
                                  </p>
                                  {hasSubtasks ? (
                                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-900/10 dark:bg-white/10">
                                      <div
                                        className="h-full rounded-full bg-teal-500"
                                        style={{ width: `${subtaskPercent}%` }}
                                      />
                                    </div>
                                  ) : null}
                                </div>

                                {shouldSuggestComplete ? (
                                  <Button
                                    size="sm"
                                    className="rounded-full bg-emerald-500 text-white hover:bg-emerald-600"
                                    onClick={async () => {
                                      await onUpdateTask(task.id, { status: "completed" });
                                    }}
                                  >
                                    <CheckCircle2 className="size-4" />
                                    Concluir tarefa
                                  </Button>
                                ) : null}
                              </div>

                              {task.subtasks.length ? (
                                <ul className="space-y-2">
                                  {task.subtasks.map((subtask) => (
                                    <li
                                      key={subtask.id}
                                      className="flex items-center justify-between gap-2 rounded-xl bg-white/70 px-2 py-1.5 dark:bg-black/20"
                                    >
                                      <label className="flex min-w-0 items-center gap-2">
                                        <Checkbox
                                          checked={subtask.is_completed}
                                          onCheckedChange={() =>
                                            onToggleSubtask(subtask.id, !subtask.is_completed)
                                          }
                                        />
                                        <span
                                          className={[
                                            "truncate text-sm",
                                            subtask.is_completed
                                              ? "text-slate-400 line-through dark:text-white/35"
                                              : "",
                                          ].join(" ")}
                                        >
                                          {subtask.title}
                                        </span>
                                      </label>

                                      <Button
                                        type="button"
                                        size="icon-sm"
                                        variant="ghost"
                                        onClick={() => onDeleteSubtask(subtask.id)}
                                        aria-label="Excluir subtarefa"
                                      >
                                        <Trash2 className="size-4 text-rose-500" />
                                      </Button>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-white/40">
                                  <Circle className="size-3" />
                                  Sem subtarefas ainda.
                                </p>
                              )}

                              <form onSubmit={(event) => submitSubtask(event, task.id)} className="flex gap-2">
                                <Input
                                  className="h-9 rounded-xl border-slate-900/10 bg-white shadow-none dark:border-white/10 dark:bg-black/20"
                                  value={subtaskDraftByTaskId[task.id] ?? ""}
                                  onChange={(event) =>
                                    setSubtaskDraftByTaskId((current) => ({
                                      ...current,
                                      [task.id]: event.target.value,
                                    }))
                                  }
                                  placeholder="Nova subtarefa"
                                  maxLength={160}
                                />
                                <Button type="submit" variant="outline" className="h-9 rounded-xl">
                                  <CirclePlus className="size-4" />
                                  Adicionar
                                </Button>
                              </form>
                            </div>
                          </div>

                          <div
                            className={[
                              "flex justify-end gap-1.5",
                              isCompact ? "items-start md:flex-row" : "md:flex-col",
                            ].join(" ")}
                          >
                            <Button
                              type="button"
                              size={isCompact ? "icon-sm" : "icon"}
                              variant="ghost"
                              onClick={() => startEdit(task)}
                              disabled={Boolean(isEditing)}
                              aria-label="Editar tarefa"
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              size={isCompact ? "icon-sm" : "icon"}
                              variant="ghost"
                              onClick={() => onDeleteTask(task.id)}
                              disabled={isBusy}
                              aria-label="Excluir tarefa"
                            >
                              <Trash2 className="size-4 text-rose-500" />
                            </Button>
                            <Button
                              type="button"
                              size={isCompact ? "xs" : "sm"}
                              className={
                                isActive
                                  ? "h-7 rounded-full bg-teal-500 px-2 text-xs text-white hover:bg-teal-600"
                                  : "h-7 rounded-full px-2 text-xs"
                              }
                              variant={isActive ? "default" : "outline"}
                              onClick={() => onSelectTask(isActive ? null : task.id)}
                            >
                              {isActive ? "Ativa" : "Foco"}
                            </Button>
                            {!isCompact && task.status !== "completed" && task.status !== "canceled" ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="rounded-full"
                                onClick={() => onUpdateTask(task.id, { status: "in_progress" })}
                              >
                                Andamento
                              </Button>
                            ) : null}
                            {!isCompact && task.status === "canceled" ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="rounded-full"
                                onClick={() => onUpdateTask(task.id, { status: "pending" })}
                              >
                                Reabrir
                              </Button>
                            ) : !isCompact && task.status !== "completed" ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="rounded-full"
                                onClick={() => onUpdateTask(task.id, { status: "canceled" })}
                              >
                                Cancelar
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <datalist id="category-suggestions-edit">
        {availableCategories.map((category) => (
          <option key={category} value={category} />
        ))}
      </datalist>
    </section>
  );
}

function TaskEditForm({
  editingState,
  setEditingState,
  onSave,
  onCancel,
}: {
  editingState: EditingState;
  setEditingState: Dispatch<SetStateAction<EditingState | null>>;
  onSave: () => Promise<void>;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-2">
      <Input
        className="h-10 rounded-2xl border-slate-900/10 bg-white shadow-none dark:border-white/10 dark:bg-black/20"
        value={editingState.title}
        onChange={(event) =>
          setEditingState((current) =>
            current ? { ...current, title: event.target.value } : current,
          )
        }
        maxLength={120}
      />

      <div className="grid gap-2 sm:grid-cols-3">
        <Select
          value={editingState.priority}
          onValueChange={(value) =>
            setEditingState((current) =>
              current
                ? {
                    ...current,
                    priority: (value ?? "medium") as TaskPriority,
                  }
                : current,
            )
          }
        >
          <SelectTrigger className="h-10 w-full rounded-2xl border-slate-900/10 bg-white py-0 shadow-none dark:border-white/10 dark:bg-black/20">
            <span className="flex h-full items-center text-sm">
              {getPriorityLabel(editingState.priority)}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Baixa</SelectItem>
            <SelectItem value="medium">Média</SelectItem>
            <SelectItem value="high">Alta</SelectItem>
          </SelectContent>
        </Select>

        <Input
          className="h-10 rounded-2xl border-slate-900/10 bg-white shadow-none dark:border-white/10 dark:bg-black/20"
          value={editingState.category}
          onChange={(event) =>
            setEditingState((current) =>
              current ? { ...current, category: event.target.value } : current,
            )
          }
          placeholder="Categoria"
          list="category-suggestions-edit"
        />

        <Input
          className="h-10 rounded-2xl border-slate-900/10 bg-white shadow-none dark:border-white/10 dark:bg-black/20"
          type="date"
          value={editingState.due_date}
          onChange={(event) =>
            setEditingState((current) =>
              current ? { ...current, due_date: event.target.value } : current,
            )
          }
        />

        <Input
          className="h-10 rounded-2xl border-slate-900/10 bg-white shadow-none dark:border-white/10 dark:bg-black/20"
          type="date"
          value={editingState.planned_for}
          onChange={(event) =>
            setEditingState((current) =>
              current ? { ...current, planned_for: event.target.value } : current,
            )
          }
        />

        <Input
          className="h-10 rounded-2xl border-slate-900/10 bg-white shadow-none dark:border-white/10 dark:bg-black/20"
          type="number"
          min={1}
          value={editingState.estimated_minutes}
          onChange={(event) =>
            setEditingState((current) =>
              current ? { ...current, estimated_minutes: event.target.value } : current,
            )
          }
          placeholder="Estimativa"
        />

        <Select
          value={editingState.recurrence}
          onValueChange={(value) =>
            setEditingState((current) =>
              current
                ? {
                    ...current,
                    recurrence: (value ?? "none") as TaskRecurrence,
                  }
                : current,
            )
          }
        >
          <SelectTrigger className="h-10 w-full rounded-2xl border-slate-900/10 bg-white py-0 shadow-none dark:border-white/10 dark:bg-black/20">
            <span className="flex h-full items-center text-sm">
              {getRecurrenceLabel(editingState.recurrence)}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sem recorrência</SelectItem>
            <SelectItem value="daily">Diária</SelectItem>
            <SelectItem value="weekly">Semanal</SelectItem>
            <SelectItem value="monthly">Mensal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2">
        <Button size="sm" className="rounded-full" onClick={onSave}>
          Salvar
        </Button>
        <Button size="sm" variant="outline" className="rounded-full" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}


