"use client";

import { CheckCircle2, Coffee, FastForward, Pause, Play, RotateCcw, TimerReset } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { secondsToClock } from "@/lib/format";
import type { PomodoroPhase, PomodoroStatus } from "@/types/pomodoro";
import type { Task } from "@/types/task";

interface PomodoroPanelProps {
  selectedTask: Task | null;
  phase: PomodoroPhase;
  status: PomodoroStatus;
  isCompact?: boolean;
  remainingSeconds: number;
  focusMinutes: number;
  breakMinutes: number;
  onSetFocusMinutes: (minutes: number) => void;
  onSetBreakMinutes: (minutes: number) => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onFinishFocus: () => void;
  onSkipToBreak: () => void;
  onUserInteraction: () => void;
}

function readPositiveNumber(value: string, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

function statusLabel(status: PomodoroStatus, phase: PomodoroPhase) {
  if (status === "paused") {
    return "Pausado";
  }

  if (status === "finished") {
    return "Finalizado";
  }

  return phase === "focus" ? "Foco" : "Descanso";
}

export function PomodoroPanel({
  selectedTask,
  phase,
  status,
  remainingSeconds,
  focusMinutes,
  breakMinutes,
  onSetFocusMinutes,
  onSetBreakMinutes,
  onStart,
  onPause,
  onResume,
  onReset,
  onFinishFocus,
  onSkipToBreak,
  onUserInteraction,
  isCompact = false,
}: PomodoroPanelProps) {
  const canStart = Boolean(selectedTask);
  const phaseSeconds = (phase === "focus" ? focusMinutes : breakMinutes) * 60;
  const elapsedRatio =
    phaseSeconds > 0 ? Math.min(1, Math.max(0, 1 - remainingSeconds / phaseSeconds)) : 0;
  const progressDegrees = Math.round(elapsedRatio * 360);
  const isBreak = phase === "break";

  return (
    <aside className="min-w-0 lg:sticky lg:top-6">
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 text-white shadow-2xl shadow-black/20 sm:rounded-[28px]">
        <div className="relative isolate">
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(145deg,rgba(20,184,166,0.24),transparent_38%),linear-gradient(315deg,rgba(244,63,94,0.18),transparent_42%)]" />
          <div className="absolute inset-x-0 top-0 -z-10 h-48 bg-[linear-gradient(90deg,rgba(255,255,255,0.14),transparent)]" />

          <div className="flex items-start justify-between gap-3 p-4 pb-3 sm:gap-4 sm:p-6 sm:pb-5">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-teal-200/80">
                Sessão atual
              </p>
              <h2 className="mt-1 text-xl font-semibold sm:text-2xl">Pomodoro</h2>
            </div>
            <div className="shrink-0 whitespace-nowrap rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium">
              {statusLabel(status, phase)}
            </div>
          </div>

          {isCompact ? (
            selectedTask ? (
              <div className="px-4 sm:px-6">
                <div className="rounded-2xl border border-white/10 bg-black/30 p-3 shadow-lg shadow-black/10">
                  <p className="break-words text-sm font-semibold leading-snug [overflow-wrap:anywhere]">
                    {selectedTask.title}
                  </p>
                </div>
              </div>
            ) : null
          ) : (
            <div className="px-4 sm:px-6">
              <div className="rounded-2xl border border-white/10 bg-black/30 p-3 shadow-lg shadow-black/10 sm:p-4">
                <p className="text-xs font-semibold uppercase text-white/45">Tarefa ativa</p>
                <p className="mt-2 break-words text-base font-semibold leading-snug [overflow-wrap:anywhere]">
                  {selectedTask?.title ?? "Selecione uma tarefa para iniciar o foco"}
                </p>
              </div>
            </div>
          )}

          <div
            className={
              isCompact
                ? "mt-4 grid place-items-center px-4 sm:px-6"
                : "mt-5 grid place-items-center px-4 sm:mt-6 sm:px-6"
            }
          >
            <div
              className={[
                "grid aspect-square w-full place-items-center rounded-full p-2.5 shadow-inner shadow-black/40 sm:p-3",
                isCompact ? "max-w-52" : "max-w-64",
              ].join(" ")}
              style={{
                background: `conic-gradient(${isBreak ? "#2dd4bf" : "#fb7185"} ${progressDegrees}deg, rgba(255,255,255,0.12) 0deg)`,
              }}
            >
              <div className="grid size-full place-items-center rounded-full border border-white/10 bg-zinc-950/95 text-center">
                <div>
                  <p className="text-xs font-semibold uppercase text-white/45">
                    {isBreak ? "Pausa curta" : "Foco profundo"}
                  </p>
                  <p
                    className={
                      isCompact
                        ? "mt-2 text-4xl font-semibold leading-none tabular-nums tracking-normal min-[360px]:text-5xl"
                        : "mt-2 text-5xl font-semibold leading-none tabular-nums tracking-normal sm:text-6xl"
                    }
                  >
                    {secondsToClock(remainingSeconds)}
                  </p>
                  {!isCompact ? (
                    <p className="mt-3 text-sm text-white/55">
                    {Math.round(elapsedRatio * 100)}% do ciclo
                  </p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {!isCompact ? (
            <div className="mx-4 mt-5 grid gap-4 rounded-2xl border border-white/10 bg-white/[0.06] p-3 sm:mx-6 sm:mt-6 sm:p-4">
              <TimePresetGroup
                label="Foco"
                value={focusMinutes}
                presets={[25, 30, 45]}
                max={180}
                onChange={onSetFocusMinutes}
              />
              <TimePresetGroup
                label="Descanso"
                value={breakMinutes}
                presets={[5, 10]}
                max={60}
                onChange={onSetBreakMinutes}
              />
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2 p-4 sm:p-6">
            <Button
              className="h-11 bg-white text-zinc-950 hover:bg-white/90 sm:h-10"
              onClick={() => {
                onUserInteraction();
                onStart();
              }}
              disabled={!canStart || status === "running"}
            >
              <Play className="size-4" />
              Iniciar
            </Button>

            <Button
              className="h-11 border-white/10 bg-white/10 text-white hover:bg-white/15 sm:h-10"
              variant="outline"
              onClick={() => {
                onUserInteraction();
                onPause();
              }}
              disabled={status !== "running"}
            >
              <Pause className="size-4" />
              Pausar
            </Button>

            <Button
              className="h-11 border-white/10 bg-white/10 text-white hover:bg-white/15 sm:h-10"
              variant="outline"
              onClick={() => {
                onUserInteraction();
                onResume();
              }}
              disabled={status !== "paused"}
            >
              <TimerReset className="size-4" />
              Retomar
            </Button>

            <Button
              className="h-11 border-white/10 bg-white/10 text-white hover:bg-white/15 sm:h-10"
              variant="outline"
              onClick={() => {
                onUserInteraction();
                onReset();
              }}
            >
              <RotateCcw className="size-4" />
              Resetar
            </Button>

            {!isCompact ? (
              <Button
                className="col-span-2 h-11 bg-teal-300 text-teal-950 hover:bg-teal-200 sm:h-10"
                onClick={() => {
                  onUserInteraction();
                  onFinishFocus();
                }}
                disabled={!canStart || phase !== "focus" || status === "idle"}
              >
                <CheckCircle2 className="size-4" />
                Finalizar foco
              </Button>
            ) : null}

            {!isCompact ? (
              <Button
                className="col-span-2 h-11 border-white/10 bg-white/10 text-white hover:bg-white/15 sm:h-10"
                variant="outline"
                onClick={() => {
                  onUserInteraction();
                  onSkipToBreak();
                }}
                disabled={!canStart}
              >
                <FastForward className="size-4" />
                Pular para descanso
              </Button>
            ) : null}
          </div>
        </div>
      </section>
    </aside>
  );
}

function TimePresetGroup({
  label,
  value,
  presets,
  max,
  onChange,
}: {
  label: string;
  value: number;
  presets: number[];
  max: number;
  onChange: (minutes: number) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="flex items-center gap-2 text-sm font-medium text-white/80 sm:mr-auto sm:min-w-24">
        {label === "Descanso" ? <Coffee className="size-4" /> : <TimerReset className="size-4" />}
        {label}
      </div>
      <div className="flex min-w-0 gap-2">
        {presets.map((preset) => (
          <Button
            key={preset}
            className={
              value === preset
                ? "h-11 min-w-10 flex-1 bg-white text-zinc-950 hover:bg-white/90 sm:h-7 sm:min-w-0 sm:flex-none"
                : "h-11 min-w-10 flex-1 border-white/10 bg-white/10 text-white hover:bg-white/15 sm:h-7 sm:min-w-0 sm:flex-none"
            }
            variant={value === preset ? "default" : "outline"}
            size="sm"
            onClick={() => onChange(preset)}
          >
            {preset}
          </Button>
        ))}
        <Input
          type="number"
          min={1}
          max={max}
          value={value}
          aria-label={`${label} em minutos`}
          className="h-11 w-16 shrink-0 border-white/10 bg-black/20 text-center text-base text-white sm:h-8 sm:w-20 sm:text-sm"
          onChange={(event) => onChange(readPositiveNumber(event.target.value, value))}
        />
      </div>
    </div>
  );
}
