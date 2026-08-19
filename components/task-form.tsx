"use client";

import { type ClipboardEvent, type DragEvent, type FormEvent, useEffect, useState } from "react";
import { CalendarCheck, CalendarDays, ClipboardPaste, Flag, Folder, Paperclip, Plus, Repeat, Timer, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { TaskPriority, TaskRecurrence } from "@/types/task";

interface TaskFormValues {
  title: string;
  description: string;
  priority: TaskPriority;
  category: string;
  due_date: string;
  planned_for: string;
  estimated_minutes: string;
  recurrence: TaskRecurrence;
}

interface TaskFormProps {
  isSubmitting: boolean;
  isCompact?: boolean;
  categorySuggestions: string[];
  onDirtyChange?: (isDirty: boolean) => void;
  onCreate: (values: {
    title: string;
    description?: string;
    priority?: TaskPriority;
    category?: string | null;
    due_date?: string | null;
    planned_for?: string | null;
    estimated_minutes?: number | null;
    recurrence?: TaskRecurrence;
    attachments?: File[];
  }) => Promise<void>;
}

const EMPTY_VALUES: TaskFormValues = {
  title: "",
  description: "",
  priority: "medium",
  category: "trabalho",
  due_date: "",
  planned_for: "",
  estimated_minutes: "",
  recurrence: "none",
};

const compactFieldClass =
  "h-12 min-h-12 w-full rounded-2xl border-slate-900/10 bg-white pl-10 pr-3 text-base shadow-none sm:text-sm dark:border-white/10 dark:bg-black/20";
const compactSelectClass =
  "h-12 min-h-12 w-full rounded-2xl border-slate-900/10 bg-white py-0 pl-10 pr-3 text-sm shadow-none dark:border-white/10 dark:bg-black/20";

function readMinutes(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.floor(parsed);
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

export function TaskForm({
  isSubmitting,
  isCompact = false,
  categorySuggestions,
  onDirtyChange,
  onCreate,
}: TaskFormProps) {
  const [values, setValues] = useState<TaskFormValues>(EMPTY_VALUES);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);

  const isDirty =
    values.title !== EMPTY_VALUES.title ||
    values.description !== EMPTY_VALUES.description ||
    values.priority !== EMPTY_VALUES.priority ||
    values.category !== EMPTY_VALUES.category ||
    values.due_date !== EMPTY_VALUES.due_date ||
    values.planned_for !== EMPTY_VALUES.planned_for ||
    values.estimated_minutes !== EMPTY_VALUES.estimated_minutes ||
    values.recurrence !== EMPTY_VALUES.recurrence ||
    attachments.length > 0;

  useEffect(() => {
    onDirtyChange?.(isDirty);
    return () => onDirtyChange?.(false);
  }, [isDirty, onDirtyChange]);

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

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const title = values.title.trim();

    if (!title) {
      setErrorMessage("Digite o título da tarefa.");
      return;
    }

    setErrorMessage(null);

    try {
      await onCreate({
        title,
        description: values.description.trim() || undefined,
        priority: values.priority,
        category: values.category.trim() || null,
        due_date: values.due_date || null,
        planned_for: values.planned_for || null,
        estimated_minutes: readMinutes(values.estimated_minutes),
        recurrence: values.recurrence,
        attachments: attachments.length ? attachments : undefined,
      });

      setValues(EMPTY_VALUES);
      setAttachments([]);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Não foi possível criar a tarefa.",
      );
    }
  };

  return (
    <section className="min-w-0 rounded-2xl border border-slate-900/10 bg-white/80 p-3 shadow-sm shadow-slate-950/5 backdrop-blur sm:rounded-3xl sm:p-4 dark:border-white/10 dark:bg-white/[0.07] dark:shadow-black/20">
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
        className={["min-w-0 space-y-3 rounded-2xl transition sm:space-y-4", isDraggingFiles ? "bg-teal-500/5 ring-2 ring-teal-400/70 ring-inset" : ""].join(" ")}
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
            disabled={isSubmitting}
            className="h-11 w-full touch-manipulation rounded-full px-4 sm:h-9 sm:w-auto"
          >
            <Plus className="size-4" />
            {isSubmitting ? "Salvando" : "Adicionar"}
          </Button>
        </div>

        <div className="flex min-h-10 flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-white/45">
          {attachments.length ? (
            <>
              {attachments.map((attachment, index) => (
                <span key={`${attachment.name}-${attachment.lastModified}-${index}`} className="flex items-center rounded-full border border-teal-500/30 bg-teal-500/10 pl-3 text-teal-700 dark:text-teal-200">
                  Arquivo: {attachment.name || "arquivo"}
                  <Button type="button" size="sm" variant="ghost" className="h-8 rounded-full px-2" onClick={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remover ${attachment.name || "arquivo"}`}>
                    <X className="size-4" />
                  </Button>
                </span>
              ))}
              <label className="flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-900/10 px-2.5 py-1 hover:bg-slate-900/5 dark:border-white/10 dark:hover:bg-white/10"><Paperclip className="size-3.5" /> Adicionar<input type="file" multiple className="sr-only" onChange={(event) => addAttachments(Array.from(event.target.files ?? []))} /></label>
            </>
          ) : (
            <>
              <label className="flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-900/10 px-2.5 py-1 hover:bg-slate-900/5 dark:border-white/10 dark:hover:bg-white/10"><Paperclip className="size-3.5" /> Anexar arquivo<input type="file" multiple className="sr-only" onChange={(event) => addAttachments(Array.from(event.target.files ?? []))} /></label>
              <span className="flex items-center gap-1.5"><ClipboardPaste className="size-3.5" /> Cole um arquivo ou print com Ctrl+V.</span>
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
            className="h-12 min-w-0 rounded-2xl border-slate-900/10 bg-slate-950/[0.03] text-base shadow-none dark:border-white/10 dark:bg-black/20"
            placeholder="Ex.: Escrever proposta comercial"
            value={values.title}
            onChange={(event) =>
              setValues((current) => ({ ...current, title: event.target.value }))
            }
            maxLength={120}
            required
          />

          {!isCompact ? (
            <Textarea
              className="min-h-20 rounded-2xl border-slate-900/10 bg-slate-950/[0.03] shadow-none dark:border-white/10 dark:bg-black/20"
              placeholder="Descrição opcional"
              value={values.description}
              onChange={(event) =>
                setValues((current) => ({ ...current, description: event.target.value }))
              }
              rows={3}
            />
          ) : null}
        </div>

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
            <Folder className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              className={compactFieldClass}
              list="category-suggestions"
              placeholder="Categoria"
              value={values.category}
              onChange={(event) =>
                setValues((current) => ({ ...current, category: event.target.value }))
              }
            />
          </label>

          <label className="relative min-w-0">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              className={compactFieldClass}
              type="date"
              value={values.due_date}
              onChange={(event) =>
                setValues((current) => ({ ...current, due_date: event.target.value }))
              }
            />
          </label>

          {!isCompact ? (
            <label className="relative min-w-0">
            <CalendarCheck className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              className={compactFieldClass}
              type="date"
              value={values.planned_for}
              onChange={(event) =>
                setValues((current) => ({ ...current, planned_for: event.target.value }))
              }
              title="Fazer em"
            />
          </label>
          ) : null}

          <datalist id="category-suggestions">
            {categorySuggestions.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>

          {!isCompact ? (
            <label className="relative min-w-0">
            <Timer className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              className={compactFieldClass}
              type="number"
              min={1}
              max={180}
              placeholder="Estimativa"
              value={values.estimated_minutes}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  estimated_minutes: event.target.value,
                }))
              }
            />
          </label>
          ) : null}

          {!isCompact ? (
            <label className="relative min-w-0">
            <Repeat className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Select
              value={values.recurrence}
              onValueChange={(value) =>
                setValues((current) => ({
                  ...current,
                  recurrence: (value ?? "none") as TaskRecurrence,
                }))
              }
            >
              <SelectTrigger className={compactSelectClass}>
                <span className="flex h-full items-center text-sm">
                  {getRecurrenceLabel(values.recurrence)}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem recorrência</SelectItem>
                <SelectItem value="daily">Diária</SelectItem>
                <SelectItem value="weekly">Semanal</SelectItem>
                <SelectItem value="monthly">Mensal</SelectItem>
              </SelectContent>
            </Select>
          </label>
          ) : null}

        </div>

        {errorMessage ? (
          <p className="break-words text-sm text-destructive">
            {errorMessage}
          </p>
        ) : null}
      </form>
    </section>
  );
}
