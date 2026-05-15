"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { PomodoroPhase, PomodoroSnapshot } from "@/types/pomodoro";

const STORAGE_KEY = "pomodoro_state_v1";

const DEFAULT_SNAPSHOT: PomodoroSnapshot = {
  selectedTaskId: null,
  phase: "focus",
  status: "idle",
  focusMinutes: 25,
  breakMinutes: 5,
  remainingSeconds: 25 * 60,
  endAt: null,
  startedAt: null,
  completedPhaseLabel: null,
};

function normalizeMinutes(value: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(180, Math.max(1, Math.floor(value)));
}

function getPhaseSeconds(phase: PomodoroPhase, snapshot: PomodoroSnapshot) {
  return (phase === "focus" ? snapshot.focusMinutes : snapshot.breakMinutes) * 60;
}

function parseStoredSnapshot(raw: string | null): PomodoroSnapshot | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PomodoroSnapshot>;

    const phase = parsed.phase === "break" ? "break" : "focus";
    const status =
      parsed.status === "running" ||
      parsed.status === "paused" ||
      parsed.status === "finished"
        ? parsed.status
        : "idle";

    const focusMinutes = normalizeMinutes(parsed.focusMinutes ?? 25, 25);
    const breakMinutes = normalizeMinutes(parsed.breakMinutes ?? 5, 5);

    const base: PomodoroSnapshot = {
      selectedTaskId: parsed.selectedTaskId ?? null,
      phase,
      status,
      focusMinutes,
      breakMinutes,
      remainingSeconds:
        typeof parsed.remainingSeconds === "number" && parsed.remainingSeconds > 0
          ? Math.floor(parsed.remainingSeconds)
          : (phase === "focus" ? focusMinutes : breakMinutes) * 60,
      endAt: typeof parsed.endAt === "number" ? parsed.endAt : null,
      startedAt: typeof parsed.startedAt === "number" ? parsed.startedAt : null,
      completedPhaseLabel:
        parsed.completedPhaseLabel === "focus" || parsed.completedPhaseLabel === "break"
          ? parsed.completedPhaseLabel
          : null,
    };

    if (base.status === "running" && base.endAt !== null) {
      const remainingSeconds = Math.ceil((base.endAt - Date.now()) / 1000);

      if (remainingSeconds <= 0) {
        const completedPhase = base.phase;
        const nextPhase = completedPhase === "focus" ? "break" : "focus";
        return {
          ...base,
          phase: nextPhase,
          status: "finished",
          remainingSeconds: getPhaseSeconds(nextPhase, base),
          endAt: null,
          startedAt: null,
          completedPhaseLabel: completedPhase,
        };
      }

      return {
        ...base,
        remainingSeconds,
      };
    }

    if (base.status === "idle") {
      return {
        ...base,
        remainingSeconds: getPhaseSeconds(base.phase, base),
      };
    }

    return base;
  } catch {
    return null;
  }
}

interface UsePomodoroOptions {
  onPhaseFinished?: (
    finishedPhase: PomodoroPhase,
    nextPhase: PomodoroPhase,
    durationSeconds: number,
  ) => void;
}

