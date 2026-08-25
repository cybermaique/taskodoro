"use client";

import {
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  type FormEvent,
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type SetStateAction,
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Bug,
  Heart,
  Circle,
  CirclePlus,
  CalendarDays,
  History,
  Pencil,
  Search,
  Trash2,
  X,
  ImageIcon,
  ImagePlus,
  FileText,
  FileAudio,
  FileCode2,
  File,
  Paperclip,
  GripVertical,
  BookOpen,
  Plane,
  HeartPulse,
  WalletCards,
  UserRound,
  Loader2,
  Lightbulb,
  ListTodo,
  Sparkles,
} from "lucide-react";
import { createPortal } from "react-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  ContextMenu,
  type ContextMenuAction,
} from "@/components/ui/context-menu";
import { TaskDescription } from "@/components/task-description";
import { TaskDropCelebration } from "@/components/task-drop-celebration";
import { formatCompactDate, formatDateTime } from "@/lib/format";
import { expandSlashCodeCommand } from "@/lib/text-shortcuts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  getDefaultTaskType,
  getTaskCategoryLabel,
  getTaskTypeOptions,
  TASK_CATEGORY_OPTIONS,
  TASK_TYPE_OPTIONS,
} from "@/types/task";
import type {
  Task,
  TaskAttachment,
  DateDetails,
  TaskDescriptionHistory,
  TaskPriority,
  TaskStatusHistory,
  TaskType,
  TaskView,
} from "@/types/task";
import type { TaskColumnWidths } from "@/types/profile";

interface TasksListProps {
  tasks: Task[];
  newlyCreatedTaskId?: string | null;
  busyTaskId: string | null;
  isCompact?: boolean;
  initialColumnWidths: TaskColumnWidths | null;
  onColumnWidthsChange?: (widths: TaskColumnWidths) => Promise<void>;
  onRequestCreate?: () => void;
  onEditDirtyChange?: (isDirty: boolean) => void;
  onDeleteTask: (taskId: string) => Promise<boolean>;
  onUpdateTask: (
    taskId: string,
    payload: Record<string, unknown>,
  ) => Promise<boolean>;
  onRestoreTaskDescription: (
    taskId: string,
    historyId: string,
  ) => Promise<boolean>;
  onAddAttachment: (taskId: string, file: File) => Promise<void>;
  onDeleteAttachment: (taskId: string, attachmentId: string) => Promise<void>;
  onCreateSubtask: (taskId: string, title: string) => Promise<boolean>;
  onToggleSubtask: (subtaskId: string, isCompleted: boolean) => Promise<void>;
  onRenameSubtask: (subtaskId: string, title: string) => Promise<void>;
  onDeleteSubtask: (subtaskId: string) => Promise<void>;
  onReorderSubtasks: (taskId: string, subtaskIds: string[]) => Promise<boolean>;
  onReorderTasks: (taskIds: string[]) => Promise<void>;
  onAddTaskComment: (taskId: string, content: string) => Promise<void>;
  onDeleteTaskComment: (taskId: string, commentId: string) => Promise<void>;
}

type PriorityFilter = "all" | TaskPriority;
type TaskSection = Task["status"];

const taskViewStorageKey = "taskboard_task_view_filter";
const taskPriorityStorageKey = "taskboard_task_priority_filter";

interface EditingState {
  title: string;
  description: string;
  category: string;
  priority: TaskPriority;
  type: TaskType;
}

interface TaskContextMenuState {
  taskId: string;
  x: number;
  y: number;
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

function getTaskTypeLabel(type: TaskType) {
  return TASK_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? "Tarefa";
}

function getTaskTypeClass(type: TaskType) {
  if (type === "bug") {
    return "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-200";
  }

  if (type === "feature") {
    return "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-200";
  }

  if (type === "improvement") {
    return "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-200";
  }

  if (
    type === "date" ||
    type === "study" ||
    type === "travel" ||
    type === "health" ||
    type === "finance" ||
    type === "personal"
  ) {
    return "border-pink-500/30 bg-pink-500/10 text-pink-700 dark:text-pink-200";
  }

  return "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-200";
}

function TaskTypeBadge({ taskType }: { taskType: TaskType }) {
  const Icon =
    taskType === "bug"
      ? Bug
      : taskType === "feature"
      ? Sparkles
      : taskType === "improvement"
        ? Lightbulb
        : taskType === "date"
          ? Heart
          : taskType === "study"
          ? BookOpen
          : taskType === "travel"
            ? Plane
            : taskType === "health"
              ? HeartPulse
              : taskType === "finance"
                ? WalletCards
                : taskType === "personal"
                  ? UserRound
                  : ListTodo;

  return (
    <Badge className={`gap-1 ${getTaskTypeClass(taskType)}`}>
      <Icon className="size-3" />
      {getTaskTypeLabel(taskType)}
    </Badge>
  );
}

function getTaskHistory(task: Task): TaskStatusHistory[] {
  const history = Array.isArray(task.status_history)
    ? [...task.status_history].sort(
        (left, right) =>
          new Date(left.changed_at).getTime() -
          new Date(right.changed_at).getTime(),
      )
    : [];

  if (history.length) {
    return history;
  }

  return [
    {
      id: `fallback-${task.id}`,
      task_id: task.id,
      from_status: null,
      to_status: task.status,
      changed_at: task.created_at,
    },
  ];
}

function TaskHistoryTimeline({
  task,
  compact = false,
}: {
  task: Task;
  compact?: boolean;
}) {
  const history = getTaskHistory(task);

  return (
    <ol
      className={[
        "space-y-2.5 pl-1",
        compact ? "pr-1" : "",
      ].join(" ")}
    >
      {history.map((event, index) => (
        <li key={event.id} className="relative flex min-w-0 gap-2.5">
          {index < history.length - 1 ? (
            <span className="absolute left-[0.28rem] top-3 h-[calc(100%+0.55rem)] w-px bg-current opacity-15" />
          ) : null}
          <span
            className={[
              "relative mt-1 size-2 shrink-0 rounded-full ring-4 ring-inherit",
              event.from_status === null
                ? "bg-sky-400"
                : event.to_status === "completed"
                  ? "bg-emerald-400"
                  : "bg-teal-400",
            ].join(" ")}
          />
          <div className="min-w-0">
            <p className="truncate text-[0.7rem] font-semibold text-current">
              {event.from_status
                ? `${getStatusLabel(event.from_status)} → ${getStatusLabel(event.to_status)}`
                : "Criada"}
            </p>
            <time
              dateTime={event.changed_at}
              className="text-[0.65rem] text-current opacity-55"
            >
              {formatDateTime(event.changed_at)}
            </time>
          </div>
        </li>
      ))}
    </ol>
  );
}

function TaskCreationDate({ task }: { task: Task }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[0.65rem] font-medium text-slate-500/80 dark:text-white/40"
      aria-label={`Criada em ${formatCompactDate(task.created_at)}`}
    >
      <CalendarDays className="size-3" />
      {formatCompactDate(task.created_at)}
    </span>
  );
}

function TaskCardAction({
  label,
  onClick,
  children,
  destructive = false,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  destructive?: boolean;
  disabled?: boolean;
}) {
  return (
    <div
      data-task-action="true"
      draggable={false}
      className="group/task-action relative size-11 shrink-0 cursor-pointer sm:size-8"
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      onMouseDown={(event) => {
        event.stopPropagation();
      }}
      onDragStart={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <Button
        type="button"
        size="icon"
        variant="ghost"
        data-task-action="true"
        aria-label={label}
        title={label}
        disabled={disabled}
        draggable={false}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
        onDragStart={(event) => event.preventDefault()}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onClick();
        }}
        className={[
          "size-full rounded-full text-slate-500 transition-colors hover:text-slate-700 sm:text-slate-400 dark:hover:text-white",
          destructive
            ? "hover:text-rose-500 dark:hover:text-rose-300"
            : "hover:text-teal-600 dark:hover:text-teal-300",
        ].join(" ")}
      >
        {children}
      </Button>
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute right-0 top-full z-[60] mt-1 whitespace-nowrap rounded-lg border border-slate-900/10 bg-white/95 px-2 py-1 text-[0.68rem] font-semibold text-slate-700 opacity-0 shadow-lg backdrop-blur transition-all duration-150 group-hover/task-action:visible group-hover/task-action:translate-y-0 group-hover/task-action:opacity-100 dark:border-white/10 dark:bg-zinc-950/95 dark:text-white/85"
      >
        {label}
      </span>
    </div>
  );
}

