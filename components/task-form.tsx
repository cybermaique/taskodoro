"use client";

import { FormEvent, useState } from "react";
import { CalendarCheck, CalendarDays, Flag, Folder, Plus, Repeat, Timer } from "lucide-react";

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
  pomodoro_minutes: string;
  break_minutes: string;
}

interface TaskFormProps {
  isSubmitting: boolean;
  isCompact?: boolean;
  categorySuggestions: string[];
  onCreate: (values: {
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
  }) => Promise<void>;
}

const EMPTY_VALUES: TaskFormValues = {
  title: "",
  description: "",
  priority: "medium",
  category: "",
  due_date: "",
  planned_for: "",
  estimated_minutes: "",
  recurrence: "none",
  pomodoro_minutes: "",
  break_minutes: "",
};

const compactFieldClass =
  "h-12 min-h-12 w-full rounded-2xl border-slate-900/10 bg-white pl-10 pr-3 text-sm shadow-none dark:border-white/10 dark:bg-black/20";
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
  onCreate,
}: TaskFormProps) {
  const [values, setValues] = useState<TaskFormValues>(EMPTY_VALUES);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
        pomodoro_minutes: readMinutes(values.pomodoro_minutes),
        break_minutes: readMinutes(values.break_minutes),
      });

      setValues(EMPTY_VALUES);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Não foi possível criar a tarefa.",
      );
    }
  };

  return (
    <section className="rounded-3xl border border-slate-900/10 bg-white/80 p-4 shadow-sm shadow-slate-950/5 backdrop-blur dark:border-white/10 dark:bg-white/[0.07] dark:shadow-black/20">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Nova tarefa</h2>
            {!isCompact ? (
              <p className="text-sm text-slate-500 dark:text-white/45">
                Capture rápido, refine depois.
              </p>
            ) : null}
          </div>
          <Button type="submit" disabled={isSubmitting} className="h-9 rounded-full px-4">
            <Plus className="size-4" />
            {isSubmitting ? "Salvando" : "Adicionar"}
          </Button>
        </div>

        <div className="grid gap-3">
          <Input
            className="h-12 rounded-2xl border-slate-900/10 bg-slate-950/[0.03] text-base shadow-none dark:border-white/10 dark:bg-black/20"
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

          {!isCompact ? (
            <label className="relative min-w-0">
            <Timer className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              className={compactFieldClass}
              type="number"
              min={1}
              max={180}
              placeholder="Foco"
              value={values.pomodoro_minutes}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  pomodoro_minutes: event.target.value,
                }))
              }
            />
          </label>
          ) : null}
          {!isCompact ? (
            <label className="relative min-w-0">
            <Timer className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              className={compactFieldClass}
              type="number"
              min={1}
              max={60}
              placeholder="Pausa"
              value={values.break_minutes}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  break_minutes: event.target.value,
                }))
              }
            />
          </label>
          ) : null}
        </div>

        {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
      </form>
    </section>
  );
}