export function usePomodoro(options: UsePomodoroOptions = {}) {
  const [snapshot, setSnapshot] = useState<PomodoroSnapshot>(() => {
    if (typeof window === "undefined") {
      return DEFAULT_SNAPSHOT;
    }

    return parseStoredSnapshot(window.localStorage.getItem(STORAGE_KEY)) ?? DEFAULT_SNAPSHOT;
  });

  const onPhaseFinishedRef = useRef(options.onPhaseFinished);

  useEffect(() => {
    onPhaseFinishedRef.current = options.onPhaseFinished;
  }, [options.onPhaseFinished]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  }, [snapshot]);

  const completeCurrentPhase = useCallback(() => {
    setSnapshot((current) => {
      if (current.status !== "running") {
        return current;
      }

      const finishedPhase = current.phase;
      const nextPhase = finishedPhase === "focus" ? "break" : "focus";
      onPhaseFinishedRef.current?.(
        finishedPhase,
        nextPhase,
        getPhaseSeconds(finishedPhase, current),
      );

      return {
        ...current,
        phase: nextPhase,
        status: "finished",
        remainingSeconds: getPhaseSeconds(nextPhase, current),
        endAt: null,
        startedAt: null,
        completedPhaseLabel: finishedPhase,
      };
    });
  }, []);

  const finishFocus = useCallback(() => {
    setSnapshot((current) => {
      if (current.phase !== "focus" || current.status === "idle") {
        return current;
      }

      const finishedPhase = current.phase;
      const nextPhase = "break";
      onPhaseFinishedRef.current?.(
        finishedPhase,
        nextPhase,
        getPhaseSeconds(finishedPhase, current),
      );

      return {
        ...current,
        phase: nextPhase,
        status: "finished",
        remainingSeconds: getPhaseSeconds(nextPhase, current),
        endAt: null,
        startedAt: null,
        completedPhaseLabel: finishedPhase,
      };
    });
  }, []);

  useEffect(() => {
    if (snapshot.status !== "running" || snapshot.endAt === null) {
      return;
    }

    const tick = () => {
      const remainingSeconds = Math.ceil((snapshot.endAt as number - Date.now()) / 1000);

      if (remainingSeconds <= 0) {
        completeCurrentPhase();
        return;
      }

      setSnapshot((current) => {
        if (current.status !== "running") {
          return current;
        }

        return {
          ...current,
          remainingSeconds,
        };
      });
    };

    tick();
    const interval = window.setInterval(tick, 500);
    return () => window.clearInterval(interval);
  }, [completeCurrentPhase, snapshot.endAt, snapshot.status]);

  const setSelectedTaskId = useCallback((taskId: string | null) => {
    setSnapshot((current) => ({ ...current, selectedTaskId: taskId }));
  }, []);

  const setFocusMinutes = useCallback((minutes: number) => {
    setSnapshot((current) => {
      const focusMinutes = normalizeMinutes(minutes, current.focusMinutes);
      const shouldRefreshTimer = current.phase === "focus" && current.status !== "running";

      return {
        ...current,
        focusMinutes,
        remainingSeconds: shouldRefreshTimer ? focusMinutes * 60 : current.remainingSeconds,
      };
    });
  }, []);

  const setBreakMinutes = useCallback((minutes: number) => {
    setSnapshot((current) => {
      const breakMinutes = normalizeMinutes(minutes, current.breakMinutes);
      const shouldRefreshTimer = current.phase === "break" && current.status !== "running";

      return {
        ...current,
        breakMinutes,
        remainingSeconds: shouldRefreshTimer ? breakMinutes * 60 : current.remainingSeconds,
      };
    });
  }, []);

  const start = useCallback(() => {
    setSnapshot((current) => {
      if (current.status === "running") {
        return current;
      }

      const baseSeconds =
        current.status === "idle"
          ? getPhaseSeconds(current.phase, current)
          : current.remainingSeconds;

      const endAt = Date.now() + baseSeconds * 1000;

      return {
        ...current,
        status: "running",
        remainingSeconds: baseSeconds,
        startedAt: Date.now(),
        endAt,
        completedPhaseLabel: null,
      };
    });
  }, []);

  const pause = useCallback(() => {
    setSnapshot((current) => {
      if (current.status !== "running" || current.endAt === null) {
        return current;
      }

      const remainingSeconds = Math.max(1, Math.ceil((current.endAt - Date.now()) / 1000));

      return {
        ...current,
        status: "paused",
        endAt: null,
        startedAt: null,
        remainingSeconds,
      };
    });
  }, []);

  const resume = useCallback(() => {
    setSnapshot((current) => {
      if (current.status !== "paused") {
        return current;
      }

      return {
        ...current,
        status: "running",
        endAt: Date.now() + current.remainingSeconds * 1000,
        startedAt: Date.now(),
      };
    });
  }, []);

  const reset = useCallback(() => {
    setSnapshot((current) => ({
      ...current,
      phase: "focus",
      status: "idle",
      remainingSeconds: current.focusMinutes * 60,
      endAt: null,
      startedAt: null,
      completedPhaseLabel: null,
    }));
  }, []);

  const skipToBreak = useCallback(() => {
    setSnapshot((current) => {
      if (current.phase === "break" && current.status === "running") {
        return current;
      }

      const remainingSeconds = current.breakMinutes * 60;

      return {
        ...current,
        phase: "break",
        status: "running",
        remainingSeconds,
        endAt: Date.now() + remainingSeconds * 1000,
        startedAt: Date.now(),
        completedPhaseLabel: null,
      };
    });
  }, []);

  const clearCompletionAlert = useCallback(() => {
    setSnapshot((current) => ({ ...current, completedPhaseLabel: null }));
  }, []);

  const api = useMemo(
    () => ({
      ...snapshot,
      setSelectedTaskId,
      setFocusMinutes,
      setBreakMinutes,
      start,
      pause,
      resume,
      reset,
      skipToBreak,
      finishFocus,
      clearCompletionAlert,
    }),
    [
      clearCompletionAlert,
      pause,
      reset,
      resume,
      setBreakMinutes,
      setFocusMinutes,
      setSelectedTaskId,
      finishFocus,
      skipToBreak,
      snapshot,
      start,
    ],
  );

  return api;
}