function TaskHistoryAction({
  task,
  onClick,
}: {
  task: Task;
  onClick: () => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ left: 8, top: 8 });

  useEffect(() => {
    if (!tooltipOpen) return;

    const updateTooltipPosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const triggerRect = trigger.getBoundingClientRect();
      const tooltipWidth =
        tooltipRef.current?.offsetWidth ?? Math.min(384, window.innerWidth - 16);
      const tooltipHeight =
        tooltipRef.current?.offsetHeight ?? Math.min(480, window.innerHeight - 16);
      const maxLeft = Math.max(8, window.innerWidth - tooltipWidth - 8);
      const left = Math.min(
        Math.max(8, triggerRect.right - tooltipWidth),
        maxLeft,
      );
      const gap = 10;
      let top = triggerRect.top - tooltipHeight - gap;

      if (top < 8) {
        top = triggerRect.bottom + gap;
      }

      if (top + tooltipHeight > window.innerHeight - 8) {
        top = Math.max(8, window.innerHeight - tooltipHeight - 8);
      }

      setTooltipPosition({ left, top });
    };

    const frame = window.requestAnimationFrame(updateTooltipPosition);
    window.addEventListener("resize", updateTooltipPosition);
    window.addEventListener("scroll", updateTooltipPosition, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateTooltipPosition);
      window.removeEventListener("scroll", updateTooltipPosition, true);
    };
  }, [tooltipOpen]);

  const tooltip = tooltipOpen
    ? createPortal(
        <div
          ref={tooltipRef}
          id={`task-history-${task.id}`}
          role="tooltip"
          style={{ left: tooltipPosition.left, top: tooltipPosition.top }}
          className="pointer-events-none fixed z-[100] max-h-[calc(100dvh-1rem)] w-[min(24rem,calc(100vw-1rem))] overflow-y-auto overscroll-contain rounded-2xl border border-slate-900/10 bg-white/95 p-4 text-slate-700 opacity-100 shadow-2xl backdrop-blur-xl transition-opacity duration-150 dark:border-white/10 dark:bg-zinc-950/95 dark:text-white"
        >
          <div className="mb-2 flex items-center gap-1.5 text-[0.68rem] font-bold uppercase tracking-wide text-slate-500 dark:text-white/50">
            <History className="size-3.5 text-teal-500" />
            Histórico da tarefa
          </div>
          <TaskHistoryTimeline task={task} compact />
        </div>,
        document.body,
      )
    : null;

  return (
    <div
      data-task-action="true"
      draggable={false}
      className="relative size-11 shrink-0 cursor-pointer sm:size-8"
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      onMouseDown={(event) => {
        event.stopPropagation();
      }}
      onDragStart={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <Button
        ref={triggerRef}
        type="button"
        size="icon"
        variant="ghost"
        data-task-action="true"
        aria-label="Ver histórico"
        aria-describedby={tooltipOpen ? `task-history-${task.id}` : undefined}
        title="Ver histórico"
        draggable={false}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
        onDragStart={(event) => event.preventDefault()}
        onMouseEnter={() => setTooltipOpen(true)}
        onMouseLeave={() => setTooltipOpen(false)}
        onFocus={() => setTooltipOpen(true)}
        onBlur={() => setTooltipOpen(false)}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onClick();
        }}
        className="size-full rounded-full text-slate-500 transition-colors hover:text-teal-600 sm:text-slate-400 dark:hover:text-teal-300"
      >
        <History className="size-3.5" />
      </Button>
      {tooltip}
    </div>
  );
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

const taskCardBorderStyles: Record<TaskSection, string> = {
  not_started: "border-slate-400/25 dark:border-slate-400/20",
  in_progress: "border-sky-500/30 dark:border-sky-400/25",
  waiting: "border-amber-500/30 dark:border-amber-400/25",
  completed: "border-emerald-500/25 dark:border-emerald-400/25",
};

const taskOrderStorageKey = "taskboard_task_order";
const maxVisibleTasksPerColumn = 10;
const minTaskColumnWidth = 208;
const maxTaskColumnWidth = 704;

interface ColumnResizeState {
  pointerId: number;
  leftSection: TaskSection;
  rightSection: TaskSection;
  startX: number;
  startLeftWidth: number;
  startRightWidth: number;
  startWidths: TaskColumnWidths;
}

interface DropPoint {
  x: number;
  y: number;
}

interface DropCelebration {
  id: number;
  taskId: string;
  point: DropPoint;
  variant: "move" | "complete";
}

function areEqualStringArrays(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((item, index) => item === right[index])
  );
}

