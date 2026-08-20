"use client";

import {
  type ClipboardEvent,
  type DragEvent,
  type FormEvent,
  type Dispatch,
  type SetStateAction,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  CirclePlus,
  GripVertical,
  Pencil,
  Search,
  Trash2,
  X,
  ImageIcon,
  ImagePlus,
  FileText,
  Loader2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import type {
  Task,
  TaskAttachment,
  TaskPriority,
  TaskView,
} from "@/types/task";

interface TasksListProps {
  tasks: Task[];
  busyTaskId: string | null;
  isCompact?: boolean;
  categorySuggestions: string[];
  onEditDirtyChange?: (isDirty: boolean) => void;
  onToggleTask: (task: Task) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onUpdateTask: (
    taskId: string,
    payload: Record<string, unknown>,
  ) => Promise<boolean>;
  onAddAttachment: (taskId: string, file: File) => Promise<void>;
  onDeleteAttachment: (taskId: string, attachmentId: string) => Promise<void>;
  onCreateSubtask: (taskId: string, title: string) => Promise<void>;
  onToggleSubtask: (subtaskId: string, isCompleted: boolean) => Promise<void>;
  onDeleteSubtask: (subtaskId: string) => Promise<void>;
}

type PriorityFilter = "all" | TaskPriority;
type TaskSection = Task["status"];

const taskViewStorageKey = "taskboard_task_view_filter";
const taskPriorityStorageKey = "taskboard_task_priority_filter";
const taskCategoryStorageKey = "taskboard_task_category_filter";

interface EditingState {
  title: string;
  description: string;
  category: string;
  priority: TaskPriority;
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

  if (status === "waiting") {
    return "Aguardando";
  }

  if (status === "completed") {
    return "Finalizada";
  }

  return "Não iniciada";
}

const taskSectionOrder: TaskSection[] = [
  "not_started",
  "in_progress",
  "waiting",
  "completed",
];

const taskSectionStyles: Record<TaskSection, string> = {
  not_started: "border-slate-400/40 bg-slate-500/10 text-slate-700 dark:text-white/70",
  in_progress: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-200",
  waiting: "border-amber-500/40 bg-amber-400/15 text-amber-800 dark:text-amber-200",
  completed: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
};

const taskOrderStorageKey = "taskboard_task_order";

function areEqualStringArrays(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((item, index) => item === right[index])
  );
}

function readStoredTaskOrder() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(taskOrderStorageKey);
    const parsed = stored ? (JSON.parse(stored) as unknown) : null;

    return Array.isArray(parsed) &&
      parsed.every((item) => typeof item === "string")
      ? parsed
      : [];
  } catch {
    window.localStorage.removeItem(taskOrderStorageKey);
    return [];
  }
}

function normalizeTaskOrder(order: string[], tasks: Task[]) {
  const taskIds = tasks.map((task) => task.id);
  const taskIdSet = new Set(taskIds);
  const existingIds = order.filter((taskId) => taskIdSet.has(taskId));
  const missingIds = taskIds.filter((taskId) => !existingIds.includes(taskId));

  return [...missingIds, ...existingIds];
}

function saveTaskOrder(order: string[]) {
  window.localStorage.setItem(taskOrderStorageKey, JSON.stringify(order));
}

