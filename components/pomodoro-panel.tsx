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
    <aside className="lg:sticky lg:top-6">
      <section className="overflow-hidden rounded-[28px] border border-white/10 bg-zinc-950 text-white shadow-2xl shadow-black/20">
        <div className="relative isolate">
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(145deg,rgba(20,184,166,0.24),transparent_38%),linear-gradient(315deg,rgba(244,63,94,0.18),transparent_42%)]" />
          <div className="absolute inset-x-0 top-0 -z-10 h-48 bg-[linear-gradient(90deg,rgba(255,255,255,0.14),transparent)]" />

          <div className="flex items-start justify-between gap-4 p-5 pb-4 sm:p-6 sm:pb-5">
            <div>
              <p className="text-xs font-semibold uppercase text-teal-200/80">
                Sessão atual
              </p>
              <h2 className="mt-1 text-2xl font-semibold">Pomodoro</h2>
            </div>
            <div className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium">
              {statusLabel(status, phase)}
            </div>
          </div>

          {isCompact ? (
            selectedTask ? (
              <div className="px-5 sm:px-6">
                <div className="rounded-2xl border border-white/10 bg-black/30 p-3 shadow-lg shadow-black/10">
                  <p className="text-sm font-semibold leading-snug">{selectedTask.title}</p>
                </div>
              </div>
            ) : null
          ) : (
            <div className="px-5 sm:px-6">
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4 shadow-lg shadow-black/10">
                <p className="text-xs font-semibold uppercase text-white/45">Tarefa ativa</p>
                <p className="mt-2 text-base font-semibold leading-snug">
                  {selectedTask?.title ?? "Selecione uma tarefa para iniciar o foco"}
                </p>
              </div>
            </div>
          )}

          <div className={isCompact ? "mt-4 grid place-items-center px-5 sm:px-6" : "mt-6 grid place-items-center px-5 sm:px-6"}>
            <div
              className={[
                "grid max-w-full place-items-center rounded-full p-3 shadow-inner shadow-black/40",
                isCompact ? "size-52" : "size-64",
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
                  <p className={isCompact ? "mt-2 text-5xl font-semibold leading-none tabular-nums tracking-normal" : "mt-2 text-6xl font-semibold leading-none tabular-nums tracking-normal"}>
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
            <div className="mx-5 mt-6 grid gap-4 rounded-2xl border border-white/10 bg-white/[0.06] p-4 sm:mx-6">
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

          <div className="grid grid-cols-2 gap-2 p-5 sm:p-6">
            <Button
              className="h-10 bg-white text-zinc-950 hover:bg-white/90"
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
              className="h-10 border-white/10 bg-white/10 text-white hover:bg-white/15"
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
              className="h-10 border-white/10 bg-white/10 text-white hover:bg-white/15"
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
              className="h-10 border-white/10 bg-white/10 text-white hover:bg-white/15"
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
              className="col-span-2 h-10 bg-teal-300 text-teal-950 hover:bg-teal-200"
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
              className="col-span-2 h-10 border-white/10 bg-white/10 text-white hover:bg-white/15"
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
    <div className="flex flex-wrap items-center gap-2">
      <div className="mr-auto flex min-w-24 items-center gap-2 text-sm font-medium text-white/80">
        {label === "Descanso" ? <Coffee className="size-4" /> : <TimerReset className="size-4" />}
        {label}
      </div>
      {presets.map((preset) => (
        <Button
          key={preset}
          className={
            value === preset
              ? "bg-white text-zinc-950 hover:bg-white/90"
              : "border-white/10 bg-white/10 text-white hover:bg-white/15"
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
        className="h-8 w-20 border-white/10 bg-black/20 text-white"
        onChange={(event) => onChange(readPositiveNumber(event.target.value, value))}
      />
    </div>
  );
}
