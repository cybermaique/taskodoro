"use client";

import {
  type ClipboardEvent,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ClipboardPaste,
  CheckCircle2,
  Flag,
  Folder,
  Tags,
  ListChecks,
  Paperclip,
  Plus,
  X,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { expandSlashCodeCommand } from "@/lib/text-shortcuts";
import {
  getTaskTypeOptions,
  getDefaultTaskType,
  getTaskCategoryLabel,
  TASK_CATEGORY_OPTIONS,
  TASK_TYPE_OPTIONS,
  type TaskPriority,
  type TaskType,
  type DateDetails,
} from "@/types/task";

interface TaskFormValues {
  title: string;
  description: string;
  priority: TaskPriority;
  type: TaskType;
  category: string;
}

interface TaskFormProps {
  isSubmitting: boolean;
  isCompact?: boolean;
  onDirtyChange?: (isDirty: boolean) => void;
  onCreate: (values: {
    title: string;
    description?: string;
    priority?: TaskPriority;
    type?: TaskType;
    category?: string | null;
    attachments?: File[];
    subtasks?: string[];
    date_details?: Partial<Omit<DateDetails, "task_id">>;
  }) => Promise<void>;
}

const EMPTY_VALUES: TaskFormValues = {
  title: "",
  description: "",
  priority: "medium",
  type: "task",
  category: "trabalho",
};

const compactSelectClass =
  "h-12 min-h-12 w-full rounded-2xl border-slate-900/10 bg-white py-0 pl-10 pr-3 text-sm shadow-none dark:border-white/10 dark:bg-black/20";

function getPriorityLabel(priority: TaskPriority) {
  if (priority === "high") {
    return "Alta";
  }

  if (priority === "low") {
    return "Baixa";
  }

  return "Média";
}

function getTaskTypeLabel(type: TaskType) {
  return TASK_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? "Tarefa";
}

export function TaskForm({
  isSubmitting,
  isCompact = false,
  onDirtyChange,
  onCreate,
}: TaskFormProps) {
  const [values, setValues] = useState<TaskFormValues>(EMPTY_VALUES);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [subtaskDraft, setSubtaskDraft] = useState("");
  const [dateDetails, setDateDetails] = useState<Partial<Omit<DateDetails, "task_id">>>({});
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [justCreated, setJustCreated] = useState(false);
  const successTimeoutRef = useRef<number | null>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const availableTaskTypes = getTaskTypeOptions(values.category);

  const isDirty =
    values.title !== EMPTY_VALUES.title ||
    values.description !== EMPTY_VALUES.description ||
    values.priority !== EMPTY_VALUES.priority ||
    values.type !== EMPTY_VALUES.type ||
    values.category !== EMPTY_VALUES.category ||
    attachments.length > 0 ||
    subtasks.length > 0 ||
    subtaskDraft.trim().length > 0;

  useEffect(() => {
    onDirtyChange?.(isDirty);
    return () => onDirtyChange?.(false);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current !== null) {
        window.clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  const addAttachments = (files: File[]) => {
    setAttachments((current) => [...current, ...files]);
  };

  const handlePaste = (event: ClipboardEvent<HTMLFormElement>) => {
    const files = Array.from(event.clipboardData.files);
    if (!files.length) return;
    event.preventDefault();
    addAttachments(files);
  };

  const handleDrop = (event: DragEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsDraggingFiles(false);
    const files = Array.from(event.dataTransfer.files);
    if (files.length) addAttachments(files);
  };

  const addSubtask = () => {
    const title = subtaskDraft.trim();
    if (!title) return;

    if (subtasks.length >= 20) {
      setErrorMessage("Você pode adicionar até 20 subtarefas por tarefa.");
      return;
    }

    if (
      subtasks.some(
        (subtask) => subtask.toLocaleLowerCase() === title.toLocaleLowerCase(),
      )
    ) {
      setErrorMessage("Essa subtarefa já foi adicionada.");
      return;
    }

    setSubtasks((current) => [...current, title]);
    setSubtaskDraft("");
    setErrorMessage(null);
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
      setValues((current) => ({
        ...current,
        description: event.target.value,
      }));
      return;
    }

    setValues((current) => ({
      ...current,
      description: expansion.value,
    }));
    window.requestAnimationFrame(() => {
      descriptionRef.current?.focus();
      descriptionRef.current?.setSelectionRange(
        expansion.caretPosition,
        expansion.caretPosition,
      );
    });
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const title = values.title.trim();

    if (!title) {
      setErrorMessage("Digite o título da tarefa.");
      return;
    }

    setErrorMessage(null);

    try {
      const pendingSubtask = subtaskDraft.trim();
      const subtasksToCreate = pendingSubtask
        ? [...subtasks, pendingSubtask]
        : subtasks;

      await onCreate({
        title,
        description: values.description.trim() || undefined,
        priority: values.priority,
        type: values.type,
        category: values.category.trim() || null,
        attachments: attachments.length ? attachments : undefined,
        subtasks: subtasksToCreate.length ? subtasksToCreate : undefined,
        date_details: values.type === "date" ? dateDetails : undefined,
      });

      setValues(EMPTY_VALUES);
      setAttachments([]);
      setSubtasks([]);
      setSubtaskDraft("");
      setDateDetails({});
      setJustCreated(true);
      if (successTimeoutRef.current !== null) {
        window.clearTimeout(successTimeoutRef.current);
      }
      successTimeoutRef.current = window.setTimeout(() => {
        setJustCreated(false);
        successTimeoutRef.current = null;
      }, 1500);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível criar a tarefa.",
      );
    }
  };

  return (
    <section
      className={[
        "app-panel-enter app-compose-live dashboard-reveal-panel mt-6 min-w-0 rounded-2xl border border-slate-900/10 bg-white/80 p-3 shadow-sm shadow-slate-950/5 backdrop-blur sm:rounded-3xl sm:p-4 dark:border-white/10 dark:bg-white/[0.07] dark:shadow-black/20",
        justCreated ? "task-form-success" : "",
      ].join(" ")}
    >
      <form
        onSubmit={onSubmit}
        onPaste={handlePaste}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDraggingFiles(true);
        }}
        onDragLeave={(event) => {
          if (event.currentTarget === event.target) setIsDraggingFiles(false);
        }}
        onDrop={handleDrop}
        className={[
          "min-w-0 space-y-3 rounded-2xl transition sm:space-y-4",
          isDraggingFiles
            ? "bg-teal-500/5 ring-2 ring-teal-400/70 ring-inset"
            : "",
        ].join(" ")}
      >
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">Nova tarefa</h2>
            {!isCompact ? (
              <p className="text-sm text-slate-500 dark:text-white/45">
                Capture rápido, refine depois.
              </p>
            ) : null}
          </div>
          <Button
            type="submit"
            disabled={isSubmitting || justCreated}
            className="h-11 w-full touch-manipulation rounded-full px-4 sm:h-9 sm:w-auto"
          >
            {isSubmitting ? (
              <Loader2 className="size-4 animate-spin text-white" />
            ) : justCreated ? (
              <CheckCircle2 className="size-4" />
            ) : (
              <Plus className="size-4" />
            )}
            {isSubmitting ? "Salvando…" : justCreated ? "Criada!" : "Adicionar"}
          </Button>
        </div>

        <div className="flex min-h-10 flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-white/45">
          {attachments.length ? (
            <>
              {attachments.map((attachment, index) => (
                <span
                  key={`${attachment.name}-${attachment.lastModified}-${index}`}
                  className="app-chip-pop flex items-center rounded-full border border-teal-500/30 bg-teal-500/10 pl-3 text-teal-700 dark:text-teal-200"
                >
                  Arquivo: {attachment.name || "arquivo"}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 rounded-full px-2"
                    disabled={isSubmitting}
                    onClick={() =>
                      setAttachments((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                    aria-label={`Remover ${attachment.name || "arquivo"}`}
                  >
                    <X className="size-4" />
                  </Button>
                </span>
              ))}
              <label
                className={`task-attachment-trigger ${isSubmitting ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
              >
                <Paperclip className="size-3.5" /> Adicionar
                <input
                  type="file"
                  multiple
                  className="sr-only"
                  disabled={isSubmitting}
                  onChange={(event) =>
                    addAttachments(Array.from(event.target.files ?? []))
                  }
                />
              </label>
            </>
          ) : (
            <>
              <label
                className={`task-attachment-trigger ${isSubmitting ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
              >
                <Paperclip className="size-3.5" /> Anexar arquivo
                <input
                  type="file"
                  multiple
                  className="sr-only"
                  disabled={isSubmitting}
                  onChange={(event) =>
                    addAttachments(Array.from(event.target.files ?? []))
                  }
                />
              </label>
              <span className="flex items-center gap-1.5">
                <ClipboardPaste className="size-3.5" /> Cole um arquivo ou print
                com Ctrl+V.
              </span>
            </>
          )}
        </div>
        {isDraggingFiles ? (
          <p className="rounded-xl border border-dashed border-teal-500/60 bg-teal-500/10 px-3 py-2 text-center text-sm font-medium text-teal-700 dark:text-teal-200">
            Solte os arquivos para anexá-los
          </p>
        ) : null}

        <div className="grid gap-3">
          <Input
            className="h-12 min-w-0 rounded-2xl border-slate-900/10 bg-slate-950/[0.03] text-base shadow-none dark:border-white/10 dark:bg-black/20 disabled:opacity-60"
            placeholder="Ex.: Escrever proposta comercial"
            value={values.title}
            disabled={isSubmitting}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                title: event.target.value,
              }))
            }
            maxLength={120}
            required
          />

          {values.type === "date" ? (
            <section className="rounded-2xl border border-pink-500/20 bg-pink-500/[0.04] p-3">
              <h3 className="text-sm font-semibold text-pink-700 dark:text-pink-200">Dados estruturados do Date</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-white/45">Preencha estes dados primeiro; use a descrição para observações adicionais.</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {[["age", "Idade", "number"], ["sign", "Signo", "text"], ["address", "Endereço", "text"], ["height", "Altura", "text"], ["work", "Trabalho", "text"], ["location", "Local", "text"], ["date_at", "Data do date", "date"]].map(([key, label, type]) => (
                  <Input key={key} type={type} placeholder={label} value={String(dateDetails[key as keyof typeof dateDetails] ?? "")} onChange={(event) => setDateDetails((current) => ({ ...current, [key]: type === "number" ? (event.target.value ? Number(event.target.value) : null) : event.target.value || null }))} />
                ))}
                <select className="h-10 rounded-xl border border-slate-900/10 bg-white px-3 text-sm dark:border-white/10 dark:bg-black/20" value={dateDetails.has_children === null || dateDetails.has_children === undefined ? "" : String(dateDetails.has_children)} onChange={(event) => setDateDetails((current) => ({ ...current, has_children: event.target.value === "" ? null : event.target.value === "true" }))}>
                  <option value="">Tem filho?</option><option value="true">Sim</option><option value="false">Não</option>
                </select>
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
          {!isCompact ? (
            <Textarea
              ref={descriptionRef}
              className="min-h-20 rounded-2xl border-slate-900/10 bg-slate-950/[0.03] shadow-none dark:border-white/10 dark:bg-black/20 disabled:opacity-60"
              placeholder={values.type === "date" ? "Observações adicionais (opcional)" : "Descrição opcional"}
              value={values.description}
              disabled={isSubmitting}
              onChange={handleDescriptionChange}
              rows={3}
            />
          ) : null}
        </div>

        <section className="rounded-2xl border border-slate-900/10 bg-slate-950/[0.025] p-3 dark:border-white/10 dark:bg-black/10">
          <div className="flex items-start gap-2">
            <ListChecks className="mt-0.5 size-4 shrink-0 text-teal-500" />
            <div className="min-w-0">
              <h3 className="text-sm font-semibold">
                Subtarefas
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-white/45">
                Quebre a tarefa em passos menores e já deixe tudo planejado.
              </p>
            </div>
            <span className="ml-auto shrink-0 text-xs text-slate-500 dark:text-white/45">
              {subtasks.length}/20
            </span>
          </div>

          {subtasks.length ? (
            <div className="mt-3 grid gap-2">
              {subtasks.map((subtask, index) => (
                <div
                  key={`${subtask}-${index}`}
                  className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-900/10 bg-white/60 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/[0.04]"
                >
                  <span className="size-1.5 shrink-0 rounded-full bg-teal-400" />
                  <span className="min-w-0 flex-1 break-words">{subtask}</span>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    className="size-7 shrink-0 rounded-full text-slate-500 hover:text-rose-500 dark:text-white/45 dark:hover:text-rose-300"
                    disabled={isSubmitting}
                    onClick={() =>
                      setSubtasks((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                    aria-label={`Remover subtarefa ${subtask}`}
                    title="Remover subtarefa"
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-3 flex min-w-0 flex-col gap-2 sm:flex-row">
            <Input
              className="h-10 min-w-0 rounded-xl border-slate-900/10 bg-white text-sm shadow-none dark:border-white/10 dark:bg-black/20"
              placeholder="Ex.: Revisar os anexos"
              value={subtaskDraft}
              disabled={isSubmitting || subtasks.length >= 20}
              maxLength={160}
              onChange={(event) => {
                setSubtaskDraft(event.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addSubtask();
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              className="h-10 shrink-0 rounded-xl px-3"
              disabled={isSubmitting || !subtaskDraft.trim() || subtasks.length >= 20}
              onClick={addSubtask}
            >
              <Plus className="size-4" />
              Adicionar passo
            </Button>
          </div>
        </section>

        <div
          className={[
            "grid gap-2 md:grid-cols-2",
            isCompact ? "xl:grid-cols-3" : "xl:grid-cols-4",
          ].join(" ")}
        >
          <label className="relative min-w-0">
            <Flag className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Select
              value={values.priority}
              disabled={isSubmitting}
              onValueChange={(value) =>
                setValues((current) => ({
                  ...current,
                  priority: (value ?? "medium") as TaskPriority,
                }))
              }
            >
              <SelectTrigger className={compactSelectClass}>
                <span className="flex h-full items-center text-sm">
                  {getPriorityLabel(values.priority)}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Baixa</SelectItem>
                <SelectItem value="medium">Média</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
              </SelectContent>
            </Select>
          </label>

          <label className="relative min-w-0">
            <Tags className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Select
              value={values.type}
              disabled={isSubmitting}
              onValueChange={(value) =>
                setValues((current) => {
                  const type = (value ?? "task") as TaskType;
                  return {
                    ...current,
                    type,
                  };
                })
              }
            >
              <SelectTrigger className={compactSelectClass}>
                <span className="flex h-full items-center text-sm">
                  {getTaskTypeLabel(values.type)}
                </span>
              </SelectTrigger>
              <SelectContent>
                {availableTaskTypes.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="relative min-w-0">
            <Folder className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Select
              value={values.category}
              disabled={isSubmitting}
              onValueChange={(value) =>
                setValues((current) => {
                  const category = value ?? "trabalho";
                  return {
                    ...current,
                    category,
                    type: getDefaultTaskType(category),
                  };
                })
              }
            >
              <SelectTrigger aria-label="Categoria" className={compactSelectClass}>
                <span className="flex h-full items-center text-sm">
                  {getTaskCategoryLabel(values.category)}
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
          </label>
        </div>

        {errorMessage ? (
          <p className="break-words text-sm text-destructive">{errorMessage}</p>
        ) : null}
      </form>
    </section>
  );
}