export function TasksList({
  tasks,
  busyTaskId,
  isCompact = false,
  categorySuggestions,
  onEditDirtyChange,
  onToggleTask,
  onDeleteTask,
  onUpdateTask,
  onAddAttachment,
  onDeleteAttachment,
  onCreateSubtask,
  onToggleSubtask,
  onDeleteSubtask,
}: TasksListProps) {
  const [viewFilter, setViewFilter] = useState<TaskView>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingState, setEditingState] = useState<EditingState | null>(null);
  const [subtaskDraftByTaskId, setSubtaskDraftByTaskId] = useState<
    Record<string, string>
  >({});
  const [taskOrder, setTaskOrder] = useState<string[]>([]);
  const [hasLoadedFilters, setHasLoadedFilters] = useState(false);
  const [hasLoadedTaskOrder, setHasLoadedTaskOrder] = useState(false);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [attachmentViewer, setAttachmentViewer] = useState<{
    task: Task;
    index: number;
  } | null>(null);
  const [confirmDeleteTask, setConfirmDeleteTask] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [confirmDeleteSubtask, setConfirmDeleteSubtask] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [deletingConfirm, setDeletingConfirm] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      // Load view filter
      const storedView = window.localStorage.getItem(taskViewStorageKey);
      const isValidTaskView =
        storedView === "all" ||
        storedView === "work" ||
        storedView === "personal" ||
        storedView === "travel";

      if (isValidTaskView) {
        setViewFilter(storedView as TaskView);
      }

      // Load priority filter
      const storedPriority = window.localStorage.getItem(
        taskPriorityStorageKey,
      );
      if (
        storedPriority === "all" ||
        storedPriority === "high" ||
        storedPriority === "medium" ||
        storedPriority === "low"
      ) {
        setPriorityFilter(storedPriority as PriorityFilter);
      }

      // Load category filter
      const storedCategory = window.localStorage.getItem(
        taskCategoryStorageKey,
      );
      if (storedCategory) {
        setCategoryFilter(storedCategory);
      }

      setHasLoadedFilters(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!hasLoadedFilters) return;
    window.localStorage.setItem(taskViewStorageKey, viewFilter);
  }, [viewFilter, hasLoadedFilters]);

  useEffect(() => {
    if (!hasLoadedFilters) return;
    window.localStorage.setItem(taskPriorityStorageKey, priorityFilter);
  }, [priorityFilter, hasLoadedFilters]);

  useEffect(() => {
    if (!hasLoadedFilters) return;
    window.localStorage.setItem(taskCategoryStorageKey, categoryFilter);
  }, [categoryFilter, hasLoadedFilters]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setTaskOrder(readStoredTaskOrder());
      setHasLoadedTaskOrder(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const normalizedTaskOrder = useMemo(
    () => normalizeTaskOrder(taskOrder, tasks),
    [taskOrder, tasks],
  );

  useEffect(() => {
    if (!hasLoadedTaskOrder) {
      return;
    }

    if (!areEqualStringArrays(taskOrder, normalizedTaskOrder)) {
      saveTaskOrder(normalizedTaskOrder);
    }
  }, [hasLoadedTaskOrder, normalizedTaskOrder, taskOrder]);

  const orderedTasks = useMemo(() => {
    const orderIndex = new Map(
      normalizedTaskOrder.map((taskId, index) => [taskId, index]),
    );
    const fallbackIndex = new Map(tasks.map((task, index) => [task.id, index]));

    return [...tasks].sort((left, right) => {
      const leftIndex = orderIndex.get(left.id) ?? Number.MAX_SAFE_INTEGER;
      const rightIndex = orderIndex.get(right.id) ?? Number.MAX_SAFE_INTEGER;

      if (leftIndex !== rightIndex) {
        return leftIndex - rightIndex;
      }

      return (
        (fallbackIndex.get(left.id) ?? 0) - (fallbackIndex.get(right.id) ?? 0)
      );
    });
  }, [normalizedTaskOrder, tasks]);

  const availableCategories = useMemo(() => {
    const fromTasks = tasks
      .map((task) => task.category)
      .filter((category): category is string => Boolean(category));

    return Array.from(new Set([...categorySuggestions, ...fromTasks])).sort(
      (a, b) => a.localeCompare(b, "pt-BR"),
    );
  }, [categorySuggestions, tasks]);

  const filteredTasks = useMemo(() => {
    return orderedTasks.filter((task) => {
      if (viewFilter === "work" && task.category !== "trabalho") {
        return false;
      }

      if (viewFilter === "personal" && task.category !== "pessoal") {
        return false;
      }

      if (viewFilter === "travel" && task.category !== "viagem") {
        return false;
      }

      if (priorityFilter !== "all" && task.priority !== priorityFilter) {
        return false;
      }

      if (
        categoryFilter !== "all" &&
        (task.category ?? "") !== categoryFilter
      ) {
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
  }, [
    categoryFilter,
    orderedTasks,
    priorityFilter,
    search,
    viewFilter,
  ]);

  const groupedTasks = useMemo(() => {
    const groups: Record<TaskSection, Task[]> = {
      not_started: [],
      in_progress: [],
      waiting: [],
      completed: [],
    };

    for (const task of filteredTasks) {
      groups[task.status].push(task);
    }

    return groups;
  }, [filteredTasks]);

  const visibleTaskCount = filteredTasks.length;

  const startEdit = (task: Task) => {
    setEditingTaskId(task.id);
    setEditingState({
      title: task.title,
      description: task.description ?? "",
      category: task.category ?? "",
      priority: task.priority,
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

  const moveTaskBefore = (taskId: string, targetTaskId: string) => {
    if (taskId === targetTaskId) {
      return;
    }

    if (!tasks.some((task) => task.id === taskId) || !tasks.some((task) => task.id === targetTaskId)) {
      return;
    }

    setTaskOrder((current) => {
      const currentIds = normalizeTaskOrder(current, tasks);
      const nextOrder = currentIds.filter(
        (currentTaskId) => currentTaskId !== taskId,
      );
      const targetIndex = nextOrder.indexOf(targetTaskId);

      if (targetIndex === -1) {
        return current;
      }

      nextOrder.splice(targetIndex, 0, taskId);
      saveTaskOrder(nextOrder);
      return nextOrder;
    });
  };

  const moveTaskToEnd = (taskId: string) => {
    if (!tasks.some((task) => task.id === taskId)) {
      return;
    }

    setTaskOrder((current) => {
      const currentIds = normalizeTaskOrder(current, tasks);
      const nextOrder = currentIds.filter(
        (currentTaskId) => currentTaskId !== taskId,
      );
      nextOrder.push(taskId);
      saveTaskOrder(nextOrder);
      return nextOrder;
    });
  };

  const handleDragStart = (event: DragEvent<HTMLElement>, taskId: string) => {
    setDraggingTaskId(taskId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", taskId);
  };

  const handleDragEnd = () => {
    setDraggingTaskId(null);
    setDragOverTaskId(null);
  };

  const handleDragOver = (event: DragEvent, taskId?: string) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    setDragOverTaskId(taskId ?? null);
  };

  const handleDropOnTask = async (
    event: DragEvent<HTMLLIElement>,
    targetTaskId: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const taskId = event.dataTransfer.getData("text/plain") || draggingTaskId;

    if (taskId) {
      const taskToMove = tasks.find((task) => task.id === taskId);
      const targetTask = tasks.find((task) => task.id === targetTaskId);
      if (taskToMove && targetTask && taskToMove.status !== targetTask.status) {
        await onUpdateTask(taskId, { status: targetTask.status });
      }
      moveTaskBefore(taskId, targetTaskId);
    }

    handleDragEnd();
  };

  const handleDropOnColumn = async (
    event: DragEvent<HTMLUListElement>,
    status: TaskSection,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const taskId = event.dataTransfer.getData("text/plain") || draggingTaskId;

    if (taskId) {
      const taskToMove = tasks.find((task) => task.id === taskId);
      if (taskToMove && taskToMove.status !== status) {
        await onUpdateTask(taskId, { status });
      }
      moveTaskToEnd(taskId);
    }

    handleDragEnd();
  };

  return (
    <section className="min-w-0 space-y-4">
      <div className="min-w-0 rounded-2xl border border-slate-900/10 bg-white/80 p-3 shadow-sm shadow-slate-950/5 backdrop-blur sm:rounded-3xl sm:p-4 dark:border-white/10 dark:bg-white/[0.07]">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">Tarefas</h2>
            <p className="text-sm text-slate-500 dark:text-white/45">
              {visibleTaskCount} no quadro
            </p>
          </div>
        </div>

        <div className="mt-4 flex snap-x gap-2 overflow-x-auto overscroll-x-contain pb-1 touch-pan-x [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {[
            ["all", "Todas"],
            ["work", "Trabalho"],
            ["personal", "Pessoal"],
            ["travel", "Viagem"],
          ].map(([value, label]) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={viewFilter === value ? "default" : "outline"}
              className="h-11 snap-start touch-manipulation rounded-full px-4 md:h-7 md:px-2.5"
              onClick={() => setViewFilter(value as TaskView)}
            >
              {label}
            </Button>
          ))}
        </div>

        <div
          className={
            isCompact
              ? "mt-4"
              : "mt-4 grid gap-2 md:grid-cols-[1.4fr_0.8fr_0.9fr]"
          }
        >
          <label className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="h-11 min-w-0 rounded-2xl border-slate-900/10 bg-white pl-9 text-base shadow-none md:h-10 md:text-sm dark:border-white/10 dark:bg-black/20"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar tarefa, categoria ou subtarefa"
            />
          </label>

          {!isCompact ? (
            <Select
              value={priorityFilter}
              onValueChange={(value) =>
                setPriorityFilter((value ?? "all") as PriorityFilter)
              }
            >
              <SelectTrigger className="h-11 w-full rounded-2xl border-slate-900/10 bg-white py-0 shadow-none md:h-10 dark:border-white/10 dark:bg-black/20">
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
              <SelectTrigger className="h-11 w-full rounded-2xl border-slate-900/10 bg-white py-0 shadow-none md:h-10 dark:border-white/10 dark:bg-black/20">
                <span className="flex h-full items-center text-sm">
                  {categoryFilter === "all"
                    ? "Todas categorias"
                    : categoryFilter}
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
        <div className="rounded-2xl border border-dashed border-slate-900/15 bg-white/55 p-6 text-center shadow-sm sm:rounded-3xl sm:p-10 dark:border-white/10 dark:bg-white/[0.04]">
          <CirclePlus className="mx-auto size-8 text-slate-400" />
          <p className="mt-3 font-medium">Nada por aqui nesta vista.</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-white/45">
            Ajuste os filtros ou crie uma nova tarefa acima.
          </p>
        </div>
      ) : (
        <div className="grid min-w-max grid-cols-4 items-start gap-4 pb-3 xl:min-w-0">
          {taskSectionOrder.map((section) => {
            const tasksByBucket = groupedTasks[section];

            return (
              <section
                key={section}
                className="flex w-80 min-w-80 flex-col rounded-3xl border border-slate-900/10 bg-white/55 p-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/[0.04] xl:w-auto xl:min-w-0"
              >
                <div className="mb-3 flex items-center gap-2 px-1">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${taskSectionStyles[section]}`}
                  >
                    {getStatusLabel(section)}
                  </span>
                  <span className="ml-auto text-xs text-slate-500 dark:text-white/45">
                    {tasksByBucket.length}
                  </span>
                </div>

                <ul
                  className="min-h-24 space-y-3"
                  onDragOver={(event) => handleDragOver(event)}
                  onDrop={(event) => handleDropOnColumn(event, section)}
                >
                  {tasksByBucket.length === 0 ? (
                    <li className="rounded-2xl border border-dashed border-slate-900/15 px-3 py-5 text-center text-xs text-slate-500 dark:border-white/10 dark:text-white/40">
                      Arraste uma tarefa para cá
                    </li>
                  ) : null}
                    {tasksByBucket.map((task) => {
                      const isCompleted = task.status === "completed";
                      const isBusy = busyTaskId === task.id;
                      const isEditing =
                        editingTaskId === task.id && editingState;
                      const isExpanded = expandedTaskId === task.id;

                      const completedSubtasks = task.subtasks.filter(
                        (item) => item.is_completed,
                      ).length;
                      const hasSubtasks = task.subtasks.length > 0;
                      const subtaskPercent = hasSubtasks
                        ? Math.round(
                            (completedSubtasks / task.subtasks.length) * 100,
                          )
                        : 0;
                      const shouldSuggestComplete =
                        task.status !== "completed" &&
                        hasSubtasks &&
                        completedSubtasks === task.subtasks.length;

                      return (
                        <li
                          key={task.id}
                          onDragOver={(event) => handleDragOver(event, task.id)}
                          onDrop={(event) => handleDropOnTask(event, task.id)}
                          className={[
                            "group min-w-0 border bg-white/85 shadow-sm shadow-slate-950/5 transition duration-200 sm:hover:-translate-y-0.5 sm:hover:shadow-md dark:bg-zinc-950/70 dark:shadow-black/20",
                            draggingTaskId === task.id
                              ? "scale-[0.99] opacity-55"
                              : "",
                            dragOverTaskId === task.id &&
                            draggingTaskId !== task.id
                              ? "ring-2 ring-teal-400/60"
                              : "",
                            isCompact
                              ? "rounded-2xl p-2.5"
                              : "rounded-2xl p-3 sm:rounded-3xl sm:p-4",
                            isCompleted
                              ? "border-emerald-500/25"
                              : "border-slate-900/10 dark:border-white/10",
                          ].join(" ")}
                        >
                          <div className="grid min-w-0 grid-cols-[auto_auto_minmax(0,1fr)] items-start gap-x-3 gap-y-3 md:grid-cols-[auto_auto_minmax(0,1fr)_auto] md:gap-4">
                            <button
                              type="button"
                              draggable={!isEditing && !isCompleted}
                              onDragStart={(event) =>
                                handleDragStart(event, task.id)
                              }
                              onDragEnd={handleDragEnd}
                              className="col-start-1 row-start-2 inline-flex size-11 touch-manipulation self-center cursor-grab items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-900/5 hover:text-slate-600 active:cursor-grabbing md:col-start-1 md:row-start-1 md:size-8 dark:hover:bg-white/10 dark:hover:text-white/70"
                              aria-label="Arrastar tarefa"
                              aria-grabbed={draggingTaskId === task.id}
                              title="Arrastar tarefa"
                            >
                              <GripVertical className="size-4" />
                            </button>

                            <Checkbox
                              checked={isCompleted}
                              onCheckedChange={() => onToggleTask(task)}
                              disabled={isBusy}
                              aria-label="Concluir tarefa"
                              className="col-start-2 row-start-2 size-5 self-center after:-inset-3 md:col-start-2 md:row-start-1 md:mt-1 md:size-4 md:self-start md:after:-inset-x-3 md:after:-inset-y-2"
                            />

                            <div
                              className={[
                                "col-span-3 col-start-1 row-start-1 min-w-0 md:col-span-1 md:col-start-3 md:row-start-1",
                                isCompact ? "space-y-2" : "space-y-3",
                              ].join(" ")}
                            >
                              {isEditing ? (
                                <TaskEditForm
                                  task={task}
                                  editingState={editingState}
                                  setEditingState={setEditingState}
                                  isSaving={isBusy}
                                  onCancel={cancelEdit}
                                  onDirtyChange={onEditDirtyChange}
                                  onSave={async ({
                                    attachments,
                                    attachmentIdsToDelete,
                                  }) => {
                                    const nextTitle = editingState.title.trim();

                                    if (!nextTitle) {
                                      return;
                                    }

                                    const taskWasUpdated = await onUpdateTask(task.id, {
                                      title: nextTitle,
                                      description:
                                        editingState.description.trim() || null,
                                      priority: editingState.priority,
                                      category:
                                        editingState.category.trim() || null,
                                    });
                                    if (!taskWasUpdated) return;

                                    for (const attachmentId of attachmentIdsToDelete) {
                                      await onDeleteAttachment(
                                        task.id,
                                        attachmentId,
                                      );
                                    }
                                    for (const attachment of attachments) {
                                      await onAddAttachment(
                                        task.id,
                                        attachment,
                                      );
                                    }
                                    cancelEdit();
                                  }}
                                />
                              ) : (
                                <>
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setExpandedTaskId((current) =>
                                            current === task.id ? null : task.id,
                                          )
                                        }
                                        aria-expanded={isExpanded}
                                        className={[
                                          "w-full text-left",
                                          isCompact
                                            ? "break-words text-base font-semibold leading-snug [overflow-wrap:anywhere]"
                                            : "break-words text-lg font-semibold leading-snug [overflow-wrap:anywhere]",
                                          isCompleted
                                            ? "text-slate-400 line-through dark:text-white/35"
                                            : "",
                                        ].join(" ")}
                                      >
                                        {task.title}
                                      </button>
                                      {isExpanded && task.description ? (
                                        <p className="mt-1 break-words text-sm text-slate-500 [overflow-wrap:anywhere] dark:text-white/45">
                                          {task.description}
                                        </p>
                                      ) : null}
                                      {isExpanded && task.attachments.length ? (
                                        <div className="mt-3 flex flex-wrap gap-2">
                                          {sortAttachments(
                                            task.attachments,
                                          ).map((attachment, index) => (
                                            <button
                                              key={attachment.id}
                                              type="button"
                                              onClick={() =>
                                                setAttachmentViewer({
                                                  task: {
                                                    ...task,
                                                    attachments:
                                                      sortAttachments(
                                                        task.attachments,
                                                      ),
                                                  },
                                                  index,
                                                })
                                              }
                                              className="group/image overflow-hidden rounded-xl border border-slate-900/10 dark:border-white/10"
                                              title={`Abrir ${attachment.file_name}`}
                                            >
                                              <AttachmentPreview
                                                attachment={attachment}
                                                taskId={task.id}
                                              />
                                            </button>
                                          ))}
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>

                                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                                    <Badge
                                      variant={
                                        isCompleted ? "secondary" : "default"
                                      }
                                    >
                                      {getStatusLabel(task.status)}
                                    </Badge>
                                    <Badge
                                      className={getPriorityClass(
                                        task.priority,
                                      )}
                                    >
                                      {getPriorityLabel(task.priority)}
                                    </Badge>
                                    {task.category ? (
                                      <Badge
                                        variant="outline"
                                        className="max-w-full truncate"
                                        title={task.category}
                                      >
                                        {task.category}
                                      </Badge>
                                    ) : null}
                                    {task.attachments.length ? (
                                      <Badge
                                        variant="outline"
                                        className="gap-1"
                                      >
                                        <ImageIcon className="size-3" />{" "}
                                        {task.attachments.length}
                                      </Badge>
                                    ) : null}
                                  </div>
                                </>
                              )}

                              {!isExpanded && hasSubtasks ? (
                                <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-white/45">
                                  <span>
                                    Subtarefas {completedSubtasks}/
                                    {task.subtasks.length}
                                  </span>
                                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-900/10 dark:bg-white/10">
                                    <div
                                      className="h-full rounded-full bg-teal-500"
                                      style={{ width: `${subtaskPercent}%` }}
                                    />
                                  </div>
                                  {shouldSuggestComplete ? (
                                    <Button
                                      size="sm"
                                      className="h-11 touch-manipulation rounded-full bg-emerald-500 px-4 text-xs text-white md:h-7 md:px-3 hover:bg-emerald-600"
                                      onClick={async () => {
                                        await onUpdateTask(task.id, {
                                          status: "completed",
                                        });
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
                                  isExpanded ? "" : "hidden",
                                ].join(" ")}
                              >
                                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                                    <p className="text-xs font-semibold uppercase text-slate-500 dark:text-white/45">
                                      Subtarefas {completedSubtasks}/
                                      {task.subtasks.length}
                                    </p>
                                    {hasSubtasks ? (
                                      <div className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-slate-900/10 sm:w-24 sm:flex-none dark:bg-white/10">
                                        <div
                                          className="h-full rounded-full bg-teal-500"
                                          style={{
                                            width: `${subtaskPercent}%`,
                                          }}
                                        />
                                      </div>
                                    ) : null}
                                  </div>

                                  {shouldSuggestComplete ? (
                                    <Button
                                      size="sm"
                                      className="h-11 touch-manipulation rounded-full bg-emerald-500 px-4 text-white md:h-7 md:px-2.5 hover:bg-emerald-600"
                                      onClick={async () => {
                                        await onUpdateTask(task.id, {
                                          status: "completed",
                                        });
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
                                        className="flex min-w-0 items-center justify-between gap-2 rounded-xl bg-white/70 px-2 py-1.5 dark:bg-black/20"
                                      >
                                        <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2">
                                          <Checkbox
                                            checked={subtask.is_completed}
                                            onCheckedChange={() =>
                                              onToggleSubtask(
                                                subtask.id,
                                                !subtask.is_completed,
                                              )
                                            }
                                            className="size-5 after:-inset-3 md:size-4 md:after:-inset-x-3 md:after:-inset-y-2"
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
                                          className="size-11 touch-manipulation md:size-7"
                                          onClick={() =>
                                            setConfirmDeleteSubtask({
                                              id: subtask.id,
                                              title: subtask.title,
                                            })
                                          }
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

                                <form
                                  onSubmit={(event) =>
                                    submitSubtask(event, task.id)
                                  }
                                  className="flex min-w-0 flex-col gap-2 sm:flex-row"
                                >
                                  <Input
                                    className="h-11 min-w-0 rounded-xl border-slate-900/10 bg-white text-base shadow-none sm:h-9 sm:text-sm dark:border-white/10 dark:bg-black/20"
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
                                  <Button
                                    type="submit"
                                    variant="outline"
                                    className="h-11 w-full touch-manipulation rounded-xl px-4 sm:h-9 sm:w-auto"
                                  >
                                    <CirclePlus className="size-4" />
                                    Adicionar
                                  </Button>
                                </form>
                              </div>
                            </div>

                            <div
                              className={[
                                "gap-2 md:gap-1.5",
                                isCompact
                                  ? "col-start-3 row-start-2 flex flex-wrap items-center justify-end md:col-start-4 md:row-start-1 md:flex-row"
                                  : "col-span-3 col-start-1 row-start-3 grid grid-cols-2 self-stretch [&>button]:w-full md:col-span-1 md:col-start-4 md:row-start-1 md:flex md:self-center md:items-center md:justify-end md:[&>button]:w-auto md:flex-col",
                              ].join(" ")}
                            >
                              <Button
                                type="button"
                                size={isCompact ? "icon-sm" : "icon"}
                                variant="ghost"
                                className={
                                  isCompact
                                    ? "size-11 touch-manipulation md:size-7"
                                    : "size-11 touch-manipulation md:size-8"
                                }
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
                                className={
                                  isCompact
                                    ? "size-11 touch-manipulation md:size-7"
                                    : "size-11 touch-manipulation md:size-8"
                                }
                                onClick={() =>
                                  setConfirmDeleteTask({
                                    id: task.id,
                                    title: task.title,
                                  })
                                }
                                disabled={isBusy}
                                aria-label="Excluir tarefa"
                              >
                                <Trash2 className="size-4 text-rose-500" />
                              </Button>
                              <Select
                                value={task.status}
                                disabled={isBusy}
                                onValueChange={(value) =>
                                  onUpdateTask(task.id, {
                                    status: value ?? "not_started",
                                  })
                                }
                              >
                                <SelectTrigger className="h-11 w-full rounded-full border-slate-900/10 bg-white px-3 text-xs shadow-none md:h-8 dark:border-white/10 dark:bg-black/20">
                                  <span>{getStatusLabel(task.status)}</span>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="not_started">
                                    Não iniciada
                                  </SelectItem>
                                  <SelectItem value="in_progress">
                                    Em andamento
                                  </SelectItem>
                                  <SelectItem value="waiting">
                                    Aguardando
                                  </SelectItem>
                                  <SelectItem value="completed">
                                    Finalizada
                                  </SelectItem>
                                </SelectContent>
                              </Select>
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

      <AttachmentViewer
        viewer={attachmentViewer}
        onClose={() => setAttachmentViewer(null)}
        onChangeIndex={(index) =>
          setAttachmentViewer((current) =>
            current ? { ...current, index } : current,
          )
        }
      />

      <ConfirmDialog
        open={Boolean(confirmDeleteTask)}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteTask(null);
        }}
        title="Excluir tarefa"
        description={`Tem certeza que deseja excluir "${confirmDeleteTask?.title ?? ""}"? Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        onConfirm={async () => {
          if (!confirmDeleteTask) return;
          setDeletingConfirm(true);
          try {
            await onDeleteTask(confirmDeleteTask.id);
          } finally {
            setDeletingConfirm(false);
            setConfirmDeleteTask(null);
          }
        }}
        loading={deletingConfirm}
      />

      <ConfirmDialog
        open={Boolean(confirmDeleteSubtask)}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteSubtask(null);
        }}
        title="Excluir subtarefa"
        description={`Tem certeza que deseja excluir "${confirmDeleteSubtask?.title ?? ""}"? Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        onConfirm={async () => {
          if (!confirmDeleteSubtask) return;
          setDeletingConfirm(true);
          try {
            await onDeleteSubtask(confirmDeleteSubtask.id);
          } finally {
            setDeletingConfirm(false);
            setConfirmDeleteSubtask(null);
          }
        }}
        loading={deletingConfirm}
      />
    </section>
  );
}

function isImageAttachment(mimeType: string) {
  return mimeType.startsWith("image/");
}

function sortAttachments(attachments: TaskAttachment[]) {
  return [...attachments].sort((left, right) => {
    const leftTypeRank = isImageAttachment(left.mime_type) ? 0 : 1;
    const rightTypeRank = isImageAttachment(right.mime_type) ? 0 : 1;

    if (leftTypeRank !== rightTypeRank) {
      return leftTypeRank - rightTypeRank;
    }

    const typeComparison = left.mime_type.localeCompare(
      right.mime_type,
      "pt-BR",
      {
        sensitivity: "base",
      },
    );
    if (typeComparison !== 0) {
      return typeComparison;
    }

    return left.file_name.localeCompare(right.file_name, "pt-BR", {
      numeric: true,
      sensitivity: "base",
    });
  });
}

function AttachmentViewer({
  viewer,
  onClose,
  onChangeIndex,
}: {
  viewer: { task: Task; index: number } | null;
  onClose: () => void;
  onChangeIndex: (index: number) => void;
}) {
  const attachment = viewer?.task.attachments[viewer.index];
  const count = viewer?.task.attachments.length ?? 0;

  return (
    <Dialog
      open={Boolean(viewer && attachment)}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent
        className="h-[min(90vh,64rem)] w-[min(96vw,96rem)] max-w-[96rem] grid-rows-[auto_minmax(0,1fr)] gap-3 bg-zinc-950 p-4 text-white sm:max-w-[96rem]"
        showCloseButton
      >
        <DialogTitle className="pr-9 text-sm" title={attachment?.file_name}>
          {attachment?.file_name ?? "Imagem anexada"}
        </DialogTitle>
        {viewer && attachment ? (
          <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl bg-black/50">
            {isImageAttachment(attachment.mime_type) ? (
              <>
                {/* This authenticated API route cannot use Next's remote image optimizer. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/tasks/${viewer.task.id}/attachments/${attachment.id}`}
                  alt={attachment.file_name}
                  className="max-h-[calc(90vh-7rem)] w-auto max-w-full rounded-lg object-contain"
                />
              </>
            ) : (
              <a
                href={`/api/tasks/${viewer.task.id}/attachments/${attachment.id}`}
                download
                className="flex min-h-44 flex-col items-center justify-center gap-3 rounded-xl px-8 text-center hover:bg-white/5"
              >
                <FileText className="size-12 text-slate-400" />
                <span className="max-w-64 break-words">
                  {attachment.file_name}
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1.5 text-sm">
                  Baixar arquivo
                </span>
              </a>
            )}
            {count > 1 ? (
              <>
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full"
                  onClick={() =>
                    onChangeIndex((viewer.index - 1 + count) % count)
                  }
                  aria-label="Imagem anterior"
                >
                  <ChevronLeft className="size-5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full"
                  onClick={() => onChangeIndex((viewer.index + 1) % count)}
                  aria-label="Próxima imagem"
                >
                  <ChevronRight className="size-5" />
                </Button>
                <span className="absolute bottom-3 rounded-full bg-black/65 px-2.5 py-1 text-xs">
                  {viewer.index + 1} de {count}
                </span>
              </>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function AttachmentPreview({
  attachment,
  taskId,
}: {
  attachment: TaskAttachment;
  taskId: string;
}) {
  if (!isImageAttachment(attachment.mime_type)) {
    return (
      <span
        className="flex size-16 items-center justify-center rounded-lg bg-slate-900/5 text-slate-500 dark:bg-white/10"
        title={attachment.file_name}
      >
        <FileText className="size-6" />
      </span>
    );
  }

  return (
    <>
      {/* This authenticated API route cannot use Next's remote image optimizer. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/tasks/${taskId}/attachments/${attachment.id}`}
        alt={attachment.file_name}
        className="size-16 rounded-lg object-cover transition group-hover/image:scale-105"
      />
    </>
  );
}

function TaskEditForm({
  task,
  editingState,
  setEditingState,
  onSave,
  onCancel,
  onDirtyChange,
  isSaving = false,
}: {
  task: Task;
  editingState: EditingState;
  setEditingState: Dispatch<SetStateAction<EditingState | null>>;
  onSave: (changes: {
    attachments: File[];
    attachmentIdsToDelete: string[];
  }) => Promise<void>;
  onCancel: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
  isSaving?: boolean;
}) {
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);
  const [attachmentIdsToDelete, setAttachmentIdsToDelete] = useState<string[]>(
    [],
  );
  const [attachmentPendingDeletion, setAttachmentPendingDeletion] =
    useState<TaskAttachment | null>(null);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);

  const hasDetailChanges =
    editingState.title !== task.title ||
    editingState.description !== (task.description ?? "") ||
    editingState.category !== (task.category ?? "") ||
    editingState.priority !== task.priority;
  const hasChanges =
    hasDetailChanges ||
    pendingAttachments.length > 0 ||
    attachmentIdsToDelete.length > 0;

  useEffect(() => {
    onDirtyChange?.(hasChanges);
    return () => onDirtyChange?.(false);
  }, [hasChanges, onDirtyChange]);

  const selectAttachments = (files: File[]) => {
    setPendingAttachments((current) => [...current, ...files]);
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    const files = Array.from(event.clipboardData.files);
    if (!files.length) return;
    event.preventDefault();
    selectAttachments(files);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggingFiles(false);
    const files = Array.from(event.dataTransfer.files);
    if (files.length) selectAttachments(files);
  };

  return (
    <div
      className={[
        "min-w-0 space-y-2 rounded-2xl transition",
        isDraggingFiles
          ? "bg-teal-500/5 ring-2 ring-teal-400/70 ring-inset"
          : "",
      ].join(" ")}
      onPaste={handlePaste}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDraggingFiles(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setIsDraggingFiles(false);
      }}
      onDrop={handleDrop}
    >
      <Input
        className="h-11 min-w-0 rounded-2xl border-slate-900/10 bg-white text-base shadow-none sm:h-10 sm:text-sm dark:border-white/10 dark:bg-black/20 disabled:opacity-60"
        value={editingState.title}
        disabled={isSaving}
        onChange={(event) =>
          setEditingState((current) =>
            current ? { ...current, title: event.target.value } : current,
          )
        }
        maxLength={120}
      />

      <Textarea
        className="min-h-20 rounded-2xl border-slate-900/10 bg-white shadow-none dark:border-white/10 dark:bg-black/20 disabled:opacity-60"
        value={editingState.description}
        disabled={isSaving}
        onChange={(event) =>
          setEditingState((current) =>
            current ? { ...current, description: event.target.value } : current,
          )
        }
        placeholder="Descrição opcional"
        rows={3}
      />

      <div className="rounded-2xl border border-slate-900/10 p-3 dark:border-white/10">
        <p className="mb-2 text-xs font-medium text-slate-500 dark:text-white/45">
          Anexos
        </p>
        {task.attachments.length ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {sortAttachments(task.attachments)
              .filter((item) => !attachmentIdsToDelete.includes(item.id))
              .map((item) => (
                <div key={item.id} className="relative">
                  <AttachmentPreview attachment={item} taskId={task.id} />
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="destructive"
                    className="absolute -right-2 -top-2 size-6 rounded-full"
                    disabled={isSaving}
                    onClick={() => setAttachmentPendingDeletion(item)}
                    aria-label={`Excluir ${item.file_name}`}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              ))}
          </div>
        ) : null}
        <label
          className={`inline-flex h-10 items-center gap-2 rounded-full border border-slate-900/10 px-3 text-sm dark:border-white/10 ${isSaving ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-slate-900/5 dark:hover:bg-white/10"}`}
        >
          <ImagePlus className="size-4" />
          Adicionar arquivo
          <input
            type="file"
            multiple
            className="sr-only"
            disabled={isSaving}
            onChange={(event) =>
              selectAttachments(Array.from(event.target.files ?? []))
            }
          />
        </label>
        {pendingAttachments.length ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {pendingAttachments.map((attachment, index) => (
              <span
                key={`${attachment.name}-${attachment.lastModified}-${index}`}
                className="flex items-center rounded-full bg-teal-500/10 pl-2.5 text-xs text-teal-700 dark:text-teal-200"
              >
                {attachment.name || "Arquivo"}
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="size-7"
                  onClick={() =>
                    setPendingAttachments((current) =>
                      current.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                  aria-label={`Remover ${attachment.name || "arquivo"}`}
                >
                  <X className="size-3" />
                </Button>
              </span>
            ))}
          </div>
        ) : null}
        <p className="mt-2 text-xs text-slate-500 dark:text-white/45">
          Você também pode colar um arquivo ou print com Ctrl+V. O arquivo será
          salvo ao clicar em “Salvar”.
        </p>
        {isDraggingFiles ? (
          <p className="mt-2 rounded-xl border border-dashed border-teal-500/60 bg-teal-500/10 px-3 py-2 text-center text-sm font-medium text-teal-700 dark:text-teal-200">
            Solte os arquivos para anexá-los
          </p>
        ) : null}
      </div>

      <div className="grid min-w-0 gap-2 sm:grid-cols-2">
        <Select
          value={editingState.priority}
          disabled={isSaving}
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
          <SelectTrigger className="h-11 w-full rounded-2xl border-slate-900/10 bg-white py-0 shadow-none sm:h-10 dark:border-white/10 dark:bg-black/20">
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
          className="h-11 min-w-0 rounded-2xl border-slate-900/10 bg-white text-base shadow-none sm:h-10 sm:text-sm dark:border-white/10 dark:bg-black/20 disabled:opacity-60"
          value={editingState.category}
          disabled={isSaving}
          onChange={(event) =>
            setEditingState((current) =>
              current ? { ...current, category: event.target.value } : current,
            )
          }
          placeholder="Categoria"
          list="category-suggestions-edit"
        />

      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          className="h-11 flex-1 gap-1.5 touch-manipulation rounded-full px-4 sm:h-7 sm:flex-none sm:px-2.5"
          onClick={() =>
            onSave({ attachments: pendingAttachments, attachmentIdsToDelete })
          }
          disabled={!hasChanges || isSaving}
        >
          {isSaving ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Salvando…
            </>
          ) : (
            "Salvar"
          )}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-11 flex-1 touch-manipulation rounded-full px-4 sm:h-7 sm:flex-none sm:px-2.5"
          onClick={onCancel}
          disabled={isSaving}
        >
          Cancelar
        </Button>
      </div>

      <ConfirmDialog
        open={Boolean(attachmentPendingDeletion)}
        onOpenChange={(open) => {
          if (!open) setAttachmentPendingDeletion(null);
        }}
        title="Remover anexo"
        description={`Tem certeza que deseja remover "${attachmentPendingDeletion?.file_name ?? ""}"? A exclusão será aplicada ao salvar a tarefa.`}
        confirmLabel="Remover"
        onConfirm={() => {
          if (!attachmentPendingDeletion) return;
          setAttachmentIdsToDelete((current) =>
            current.includes(attachmentPendingDeletion.id)
              ? current
              : [...current, attachmentPendingDeletion.id],
          );
          setAttachmentPendingDeletion(null);
        }}
      />
    </div>
  );
}