function readStoredTaskOrder() {
  return [];
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

function getOrderWithTaskNearTask(
  order: string[],
  tasks: Task[],
  taskId: string,
  targetTaskId: string,
  insertAfter: boolean,
) {
  if (taskId === targetTaskId) {
    return null;
  }

  const currentIds = normalizeTaskOrder(order, tasks);
  const nextOrder = currentIds.filter((currentTaskId) => currentTaskId !== taskId);
  const targetIndex = nextOrder.indexOf(targetTaskId);

  if (targetIndex === -1) {
    return null;
  }

  nextOrder.splice(targetIndex + (insertAfter ? 1 : 0), 0, taskId);

  return areEqualStringArrays(currentIds, nextOrder) ? null : nextOrder;
}

export function TasksList({
  tasks,
  newlyCreatedTaskId = null,
  busyTaskId,
  isCompact = false,
  initialColumnWidths,
  onColumnWidthsChange,
  onRequestCreate,
  onEditDirtyChange,
  onDeleteTask,
  onUpdateTask,
  onRestoreTaskDescription,
  onAddAttachment,
  onDeleteAttachment,
  onCreateSubtask,
  onToggleSubtask,
  onRenameSubtask,
  onDeleteSubtask,
  onReorderSubtasks,
  onReorderTasks,
  onAddTaskComment,
  onDeleteTaskComment,
}: TasksListProps) {
  const [viewFilter, setViewFilter] = useState<TaskView>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
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
  const [expandedTaskSections, setExpandedTaskSections] = useState<
    Partial<Record<TaskSection, boolean>>
  >({});
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [dropCelebration, setDropCelebration] =
    useState<DropCelebration | null>(null);
  const [taskColumnWidths, setTaskColumnWidths] =
    useState<TaskColumnWidths | null>(initialColumnWidths);
  const [canResizeColumns, setCanResizeColumns] = useState(false);
  const [resizingDividerIndex, setResizingDividerIndex] = useState<number | null>(
    null,
  );
  const [detailsTaskId, setDetailsTaskId] = useState<string | null>(null);
  const [historyTaskId, setHistoryTaskId] = useState<string | null>(null);
  const [descriptionHistoryTaskId, setDescriptionHistoryTaskId] = useState<
    string | null
  >(null);
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
  const [taskContextMenu, setTaskContextMenu] =
    useState<TaskContextMenuState | null>(null);
  const columnRefs = useRef<Partial<Record<TaskSection, HTMLElement | null>>>({});
  const taskColumnWidthsRef = useRef<TaskColumnWidths | null>(initialColumnWidths);
  const resizeStateRef = useRef<ColumnResizeState | null>(null);
  const dropCelebrationTimeoutRef = useRef<number | null>(null);
  const dropCelebrationSequenceRef = useRef(0);

  useEffect(() => {
    return () => {
      if (dropCelebrationTimeoutRef.current !== null) {
        window.clearTimeout(dropCelebrationTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      // Load view filter
      const storedView = window.localStorage.getItem(taskViewStorageKey);
      const isValidTaskView =
        storedView === "all" ||
        storedView === "work" ||
        storedView === "personal" ||
        storedView === "study" ||
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
    const timeoutId = window.setTimeout(() => {
      setTaskOrder(readStoredTaskOrder());
      setHasLoadedTaskOrder(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const syncResizableLayout = () => setCanResizeColumns(mediaQuery.matches);

    syncResizableLayout();
    mediaQuery.addEventListener("change", syncResizableLayout);

    return () => mediaQuery.removeEventListener("change", syncResizableLayout);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      taskColumnWidthsRef.current = initialColumnWidths;
      setTaskColumnWidths(initialColumnWidths);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [initialColumnWidths]);

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

  const filteredTasks = useMemo(() => {
    return orderedTasks.filter((task) => {
      if (task.id === newlyCreatedTaskId) {
        return true;
      }

      if (viewFilter === "work" && task.category !== "trabalho") {
        return false;
      }

      if (viewFilter === "personal" && task.category !== "pessoal") {
        return false;
      }

      if (viewFilter === "study" && task.type !== "study") {
        return false;
      }

      if (viewFilter === "travel" && task.type !== "travel") {
        return false;
      }

      if (priorityFilter !== "all" && task.priority !== priorityFilter) {
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
    orderedTasks,
    priorityFilter,
    search,
    viewFilter,
    newlyCreatedTaskId,
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
  const detailsTask =
    tasks.find((task) => task.id === detailsTaskId) ?? null;

  const startEdit = (task: Task) => {
    setDetailsTaskId(task.id);
    setEditingTaskId(task.id);
    setEditingState({
      title: task.title,
      description: task.description ?? "",
      category: task.category ?? "",
      priority: task.priority,
      type: task.type,
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

    const wasCreated = await onCreateSubtask(taskId, title);
    if (!wasCreated) return;
    setSubtaskDraftByTaskId((current) => ({ ...current, [taskId]: "" }));
  };

  const moveTaskNearTask = (
    taskId: string,
    targetTaskId: string,
    insertAfter: boolean,
  ) => {
    const nextOrder = getOrderWithTaskNearTask(
      normalizedTaskOrder,
      tasks,
      taskId,
      targetTaskId,
      insertAfter,
    );

    if (!nextOrder) {
      return false;
    }

    setTaskOrder(nextOrder);
    saveTaskOrder(nextOrder);
    void onReorderTasks(nextOrder);
    return true;
  };

  const moveTaskToEnd = (taskId: string) => {
    if (!tasks.some((task) => task.id === taskId)) {
      return false;
    }

    const currentIds = normalizeTaskOrder(normalizedTaskOrder, tasks);
    const nextOrder = currentIds.filter(
      (currentTaskId) => currentTaskId !== taskId,
    );
    nextOrder.push(taskId);

    if (areEqualStringArrays(currentIds, nextOrder)) {
      return false;
    }

    setTaskOrder(nextOrder);
    saveTaskOrder(nextOrder);
    void onReorderTasks(nextOrder);
    return true;
  };

  const handleDragStart = (event: DragEvent<HTMLElement>, taskId: string) => {
    if (
      event.target instanceof Element &&
      event.target.closest("[data-task-action='true']")
    ) {
      event.preventDefault();
      return;
    }

    setDraggingTaskId(taskId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", taskId);
  };

  const handleDragEnd = () => {
    setDraggingTaskId(null);
    setDragOverTaskId(null);
  };

  const openTaskContextMenu = (
    event: React.MouseEvent<HTMLLIElement>,
    task: Task,
  ) => {
    if (
      event.target instanceof Element &&
      event.target.closest("input, textarea, select, [contenteditable='true']")
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (editingTaskId === task.id) return;
    setTaskContextMenu({ taskId: task.id, x: event.clientX, y: event.clientY });
  };

  const contextMenuTask = taskContextMenu
    ? tasks.find((task) => task.id === taskContextMenu.taskId) ?? null
    : null;
  const historyTask = historyTaskId
    ? tasks.find((task) => task.id === historyTaskId) ?? null
    : null;
  const descriptionHistoryTask = descriptionHistoryTaskId
    ? tasks.find((task) => task.id === descriptionHistoryTaskId) ?? null
    : null;
  const taskContextMenuActions: ContextMenuAction[] = contextMenuTask
    ? [
        {
          label: "Editar tarefa",
          icon: Pencil,
          disabled: busyTaskId === contextMenuTask.id,
          onSelect: () => startEdit(contextMenuTask),
        },
        {
          label: "Excluir tarefa",
          icon: Trash2,
          destructive: true,
          disabled: busyTaskId === contextMenuTask.id,
          onSelect: () =>
            setConfirmDeleteTask({
              id: contextMenuTask.id,
              title: contextMenuTask.title,
            }),
        },
      ]
    : [];

  const celebrateDrop = (
    taskId: string,
    point: DropPoint,
    variant: DropCelebration["variant"],
  ) => {
    if (dropCelebrationTimeoutRef.current !== null) {
      window.clearTimeout(dropCelebrationTimeoutRef.current);
    }

    dropCelebrationSequenceRef.current += 1;
    const celebrationId = dropCelebrationSequenceRef.current;
    setDropCelebration({ id: celebrationId, taskId, point, variant });
    dropCelebrationTimeoutRef.current = window.setTimeout(() => {
      setDropCelebration((current) =>
        current?.id === celebrationId ? null : current,
      );
      dropCelebrationTimeoutRef.current = null;
    }, 2800);
  };

  const getDropPoint = (event: DragEvent<HTMLElement>): DropPoint => {
    const rect = event.currentTarget.getBoundingClientRect();

    return {
      x: event.clientX || rect.left + rect.width / 2,
      y: event.clientY || rect.top + rect.height / 2,
    };
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
    const dropPoint = getDropPoint(event);
    handleDragEnd();

    if (taskId) {
      const taskToMove = tasks.find((task) => task.id === taskId);
      const targetTask = tasks.find((task) => task.id === targetTaskId);
      if (!taskToMove || !targetTask) {
        return;
      }

      const targetRect = event.currentTarget.getBoundingClientRect();
      const insertAfter = event.clientY > targetRect.top + targetRect.height / 2;

      if (taskToMove.status === targetTask.status) {
        if (!moveTaskNearTask(taskId, targetTaskId, insertAfter)) {
          return;
        }

        celebrateDrop(taskId, dropPoint, "move");
        return;
      }

      const wasUpdated = await onUpdateTask(taskId, {
        status: targetTask.status,
      });
      if (!wasUpdated) return;

      moveTaskNearTask(taskId, targetTaskId, insertAfter);
      celebrateDrop(
        taskId,
        dropPoint,
        taskToMove?.status !== "completed" &&
          targetTask?.status === "completed"
          ? "complete"
          : "move",
      );
    }
  };

  const handleDropOnColumn = async (
    event: DragEvent<HTMLUListElement>,
    status: TaskSection,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const taskId = event.dataTransfer.getData("text/plain") || draggingTaskId;
    const dropPoint = getDropPoint(event);
    handleDragEnd();

    if (taskId) {
      const taskToMove = tasks.find((task) => task.id === taskId);
      if (!taskToMove) {
        return;
      }

      if (taskToMove.status === status) {
        const columnTasks = groupedTasks[status];
        const isAlreadyLast =
          columnTasks[columnTasks.length - 1]?.id === taskId;

        if (isAlreadyLast || !moveTaskToEnd(taskId)) {
          return;
        }

        celebrateDrop(taskId, dropPoint, "move");
        return;
      }

      const wasUpdated = await onUpdateTask(taskId, { status });
      if (!wasUpdated) return;

      moveTaskToEnd(taskId);
      celebrateDrop(
        taskId,
        dropPoint,
        taskToMove?.status !== "completed" && status === "completed"
          ? "complete"
          : "move",
      );
    }
  };

  const startColumnResize = (
    event: ReactPointerEvent<HTMLDivElement>,
    dividerIndex: number,
  ) => {
    if (!canResizeColumns || event.button !== 0) {
      return;
    }

    const leftSection = taskSectionOrder[dividerIndex];
    const rightSection = taskSectionOrder[dividerIndex + 1];
    const widths = taskSectionOrder.reduce<Partial<TaskColumnWidths>>(
      (current, section) => {
        const column = columnRefs.current[section];
        if (column) current[section] = column.getBoundingClientRect().width;
        return current;
      },
      {},
    );

    if (
      !leftSection ||
      !rightSection ||
      !taskSectionOrder.every((section) => typeof widths[section] === "number")
    ) {
      return;
    }

    const measuredWidths = widths as TaskColumnWidths;
    resizeStateRef.current = {
      pointerId: event.pointerId,
      leftSection,
      rightSection,
      startX: event.clientX,
      startLeftWidth: measuredWidths[leftSection],
      startRightWidth: measuredWidths[rightSection],
      startWidths: measuredWidths,
    };
    taskColumnWidthsRef.current = measuredWidths;
    setTaskColumnWidths(measuredWidths);
    setResizingDividerIndex(dividerIndex);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const resizeColumns = (event: ReactPointerEvent<HTMLDivElement>) => {
    const resizeState = resizeStateRef.current;
    if (!resizeState || resizeState.pointerId !== event.pointerId) {
      return;
    }

    const minDelta = Math.max(
      minTaskColumnWidth - resizeState.startLeftWidth,
      resizeState.startRightWidth - maxTaskColumnWidth,
    );
    const maxDelta = Math.min(
      maxTaskColumnWidth - resizeState.startLeftWidth,
      resizeState.startRightWidth - minTaskColumnWidth,
    );
    const requestedDelta = event.clientX - resizeState.startX;
    const delta = Math.min(Math.max(requestedDelta, minDelta), maxDelta);

    const nextWidths = {
      ...resizeState.startWidths,
      [resizeState.leftSection]: resizeState.startLeftWidth + delta,
      [resizeState.rightSection]: resizeState.startRightWidth - delta,
    };
    taskColumnWidthsRef.current = nextWidths;
    setTaskColumnWidths(nextWidths);
  };

  const stopColumnResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (resizeStateRef.current?.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const finalWidths = taskColumnWidthsRef.current;
    if (finalWidths && onColumnWidthsChange) {
      void onColumnWidthsChange(finalWidths);
    }
    resizeStateRef.current = null;
    setResizingDividerIndex(null);
  };

  return (
    <section className="dashboard-reveal-board min-w-0 space-y-4">
      <div className="dashboard-reveal-panel min-w-0 rounded-2xl border border-slate-900/10 bg-white/80 p-3 shadow-sm shadow-slate-950/5 backdrop-blur sm:rounded-3xl sm:p-4 dark:border-white/10 dark:bg-white/[0.07]">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold">Tarefas</h2>
              <p className="text-sm text-slate-500 dark:text-white/45">
                {visibleTaskCount} no quadro
              </p>
            </div>
            {onRequestCreate ? (
              <Button
                type="button"
                className="h-10 shrink-0 gap-1.5 rounded-full px-3 sm:px-4"
                onClick={onRequestCreate}
              >
                <CirclePlus className="size-4" />
                <span className="hidden sm:inline">Nova tarefa</span>
                <span className="sm:hidden">Nova</span>
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex snap-x gap-2 overflow-x-auto overscroll-x-contain pb-1 touch-pan-x [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {[
            ["all", "Todas"],
            ["work", "Trabalho"],
            ["personal", "Pessoal"],
            ["study", "Estudos"],
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
            isCompact ? "mt-4" : "mt-4 grid gap-2 md:grid-cols-[1.4fr_0.8fr]"
          }
        >
          <label className="app-live-search relative min-w-0">
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

        </div>
      </div>

      {filteredTasks.length === 0 ? (
        <div className="app-empty-signal dashboard-reveal-panel rounded-2xl border border-dashed border-slate-900/15 bg-white/55 p-6 text-center shadow-sm sm:rounded-3xl sm:p-10 dark:border-white/10 dark:bg-white/[0.04]">
          <CirclePlus className="mx-auto size-8 text-slate-400" />
          <p className="mt-3 font-medium">Nada por aqui nesta vista.</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-white/45">
            Ajuste os filtros ou crie uma nova tarefa acima.
          </p>
        </div>
      ) : (
        <div className="dashboard-reveal-columns grid min-w-0 grid-cols-1 items-start gap-4 pb-3 sm:grid-cols-2 lg:flex lg:items-start lg:gap-0">
          {taskSectionOrder.map((section, index) => {
            const tasksByBucket = groupedTasks[section];
            const isSectionExpanded = expandedTaskSections[section] ?? false;
            const hiddenTaskCount = Math.max(
              tasksByBucket.length - maxVisibleTasksPerColumn,
              0,
            );
            const visibleTasksByBucket = isSectionExpanded
              ? tasksByBucket
              : tasksByBucket.slice(0, maxVisibleTasksPerColumn);

            return (
              <Fragment key={section}>
                <section
                  ref={(element) => {
                    columnRefs.current[section] = element;
                  }}
                  style={
                    canResizeColumns && taskColumnWidths
                      ? {
                          flexBasis: 0,
                          flexGrow: taskColumnWidths[section],
                        }
                      : undefined
                  }
                  className="dashboard-reveal-column app-column-live flex min-w-0 flex-col rounded-3xl border border-slate-900/10 bg-white/55 p-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/[0.04] lg:min-w-[13rem] lg:max-w-[44rem] lg:flex-1"
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
                    {visibleTasksByBucket.map((task) => {
                      const isCompleted = task.status === "completed";
                      const isBusy = busyTaskId === task.id;
                      const isEditing =
                        editingTaskId === task.id &&
                        editingState &&
                        detailsTaskId !== task.id;

                      const completedSubtasks = task.subtasks.filter(
                        (item) => item.is_completed,
                      ).length;
                      const hasSubtasks = task.subtasks.length > 0;
                      const subtaskPercent = hasSubtasks
                        ? Math.round(
                            (completedSubtasks / task.subtasks.length) * 100,
                          )
                        : 0;
                      return (
                        <li
                          key={task.id}
                          data-tilt-card
                          draggable={!isEditing}
                          onDragStart={(event) =>
                            handleDragStart(event, task.id)
                          }
                          onDragEnd={handleDragEnd}
                          onClick={(event) => {
                            const target = event.target;
                            if (
                              target instanceof Element &&
                              target.closest(
                                "[data-task-action='true'], button, input, textarea, [role=combobox]",
                              )
                            ) {
                              return;
                            }
                            setDetailsTaskId(task.id);
                          }}
                          onContextMenu={(event) =>
                            openTaskContextMenu(event, task)
                          }
                          onDragOver={(event) => handleDragOver(event, task.id)}
                          onDrop={(event) => handleDropOnTask(event, task.id)}
                          className={[
                            "app-list-item-enter dashboard-reveal-card group/task-card relative flex min-w-0 cursor-grab select-none flex-col border bg-white/85 shadow-sm shadow-slate-950/5 transition duration-200 active:cursor-grabbing sm:hover:-translate-y-0.5 sm:hover:shadow-md dark:bg-zinc-950/70 dark:shadow-black/20",
                            draggingTaskId === task.id
                              ? "task-card-dragging z-20 opacity-70"
                              : "",
                            dragOverTaskId === task.id &&
                            draggingTaskId !== task.id
                              ? "task-card-drop-target z-10 ring-2 ring-teal-400/70"
                              : "",
                            dropCelebration?.taskId === task.id
                              ? "task-card-drop-celebration z-20"
                              : "",
                            newlyCreatedTaskId === task.id
                              ? "task-card-created z-20"
                              : "",
                            deletingTaskId === task.id
                              ? "task-card-deleting z-30 pointer-events-none"
                              : "",
                            isEditing
                              ? "h-auto overflow-visible"
                              : isCompleted
                                ? "h-auto min-h-0 overflow-visible"
                                : "min-h-32 overflow-visible",
                            isCompact
                              ? "rounded-2xl p-2.5"
                              : "rounded-2xl p-3 sm:rounded-3xl sm:p-4",
                            taskCardBorderStyles[task.status],
                          ].join(" ")}
                        >
                          {!isEditing ? (
                            <div
                              data-task-action="true"
                              draggable={false}
                              onPointerDown={(event) => {
                                event.stopPropagation();
                              }}
                              onMouseDown={(event) => {
                                event.stopPropagation();
                              }}
                              onDragStart={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                              }}
                              onClick={(event) => event.stopPropagation()}
      className="pointer-events-auto absolute right-3 top-3 z-30 flex translate-y-1 gap-0.5 cursor-pointer rounded-2xl border border-slate-900/15 bg-white/95 p-1 opacity-0 shadow-xl shadow-slate-950/20 backdrop-blur-xl transition-all duration-200 group-hover/task-card:translate-y-0 group-hover/task-card:opacity-100 group-focus-within/task-card:translate-y-0 group-focus-within/task-card:opacity-100 max-md:translate-y-0 max-md:opacity-100 dark:border-white/15 dark:bg-zinc-950/95 dark:shadow-black/45"
                            >
                              <TaskHistoryAction
                                task={task}
                                onClick={() => setHistoryTaskId(task.id)}
                              />
                              <TaskCardAction label="Mover para cima" disabled={isBusy || groupedTasks[task.status][0]?.id === task.id} onClick={() => { const items = groupedTasks[task.status]; const index = items.findIndex((item) => item.id === task.id); if (index > 0) moveTaskNearTask(task.id, items[index - 1].id, false); }}><ArrowUp className="size-3.5" /></TaskCardAction>
                              <TaskCardAction label="Mover para baixo" disabled={isBusy || groupedTasks[task.status].at(-1)?.id === task.id} onClick={() => { const items = groupedTasks[task.status]; const index = items.findIndex((item) => item.id === task.id); if (index >= 0 && index < items.length - 1) moveTaskNearTask(task.id, items[index + 1].id, true); }}><ArrowDown className="size-3.5" /></TaskCardAction>
                              <TaskCardAction
                                label="Editar tarefa"
                                onClick={() => startEdit(task)}
                                disabled={isBusy}
                              >
                                <Pencil className="size-3.5" />
                              </TaskCardAction>
                              <TaskCardAction
                                label="Excluir tarefa"
                                onClick={() =>
                                  setConfirmDeleteTask({
                                    id: task.id,
                                    title: task.title,
                                  })
                                }
                                destructive
                                disabled={isBusy}
                              >
                                <Trash2 className="size-3.5" />
                              </TaskCardAction>
                            </div>
                          ) : null}
                          {isCompleted ? (
                            <div className="flex min-w-0 flex-col items-start gap-2">
                              <button
                                type="button"
                                onClick={() => setDetailsTaskId(task.id)}
                                className="line-clamp-2 w-full text-left text-sm font-semibold leading-snug text-slate-500 dark:text-white/55"
                                aria-label={`Abrir tarefa finalizada: ${task.title}`}
                              >
                                {task.title}
                              </button>
                              <TaskTypeBadge taskType={task.type} />
                              <TaskCreationDate task={task} />
                            </div>
                          ) : (
                          <div className="flex min-w-0 flex-1 flex-col gap-3">
                            <div className="flex min-w-0 items-start">
                            <div
                              className={[
                                "min-w-0 flex-1",
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
                                    dateDetails,
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
                                      type: editingState.type,
                                      category:
                                        editingState.category.trim() || null,
                                      date_details: dateDetails,
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
                                        onClick={() => setDetailsTaskId(task.id)}
                                        aria-haspopup="dialog"
                                        className={[
                                          "line-clamp-2 w-full cursor-pointer text-left",
                                          isCompact
                                            ? "break-words text-base font-semibold leading-snug"
                                            : "break-words text-lg font-semibold leading-snug",
                                          isCompleted
                                            ? "text-slate-400 line-through dark:text-white/35"
                                            : "",
                                        ].join(" ")}
                                      >
                                        {task.title}
                                      </button>
                                      {task.description ? (
                                        <TaskDescription className="mt-1 line-clamp-2 break-words text-xs leading-relaxed text-slate-500 dark:text-white/45">
                                          {task.description}
                                        </TaskDescription>
                                      ) : null}
                                    </div>
                                  </div>

                                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                                    <Badge
                                      className={getPriorityClass(
                                        task.priority,
                                      )}
                                    >
                                      {getPriorityLabel(task.priority)}
                                    </Badge>
                                    <TaskTypeBadge taskType={task.type} />
                                    {task.category ? (
                                      <Badge
                                        variant="outline"
                                        className="max-w-full truncate"
                                        title={task.category}
                                      >
                                        {getTaskCategoryLabel(task.category)}
                                      </Badge>
                                    ) : null}
                                    {task.attachments.length ? (
                                      <TaskAttachmentBadge attachments={task.attachments} />
                                    ) : null}
                                    <TaskCreationDate task={task} />
                                  </div>
                                </>
                              )}

                              {hasSubtasks ? (
                                <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-white/45">
                                  <span>
                                    Subtarefas {completedSubtasks}/
                                    {task.subtasks.length}
                                  </span>
                                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-900/10 dark:bg-white/10">
                                    <div
                                      className="h-full rounded-full bg-teal-500 transition-[width] duration-700 ease-out"
                                      style={{ width: `${subtaskPercent}%` }}
                                    />
                                  </div>
                                  <span className="min-w-0 max-w-full truncate">
                                    {task.subtasks.find(
                                      (subtask) => !subtask.is_completed,
                                    )?.title ?? "Todas concluídas"}
                                  </span>
                                </div>
                              ) : null}

                            </div>
                            </div>

                          </div>
                          )}
                        </li>
                      );
                    })}
                    {hiddenTaskCount > 0 ? (
                      <li className="pt-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-10 w-full rounded-2xl text-xs"
                          aria-expanded={isSectionExpanded}
                          onClick={() =>
                            setExpandedTaskSections((current) => ({
                              ...current,
                              [section]: !(current[section] ?? false),
                            }))
                          }
                          onDragOver={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                          }}
                        >
                          {isSectionExpanded
                            ? "Mostrar apenas 10"
                            : `Ver mais ${hiddenTaskCount} ${hiddenTaskCount === 1 ? "tarefa" : "tarefas"}`}
                        </Button>
                      </li>
                    ) : null}
                  </ul>
                </section>
                {index < taskSectionOrder.length - 1 ? (
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={`Redimensionar colunas ${getStatusLabel(section)} e ${getStatusLabel(taskSectionOrder[index + 1])}`}
                    title="Arraste para redimensionar as colunas"
                    className={`group relative hidden w-4 shrink-0 touch-none cursor-col-resize items-center justify-center lg:flex ${resizingDividerIndex === index ? "bg-teal-500/10" : ""}`}
                    onPointerDown={(event) => startColumnResize(event, index)}
                    onPointerMove={resizeColumns}
                    onPointerUp={stopColumnResize}
                    onPointerCancel={stopColumnResize}
                  >
                    <span
                      className={`h-14 w-1 rounded-full transition-colors ${resizingDividerIndex === index ? "bg-teal-400" : "bg-slate-900/15 group-hover:bg-teal-400/70 dark:bg-white/15"}`}
                    />
                  </div>
                ) : null}
              </Fragment>
            );
          })}
        </div>
      )}

      {dropCelebration ? (
        <TaskDropCelebration
          key={dropCelebration.id}
          x={dropCelebration.point.x}
          y={dropCelebration.point.y}
          variant={dropCelebration.variant}
        />
      ) : null}

      {taskContextMenu && contextMenuTask ? (
        <ContextMenu
          x={taskContextMenu.x}
          y={taskContextMenu.y}
          actions={taskContextMenuActions}
          onClose={() => setTaskContextMenu(null)}
        />
      ) : null}

      <TaskDetailsDialog
        key={detailsTask?.id ?? "closed"}
        task={detailsTask}
        busy={detailsTask ? busyTaskId === detailsTask.id : false}
        subtaskDraft={detailsTask ? subtaskDraftByTaskId[detailsTask.id] ?? "" : ""}
        isEditing={Boolean(
          detailsTask && editingTaskId === detailsTask.id && editingState,
        )}
        editingState={editingState}
        setEditingState={setEditingState}
        onClose={() => {
          cancelEdit();
          setDetailsTaskId(null);
        }}
        onEdit={() => {
          if (!detailsTask) return;
          startEdit(detailsTask);
        }}
        onOpenHistory={() => {
          if (!detailsTask) return;
          setHistoryTaskId(detailsTask.id);
        }}
        onOpenDescriptionHistory={() => {
          if (!detailsTask) return;
          setDescriptionHistoryTaskId(detailsTask.id);
        }}
        onCancelEdit={cancelEdit}
        onSaveEdit={async ({ attachments, attachmentIdsToDelete, dateDetails }) => {
          if (!detailsTask || !editingState) return;
          const nextTitle = editingState.title.trim();

          if (!nextTitle) return;

          const taskWasUpdated = await onUpdateTask(detailsTask.id, {
            title: nextTitle,
            description: editingState.description.trim() || null,
            priority: editingState.priority,
            type: editingState.type,
            category: editingState.category.trim() || null,
            date_details: dateDetails,
          });
          if (!taskWasUpdated) return;

          for (const attachmentId of attachmentIdsToDelete) {
            await onDeleteAttachment(detailsTask.id, attachmentId);
          }
          for (const attachment of attachments) {
            await onAddAttachment(detailsTask.id, attachment);
          }
          cancelEdit();
        }}
        onEditDirtyChange={onEditDirtyChange}
        onRequestDelete={() => {
          if (!detailsTask) return;
          setConfirmDeleteTask({
            id: detailsTask.id,
            title: detailsTask.title,
          });
        }}
        onToggleSubtask={onToggleSubtask}
        onRenameSubtask={onRenameSubtask}
        onDeleteSubtask={(subtask) => setConfirmDeleteSubtask(subtask)}
        onReorderSubtasks={onReorderSubtasks}
        onAddTaskComment={onAddTaskComment}
        onDeleteTaskComment={onDeleteTaskComment}
        onSubmitSubtask={(event) => {
          if (detailsTask) void submitSubtask(event, detailsTask.id);
        }}
        onSubtaskDraftChange={(value) => {
          if (!detailsTask) return;
          setSubtaskDraftByTaskId((current) => ({
            ...current,
            [detailsTask.id]: value,
          }));
        }}
        onOpenAttachment={(index) => {
          if (!detailsTask) return;
          const attachment = sortAttachments(detailsTask.attachments)[index];
          if (attachment) void fetch(`/api/tasks/${detailsTask.id}/attachments/${attachment.id}`, { method: "POST" });
          setAttachmentViewer({
            task: {
              ...detailsTask,
              attachments: sortAttachments(detailsTask.attachments),
            },
            index,
          });
        }}
      />

      <TaskHistoryDialog
        task={historyTask}
        onClose={() => setHistoryTaskId(null)}
      />

      <TaskDescriptionHistoryDialog
        task={descriptionHistoryTask}
        busy={
          descriptionHistoryTask
            ? busyTaskId === descriptionHistoryTask.id
            : false
        }
        onClose={() => setDescriptionHistoryTaskId(null)}
        onRestore={onRestoreTaskDescription}
      />

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
          const taskId = confirmDeleteTask.id;
          setConfirmDeleteTask(null);
          setDeletingTaskId(taskId);
          setDeletingConfirm(true);
          try {
            await new Promise((resolve) => window.setTimeout(resolve, 720));
            const deleted = await onDeleteTask(taskId);
            if (!deleted) setDeletingTaskId(null);
          } finally {
            setDeletingConfirm(false);
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

function TaskDetailsDialog({
  task,
  busy,
  subtaskDraft,
  isEditing,
  editingState,
  setEditingState,
  onClose,
  onEdit,
  onOpenHistory,
  onOpenDescriptionHistory,
  onCancelEdit,
  onSaveEdit,
  onEditDirtyChange,
  onRequestDelete,
  onToggleSubtask,
  onRenameSubtask,
  onDeleteSubtask,
  onReorderSubtasks,
  onAddTaskComment,
  onDeleteTaskComment,
  onSubmitSubtask,
  onSubtaskDraftChange,
  onOpenAttachment,
}: {
  task: Task | null;
  busy: boolean;
  subtaskDraft: string;
  isEditing: boolean;
  editingState: EditingState | null;
  setEditingState: Dispatch<SetStateAction<EditingState | null>>;
  onClose: () => void;
  onEdit: () => void;
  onOpenHistory: () => void;
  onOpenDescriptionHistory: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (changes: {
    attachments: File[];
    attachmentIdsToDelete: string[];
    dateDetails?: Partial<Omit<DateDetails, "task_id">>;
  }) => Promise<void>;
  onEditDirtyChange?: (isDirty: boolean) => void;
  onRequestDelete: () => void;
  onToggleSubtask: (subtaskId: string, isCompleted: boolean) => Promise<void>;
  onRenameSubtask: (subtaskId: string, title: string) => Promise<void>;
  onDeleteSubtask: (subtask: { id: string; title: string }) => void;
  onReorderSubtasks: (taskId: string, subtaskIds: string[]) => Promise<boolean>;
  onAddTaskComment: (taskId: string, content: string) => Promise<void>;
  onDeleteTaskComment: (taskId: string, commentId: string) => Promise<void>;
  onSubmitSubtask: (event: FormEvent<HTMLFormElement>) => void;
  onSubtaskDraftChange: (value: string) => void;
  onOpenAttachment: (index: number) => void;
}) {
  const [draggingSubtaskId, setDraggingSubtaskId] = useState<string | null>(null);
  const [dragOverSubtaskId, setDragOverSubtaskId] = useState<string | null>(null);
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editingSubtaskTitle, setEditingSubtaskTitle] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const completedSubtasks =
    task?.subtasks.filter((subtask) => subtask.is_completed).length ?? 0;
  const subtaskCount = task?.subtasks.length ?? 0;
  const subtaskPercent = subtaskCount
    ? Math.round((completedSubtasks / subtaskCount) * 100)
    : 0;
  const descriptionLength = task?.description?.length ?? 0;
  const contentWeight =
    descriptionLength +
    (task?.attachments.length ?? 0) * 280 +
    (task?.subtasks.length ?? 0) * 120;
  const dialogSizeClass =
    contentWeight > 1800
      ? "max-h-[min(92svh,64rem)] sm:w-[78rem] sm:max-w-[calc(100vw-3rem)]"
      : contentWeight > 550
        ? "max-h-[min(90svh,56rem)] sm:w-[60rem] sm:max-w-[calc(100vw-3rem)]"
        : "max-h-[min(86svh,44rem)] sm:w-[42rem] sm:max-w-[calc(100vw-3rem)]";

  return (
    <Dialog
      open={Boolean(task)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className={`grid h-auto w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-x-hidden overflow-y-auto rounded-2xl bg-white p-0 dark:bg-zinc-950 sm:overflow-hidden sm:rounded-3xl ${dialogSizeClass}`}
      >
        {task ? (
          <>
            <div className="border-b border-slate-900/10 px-5 py-4 pr-12 dark:border-white/10 sm:px-6 sm:py-5">
              <div className="flex min-w-0 items-start gap-3">
                <div className="min-w-0 flex-1">
                  <DialogTitle className="break-words text-xl leading-tight sm:text-2xl">
                    {task.title}
                  </DialogTitle>
                  <DialogDescription className="mt-1">
                    Detalhes completos da tarefa
                  </DialogDescription>
                </div>
                {!isEditing ? (
                  <div className="mr-8 flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      className="rounded-xl text-slate-500 hover:text-teal-600 dark:text-white/55 dark:hover:text-teal-300"
                      aria-label="Ver histórico"
                      title="Ver histórico"
                      onClick={onOpenHistory}
                    >
                      <History className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      className="rounded-xl text-slate-500 hover:text-teal-600 dark:text-white/55 dark:hover:text-teal-300"
                      aria-label="Editar tarefa"
                      title="Editar tarefa"
                      onClick={onEdit}
                      disabled={busy}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      className="rounded-xl text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300"
                      aria-label="Excluir tarefa"
                      title="Excluir tarefa"
                      onClick={onRequestDelete}
                      disabled={busy}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Badge className={taskSectionStyles[task.status]}>
                  {getStatusLabel(task.status)}
                </Badge>
                <TaskTypeBadge taskType={task.type} />
                <Badge className={getPriorityClass(task.priority)}>
                  {getPriorityLabel(task.priority)}
                </Badge>
                {task.category ? (
                  <Badge variant="outline" className="max-w-full truncate">
                    {getTaskCategoryLabel(task.category)}
                  </Badge>
                ) : null}
              </div>
            </div>

            <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-8 sm:py-7 lg:px-10">
              {isEditing && editingState ? (
                <TaskEditForm
                  task={task}
                  editingState={editingState}
                  setEditingState={setEditingState}
                  isSaving={busy}
                  onCancel={onCancelEdit}
                  onDirtyChange={onEditDirtyChange}
                  onSave={onSaveEdit}
                />
              ) : (
              <div className="space-y-8">
                <section>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-white/45">
                      Descrição
                    </h3>
                    {task.description_history.length ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="rounded-full text-xs text-teal-700 hover:text-teal-800 dark:text-teal-300 dark:hover:text-teal-200"
                        onClick={onOpenDescriptionHistory}
                      >
                        <History className="size-3.5" />
                        Histórico
                      </Button>
                    ) : null}
                  </div>
                  {task.description ? (
                    <TaskDescription className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700 dark:text-white/80">
                      {task.description}
                    </TaskDescription>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500 dark:text-white/45">
                      Sem descrição.
                    </p>
                  )}
                </section>

                {task.type === "date" && task.date_details ? (
                  <section className="rounded-2xl border border-pink-500/20 bg-pink-500/[0.04] p-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-pink-700 dark:text-pink-200">Dados do Date</h3>
                    <div className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                      {task.date_details.work ? <p><span className="text-slate-500 dark:text-white/45">Trabalho: </span>{task.date_details.work}</p> : null}
                      {[["Idade", task.date_details.age], ["Signo", task.date_details.sign], ["Endereço", task.date_details.address], ["Altura", task.date_details.height], ["Tem filho", task.date_details.has_children === null ? null : task.date_details.has_children ? "Sim" : "Não"], ["Local", task.date_details.location], ["Data", task.date_details.date_at], ["Personalidade", task.date_details.personality_rating], ["Rosto", task.date_details.face_rating], ["Corpo", task.date_details.body_rating], ["Sexo", task.date_details.sex_rating]].filter(([, value]) => value !== null && value !== "").map(([label, value]) => <p key={String(label)}><span className="text-slate-500 dark:text-white/45">{label}: </span>{String(value)}</p>)}
                    </div>
                  </section>
                ) : null}

                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-white/45">Comentários</h3>
                  <div className="mt-2 space-y-2">
                    {task.comments.map((comment) => (
                      <div key={comment.id} className="flex gap-2 rounded-xl bg-slate-950/[0.035] p-2 text-sm dark:bg-white/[0.045]">
                        <p className="min-w-0 flex-1 whitespace-pre-wrap">{comment.content}</p>
                        <Button type="button" size="icon-sm" variant="ghost" className="size-7 text-rose-500" onClick={() => void onDeleteTaskComment(task.id, comment.id)} aria-label="Excluir comentário"><Trash2 className="size-3.5" /></Button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-2"><Input value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} placeholder="Adicionar observação" maxLength={2000} /><Button type="button" disabled={!commentDraft.trim()} onClick={() => void onAddTaskComment(task.id, commentDraft).then(() => setCommentDraft(""))}>Comentar</Button></div>
                </section>

                <section>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-white/45">
                        Anexos
                      </h3>
                      <p className="mt-1 text-sm text-slate-500 dark:text-white/45">
                        {task.attachments.length
                          ? `${task.attachments.length} arquivo(s)`
                          : "Nenhum arquivo anexado"}
                      </p>
                    </div>
                  </div>
                  {task.attachments.length ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {sortAttachments(task.attachments).map(
                        (attachment, index) => (
                          <button
                            key={attachment.id}
                            type="button"
                            className="group/image flex min-w-0 items-center gap-3 rounded-xl border border-slate-900/10 p-2 text-left transition hover:bg-slate-900/[0.03] dark:border-white/10 dark:hover:bg-white/[0.05]"
                            title={`Abrir ${attachment.file_name}`}
                            onClick={() => onOpenAttachment(index)}
                          >
                            <AttachmentPreview
                              attachment={attachment}
                              taskId={task.id}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium" title={attachment.file_name}>
                                {attachment.file_name}
                              </span>
                              <span className="mt-0.5 block text-xs text-slate-500 dark:text-white/45">
                                {getAttachmentKind(attachment) === "pdf" ? "PDF" : attachment.mime_type || "Arquivo"} · {formatFileSize(attachment.file_size)} · .{attachment.file_name.split(".").pop()?.toUpperCase() || "ARQ"} · adicionado {formatCompactDate(attachment.created_at)}{attachment.last_viewed_at ? ` · visto ${formatCompactDate(attachment.last_viewed_at)}` : " · não visualizado"}
                              </span>
                            </span>
                          </button>
                        ),
                      )}
                    </div>
                  ) : null}
                </section>

                <section>
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-white/45">
                          Subtarefas {completedSubtasks}/{subtaskCount}
                        </h3>
                        <span className="text-xs text-slate-500 dark:text-white/45">
                          {subtaskPercent}%
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-900/10 dark:bg-white/10">
                        <div
                          className="h-full rounded-full bg-teal-500 transition-[width] duration-700 ease-out"
                          style={{ width: `${subtaskPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {task.subtasks.length ? (
                    <ul className="mt-3 space-y-2">
                      {task.subtasks.map((subtask) => (
                        <li
                          key={subtask.id}
                          draggable={!busy}
                          onDragStart={(event) => {
                            const target = event.target as HTMLElement;
                            if (target.closest("button,input")) {
                              event.preventDefault();
                              return;
                            }

                            event.dataTransfer.effectAllowed = "move";
                            event.dataTransfer.setData("text/plain", subtask.id);
                            setDraggingSubtaskId(subtask.id);
                          }}
                          onDragOver={(event) => {
                            event.preventDefault();
                            if (draggingSubtaskId && draggingSubtaskId !== subtask.id) {
                              event.dataTransfer.dropEffect = "move";
                              setDragOverSubtaskId(subtask.id);
                            }
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            const sourceId =
                              event.dataTransfer.getData("text/plain") || draggingSubtaskId;
                            if (!sourceId || sourceId === subtask.id || !task) {
                              setDraggingSubtaskId(null);
                              setDragOverSubtaskId(null);
                              return;
                            }

                            const orderedIds = task.subtasks.map((item) => item.id);
                            const sourceIndex = orderedIds.indexOf(sourceId);
                            const targetIndex = orderedIds.indexOf(subtask.id);
                            if (sourceIndex < 0 || targetIndex < 0) {
                              setDraggingSubtaskId(null);
                              setDragOverSubtaskId(null);
                              return;
                            }

                            orderedIds.splice(sourceIndex, 1);
                            orderedIds.splice(orderedIds.indexOf(subtask.id), 0, sourceId);
                            setDraggingSubtaskId(null);
                            setDragOverSubtaskId(null);
                            void onReorderSubtasks(task.id, orderedIds);
                          }}
                          onDragEnd={() => {
                            setDraggingSubtaskId(null);
                            setDragOverSubtaskId(null);
                          }}
                          className={[
                            "app-subtask-enter flex min-w-0 items-center justify-between gap-2 rounded-xl bg-slate-950/[0.035] px-2 py-1.5 transition dark:bg-white/[0.045]",
                            draggingSubtaskId === subtask.id ? "opacity-45" : "",
                            dragOverSubtaskId === subtask.id
                              ? "ring-2 ring-teal-400/70 ring-offset-1 ring-offset-white dark:ring-offset-zinc-950"
                              : "",
                          ].join(" ")}
                        >
                          <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2">
                            <GripVertical
                              className="size-4 shrink-0 cursor-grab text-slate-400/70 active:cursor-grabbing dark:text-white/35"
                              aria-hidden="true"
                            />
                            <Checkbox
                              checked={subtask.is_completed}
                              onCheckedChange={() =>
                                void onToggleSubtask(
                                  subtask.id,
                                  !subtask.is_completed,
                                )
                              }
                              className="size-5 after:-inset-3 md:size-4 md:after:-inset-x-3 md:after:-inset-y-2"
                            />
                            {editingSubtaskId === subtask.id ? (
                              <Input className="h-8 min-w-0 flex-1" value={editingSubtaskTitle} autoFocus onChange={(event) => setEditingSubtaskTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && editingSubtaskTitle.trim()) { void onRenameSubtask(subtask.id, editingSubtaskTitle.trim()).then(() => setEditingSubtaskId(null)); } if (event.key === "Escape") setEditingSubtaskId(null); }} />
                            ) : <span
                              title={
                                subtask.is_completed && subtask.completed_at
                                  ? `Finalizada em ${formatDateTime(subtask.completed_at)}`
                                  : undefined
                              }
                              className={[
                                "truncate text-sm",
                                subtask.is_completed
                                  ? "text-slate-400 line-through dark:text-white/35"
                                  : "",
                              ].join(" ")}
                            >
                              {subtask.title}
                            </span>}
                          </label>
                          <Button type="button" size="icon-sm" variant="ghost" className="size-9" onClick={() => { setEditingSubtaskId(subtask.id); setEditingSubtaskTitle(subtask.title); }} aria-label={`Editar ${subtask.title}`}>
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            className="size-11 touch-manipulation md:size-7"
                            onClick={() => onDeleteSubtask(subtask)}
                            aria-label="Excluir subtarefa"
                          >
                            <Trash2 className="size-4 text-rose-500" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 flex items-center gap-2 text-sm text-slate-500 dark:text-white/40">
                      <Circle className="size-3" />
                      Sem subtarefas ainda.
                    </p>
                  )}

                  <form
                    onSubmit={onSubmitSubtask}
                    aria-busy={busy}
                    className={[
                      "mt-3 flex min-w-0 flex-col gap-2 rounded-xl sm:flex-row",
                      busy ? "subtask-form-loading" : "",
                    ].join(" ")}
                  >
                    <Input
                      className="h-11 min-w-0 rounded-xl border-slate-900/10 bg-white text-base shadow-none sm:h-9 sm:text-sm dark:border-white/10 dark:bg-black/20"
                      value={subtaskDraft}
                      disabled={busy}
                      onChange={(event) =>
                        onSubtaskDraftChange(event.target.value)
                      }
                      placeholder="Nova subtarefa"
                      maxLength={160}
                    />
                    <Button
                      type="submit"
                      variant="outline"
                      className="h-11 w-full touch-manipulation rounded-xl px-4 sm:h-9 sm:w-auto"
                      disabled={busy || !subtaskDraft.trim()}
                    >
                      {busy ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <CirclePlus className="size-4" />
                      )}
                      {busy ? "Adicionando…" : "Adicionar"}
                    </Button>
                  </form>
                </section>
              </div>
              )}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function TaskHistoryDialog({
  task,
  onClose,
}: {
  task: Task | null;
  onClose: () => void;
}) {
  const history = task ? getTaskHistory(task) : [];

  return (
    <Dialog
      open={Boolean(task)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="grid h-auto max-h-[min(86svh,44rem)] w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-2xl bg-white p-0 dark:bg-zinc-950 sm:w-[38rem] sm:max-w-[calc(100vw-3rem)] sm:rounded-3xl">
        {task ? (
          <>
            <div className="border-b border-slate-900/10 px-5 py-4 pr-12 dark:border-white/10 sm:px-6 sm:py-5">
              <div className="flex items-start gap-3">
                <History className="mt-1 size-5 shrink-0 text-teal-500" />
                <div className="min-w-0">
                  <DialogTitle className="break-words text-xl leading-tight sm:text-2xl">
                    Histórico da tarefa
                  </DialogTitle>
                  <DialogDescription className="mt-1 break-words">
                    {task.title}
                  </DialogDescription>
                </div>
              </div>
            </div>

            <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-white/45">
                  {history.length} {history.length === 1 ? "registro" : "registros"}
                </p>
                <p className="text-xs text-slate-500 dark:text-white/45">
                  Status atual: {getStatusLabel(task.status)}
                </p>
              </div>
              <TaskHistoryTimeline task={task} />
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function TaskDescriptionHistoryDialog({
  task,
  busy,
  onClose,
  onRestore,
}: {
  task: Task | null;
  busy: boolean;
  onClose: () => void;
  onRestore: (taskId: string, historyId: string) => Promise<boolean>;
}) {
  const [pendingRevision, setPendingRevision] =
    useState<TaskDescriptionHistory | null>(null);

  return (
    <Dialog
      open={Boolean(task)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="grid h-auto max-h-[min(86svh,52rem)] w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-2xl bg-white p-0 dark:bg-zinc-950 sm:w-[46rem] sm:max-w-[calc(100vw-3rem)] sm:rounded-3xl">
        {task ? (
          <>
            <div className="border-b border-slate-900/10 px-5 py-4 pr-12 dark:border-white/10 sm:px-6 sm:py-5">
              <div className="flex items-start gap-3">
                <History className="mt-1 size-5 shrink-0 text-teal-500" />
                <div className="min-w-0">
                  <DialogTitle className="break-words text-xl leading-tight sm:text-2xl">
                    Histórico da descrição
                  </DialogTitle>
                  <DialogDescription className="mt-1 break-words">
                    {task.title}
                  </DialogDescription>
                </div>
              </div>
            </div>

            <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
              <section className="rounded-2xl border border-teal-500/30 bg-teal-500/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">
                  Versão atual
                </p>
                <TaskDescription className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700 dark:text-white/80">
                  {task.description ?? "Sem descrição."}
                </TaskDescription>
              </section>

              {task.description_history.map((revision) => (
                <section
                  key={revision.id}
                  className="rounded-2xl border border-slate-900/10 p-4 dark:border-white/10"
                >
                  <div className="flex items-center justify-between gap-3">
                    <time
                      dateTime={revision.changed_at}
                      className="text-xs font-medium text-slate-500 dark:text-white/45"
                    >
                      {formatDateTime(revision.changed_at)}
                    </time>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                      disabled={busy}
                      onClick={() => setPendingRevision(revision)}
                    >
                      Restaurar
                    </Button>
                  </div>
                  <TaskDescription className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700 dark:text-white/80">
                    {revision.description ?? "Sem descrição."}
                  </TaskDescription>
                </section>
              ))}
            </div>
          </>
        ) : null}
      </DialogContent>

      <ConfirmDialog
        open={Boolean(pendingRevision)}
        onOpenChange={(open) => {
          if (!open) setPendingRevision(null);
        }}
        title="Restaurar esta descrição?"
        description="A descrição atual será preservada como uma nova versão no histórico."
        confirmLabel="Restaurar"
        loading={busy}
        onConfirm={async () => {
          if (!task || !pendingRevision) return;
          const restored = await onRestore(task.id, pendingRevision.id);
          if (restored) setPendingRevision(null);
        }}
      />
    </Dialog>
  );
}

function getAttachmentUrl(taskId: string, attachmentId: string) {
  return `/api/tasks/${taskId}/attachments/${attachmentId}`;
}

function formatFileSize(size: number | null) {
  if (!size) return "tamanho indisponível";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getAttachmentKind(attachment: TaskAttachment) {
  const mimeType = attachment.mime_type.toLocaleLowerCase();
  const extension = attachment.file_name.split(".").pop()?.toLocaleLowerCase();

  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf" || extension === "pdf") return "pdf";
  if (mimeType.startsWith("audio/")) return "audio";
  if (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    ["txt", "md", "csv", "json", "log", "xml", "html", "css", "js", "ts"].includes(extension ?? "")
  ) {
    return "text";
  }
  return "file";
}

function isImageAttachment(mimeType: string) {
  return mimeType.startsWith("image/");
}

function AttachmentIcon({ attachment, className = "size-5" }: { attachment: TaskAttachment; className?: string }) {
  const kind = getAttachmentKind(attachment);
  const Icon =
    kind === "image"
      ? ImageIcon
      : kind === "audio"
        ? FileAudio
        : kind === "text"
          ? FileCode2
          : kind === "pdf"
            ? FileText
            : File;
  return <Icon className={className} />;
}

function TaskAttachmentBadge({ attachments }: { attachments: TaskAttachment[] }) {
  const kinds = new Set(attachments.map(getAttachmentKind));
  const firstAttachment = attachments[0];
  const icon = kinds.size === 1 && firstAttachment
    ? <AttachmentIcon attachment={firstAttachment} className="size-3" />
    : <Paperclip className="size-3" />;

  return (
    <Badge variant="outline" className="gap-1" title={`${attachments.length} arquivo(s) anexado(s)`}>
      {icon}
      {attachments.length}
    </Badge>
  );
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
            {getAttachmentKind(attachment) === "image" ? (
              <>
                {/* This authenticated API route cannot use Next's remote image optimizer. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getAttachmentUrl(viewer.task.id, attachment.id)}
                  alt={attachment.file_name}
                  className="max-h-[calc(90vh-7rem)] w-auto max-w-full rounded-lg object-contain"
                />
              </>
            ) : getAttachmentKind(attachment) === "audio" ? (
              <div className="flex w-full max-w-xl flex-col items-center gap-5 rounded-xl bg-white/5 p-8 text-center">
                <AttachmentIcon attachment={attachment} className="size-12 text-slate-300" />
                <audio controls className="w-full" src={getAttachmentUrl(viewer.task.id, attachment.id)}>
                  Seu navegador não suporta a reprodução deste áudio.
                </audio>
              </div>
            ) : getAttachmentKind(attachment) === "pdf" || getAttachmentKind(attachment) === "text" ? (
              <iframe
                src={getAttachmentUrl(viewer.task.id, attachment.id)}
                title={`Prévia de ${attachment.file_name}`}
                className="h-full min-h-80 w-full rounded-xl border-0 bg-white"
              />
            ) : (
              <div className="flex min-h-44 flex-col items-center justify-center gap-3 rounded-xl px-8 text-center">
                <AttachmentIcon attachment={attachment} className="size-12 text-slate-400" />
                <span className="max-w-64 break-words">
                  {attachment.file_name}
                </span>
                <span className="text-sm text-white/60">Prévia indisponível para este tipo de arquivo.</span>
              </div>
            )}
            {count > 1 ? (
              <>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="group/nav absolute left-4 top-1/2 size-11 -translate-y-1/2 rounded-2xl border border-white/15 bg-zinc-950/70 text-white shadow-xl shadow-black/35 backdrop-blur-xl hover:scale-105 hover:border-teal-300/50 hover:bg-teal-400/15 hover:text-teal-100 sm:size-12"
                  onClick={() =>
                    onChangeIndex((viewer.index - 1 + count) % count)
                  }
                  aria-label="Anexo anterior"
                >
                  <ArrowLeft className="size-5 transition-transform duration-200 group-hover/nav:-translate-x-0.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="group/nav absolute right-4 top-1/2 size-11 -translate-y-1/2 rounded-2xl border border-white/15 bg-zinc-950/70 text-white shadow-xl shadow-black/35 backdrop-blur-xl hover:scale-105 hover:border-teal-300/50 hover:bg-teal-400/15 hover:text-teal-100 sm:size-12"
                  onClick={() => onChangeIndex((viewer.index + 1) % count)}
                  aria-label="Próximo anexo"
                >
                  <ArrowRight className="size-5 transition-transform duration-200 group-hover/nav:translate-x-0.5" />
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
        <AttachmentIcon attachment={attachment} className="size-6" />
      </span>
    );
  }

  return (
    <>
      {/* This authenticated API route cannot use Next's remote image optimizer. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={getAttachmentUrl(taskId, attachment.id)}
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
    dateDetails?: Partial<Omit<DateDetails, "task_id">>;
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
  const [dateDetails, setDateDetails] = useState<Partial<Omit<DateDetails, "task_id">>>(task.date_details ?? {});
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  const hasDetailChanges =
    editingState.title !== task.title ||
    editingState.description !== (task.description ?? "") ||
    editingState.category !== (task.category ?? "") ||
    editingState.priority !== task.priority ||
    editingState.type !== task.type;
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

  const handleDescriptionChange = (
    event: ChangeEvent<HTMLTextAreaElement>,
  ) => {
    const expansion = expandSlashCodeCommand(
      event.target.value,
      event.target.selectionStart,
      event.target.selectionEnd,
    );

    if (!expansion) {
      setEditingState((current) =>
        current ? { ...current, description: event.target.value } : current,
      );
      return;
    }

    setEditingState((current) =>
      current ? { ...current, description: expansion.value } : current,
    );
    window.requestAnimationFrame(() => {
      descriptionRef.current?.focus();
      descriptionRef.current?.setSelectionRange(
        expansion.caretPosition,
        expansion.caretPosition,
      );
    });
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

      {editingState.type === "date" ? (
        <section className="rounded-2xl border border-pink-500/20 bg-pink-500/[0.04] p-3">
          <h3 className="text-sm font-semibold text-pink-700 dark:text-pink-200">Dados estruturados do Date</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-white/45">Preencha estes dados primeiro; use a descrição para observações adicionais.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Input
              type="text"
              placeholder="Trabalho"
              value={String(dateDetails.work ?? "")}
              onChange={(event) => setDateDetails((current) => ({ ...current, work: event.target.value || null }))}
            />
            {[["age", "Idade", "number"], ["sign", "Signo", "text"], ["address", "Endereço", "text"], ["height", "Altura", "text"], ["location", "Local", "text"], ["date_at", "Data do date", "date"]].map(([key, label, type]) => (
              <Input key={key} type={type} placeholder={label} value={String(dateDetails[key as keyof typeof dateDetails] ?? "")} onChange={(event) => setDateDetails((current) => ({ ...current, [key]: type === "number" ? (event.target.value ? Number(event.target.value) : null) : event.target.value || null }))} />
            ))}
            <Select
              value={dateDetails.has_children == null ? "not-informed" : String(dateDetails.has_children)}
              onValueChange={(value) => setDateDetails((current) => ({ ...current, has_children: value === "not-informed" ? null : value === "true" }))}
            >
              <SelectTrigger className="h-10 rounded-xl border-slate-900/10 bg-white px-3 text-sm shadow-none dark:border-white/10 dark:bg-black/20">
                <span className="flex h-full items-center">{dateDetails.has_children == null ? "Tem filho?" : dateDetails.has_children ? "Tem filho: Sim" : "Tem filho: Não"}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="not-informed">Tem filho? (não informado)</SelectItem>
                <SelectItem value="true">Sim</SelectItem>
                <SelectItem value="false">Não</SelectItem>
              </SelectContent>
            </Select>
            {[["personality_rating", "Nota personalidade"], ["face_rating", "Nota rosto"], ["body_rating", "Nota corpo"], ["sex_rating", "Nota sexo"]].map(([key, label]) => (
              <Select
                key={key}
                value={dateDetails[key as keyof typeof dateDetails] == null ? "unrated" : String(dateDetails[key as keyof typeof dateDetails])}
                onValueChange={(value) => setDateDetails((current) => ({ ...current, [key]: value === "unrated" ? null : Number(value) }))}
              >
                <SelectTrigger className="h-10 rounded-xl border-slate-900/10 bg-white px-3 text-sm shadow-none dark:border-white/10 dark:bg-black/20">
                  <span className="flex h-full items-center">{dateDetails[key as keyof typeof dateDetails] == null ? `${label} (1–10)` : `${label}: ${dateDetails[key as keyof typeof dateDetails]}`}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unrated">{label} (não informada)</SelectItem>
                  {Array.from({ length: 10 }, (_, index) => index + 1).map((rating) => (
                    <SelectItem key={rating} value={String(rating)}>{rating}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ))}
          </div>
        </section>
      ) : null}

      <Textarea
        ref={descriptionRef}
        className="min-h-20 rounded-2xl border-slate-900/10 bg-white shadow-none dark:border-white/10 dark:bg-black/20 disabled:opacity-60"
        value={editingState.description}
        disabled={isSaving}
        onChange={handleDescriptionChange}
        placeholder={editingState.type === "date" ? "Observações adicionais (opcional)" : "Descrição opcional"}
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
                <div key={item.id} className="relative w-28 min-w-0">
                  <AttachmentPreview attachment={item} taskId={task.id} />
                  <span
                    className="mt-1 block w-full truncate text-center text-[11px] text-slate-600 dark:text-white/65"
                    title={item.file_name}
                  >
                    {item.file_name}
                  </span>
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
                className="flex min-w-0 max-w-52 items-center rounded-full bg-teal-500/10 pl-2.5 text-xs text-teal-700 dark:text-teal-200"
              >
                <span
                  className="min-w-0 truncate"
                  title={attachment.name || "Arquivo"}
                >
                  {attachment.name || "Arquivo"}
                </span>
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

      <div className="grid min-w-0 gap-2 sm:grid-cols-3">
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

        <Select
          value={editingState.type}
          disabled={isSaving}
          onValueChange={(value) =>
            setEditingState((current) => {
              if (!current) return current;
              const type = (value ?? "task") as TaskType;
              return {
                ...current,
                type,
              };
            })
          }
        >
          <SelectTrigger className="h-11 w-full rounded-2xl border-slate-900/10 bg-white py-0 shadow-none sm:h-10 dark:border-white/10 dark:bg-black/20">
            <span className="flex h-full items-center text-sm">
              {getTaskTypeLabel(editingState.type)}
            </span>
          </SelectTrigger>
          <SelectContent>
            {getTaskTypeOptions(editingState.category).map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={editingState.category}
          disabled={isSaving}
          onValueChange={(value) =>
            setEditingState((current) => {
              if (!current) return current;
              const category = value ?? "trabalho";
              return {
                ...current,
                category,
                type: getDefaultTaskType(category),
              };
            })
          }
        >
          <SelectTrigger
            aria-label="Categoria da tarefa"
            className="h-11 w-full rounded-2xl border-slate-900/10 bg-white py-0 shadow-none sm:h-10 dark:border-white/10 dark:bg-black/20"
          >
            <span className="flex h-full items-center text-sm">
              {getTaskCategoryLabel(editingState.category)}
            </span>
          </SelectTrigger>
          <SelectContent>
            {TASK_CATEGORY_OPTIONS.map((category) => (
              <SelectItem key={category.value} value={category.value}>
                {category.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          className="h-11 flex-1 gap-1.5 touch-manipulation rounded-full px-4 sm:h-7 sm:flex-none sm:px-2.5"
          onClick={() =>
            onSave({ attachments: pendingAttachments, attachmentIdsToDelete, dateDetails: editingState.type === "date" ? dateDetails : undefined })
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
