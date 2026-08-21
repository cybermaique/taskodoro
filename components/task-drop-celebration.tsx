"use client";

import { useEffect, type CSSProperties } from "react";
import confetti from "canvas-confetti";
import { Sparkles, Trophy } from "lucide-react";

import { useSensoryEffects } from "@/components/sensory-effects";

const CONFETTI_COLORS = [
  "#2dd4bf",
  "#38bdf8",
  "#818cf8",
  "#c084fc",
  "#f472b6",
  "#facc15",
  "#fb7185",
];

const COMPLETION_COLORS = [
  "#34d399",
  "#2dd4bf",
  "#facc15",
  "#fbbf24",
  "#ffffff",
  "#a7f3d0",
];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function TaskDropCelebration({
  x,
  y,
  variant,
}: {
  x: number;
  y: number;
  variant: "move" | "complete";
}) {
  const { playSound } = useSensoryEffects();

  useEffect(() => {
    const isCompletion = variant === "complete";
    playSound(isCompletion ? "complete" : "move");
    const origin = {
      x: clamp(x / window.innerWidth, 0.04, 0.96),
      y: clamp(y / window.innerHeight, 0.06, 0.94),
    };

    const fire = (
      options: confetti.Options,
      customOrigin = origin,
    ) => {
      void confetti({
        ...options,
        origin: customOrigin,
        colors: isCompletion ? COMPLETION_COLORS : CONFETTI_COLORS,
        disableForReducedMotion: false,
        zIndex: 120,
      });
    };

    fire({
      particleCount: isCompletion ? 145 : 85,
      spread: isCompletion ? 132 : 105,
      startVelocity: isCompletion ? 62 : 52,
      gravity: isCompletion ? 0.82 : 0.92,
      decay: 0.91,
      scalar: isCompletion ? 1.18 : 1.05,
      ticks: isCompletion ? 260 : 220,
    });

    const leftCannon = window.setTimeout(() => {
      fire({
        particleCount: 38,
        angle: 55,
        spread: 48,
        startVelocity: 42,
        gravity: 0.82,
        scalar: 0.9,
        ticks: 190,
      });
    }, 90);

    const rightCannon = window.setTimeout(() => {
      fire({
        particleCount: 38,
        angle: 125,
        spread: 48,
        startVelocity: 42,
        gravity: 0.82,
        scalar: 0.9,
        ticks: 190,
      });
    }, 150);

    const sparkleBurst = window.setTimeout(() => {
      fire({
        particleCount: 28,
        spread: 360,
        startVelocity: 22,
        gravity: 0.45,
        decay: 0.9,
        scalar: 0.65,
        ticks: 155,
      });
    }, 260);

    const completionLeft = window.setTimeout(() => {
      if (!isCompletion) return;
      fire(
        {
          particleCount: 72,
          angle: 58,
          spread: 64,
          startVelocity: 58,
          gravity: 0.72,
          scalar: 1.05,
          ticks: 250,
        },
        { x: 0.06, y: 0.78 },
      );
    }, 330);

    const completionRight = window.setTimeout(() => {
      if (!isCompletion) return;
      fire(
        {
          particleCount: 72,
          angle: 122,
          spread: 64,
          startVelocity: 58,
          gravity: 0.72,
          scalar: 1.05,
          ticks: 250,
        },
        { x: 0.94, y: 0.78 },
      );
    }, 420);

    const completionShower = window.setTimeout(() => {
      if (!isCompletion) return;
      fire(
        {
          particleCount: 55,
          angle: 270,
          spread: 82,
          startVelocity: 24,
          gravity: 0.55,
          scalar: 0.8,
          ticks: 260,
        },
        { x: 0.5, y: 0 },
      );
    }, 680);

    return () => {
      window.clearTimeout(leftCannon);
      window.clearTimeout(rightCannon);
      window.clearTimeout(sparkleBurst);
      window.clearTimeout(completionLeft);
      window.clearTimeout(completionRight);
      window.clearTimeout(completionShower);
    };
  }, [playSound, variant, x, y]);

  const positionStyle = {
    "--drop-x": `${x}px`,
    "--drop-y": `${y}px`,
  } as CSSProperties;

  return (
    <div
      className="task-drop-celebration-layer"
      style={positionStyle}
      aria-hidden="true"
    >
      <div className="task-drop-screen-flash" />
      <div
        className={[
          "task-drop-animated-message",
          variant === "complete" ? "task-drop-complete-message" : "",
        ].join(" ")}
      >
        <span className="task-drop-message-shine" />
        {variant === "complete" ? (
          <Trophy className="size-4 shrink-0" />
        ) : (
          <Sparkles className="size-4 shrink-0" />
        )}
        <span>
          {variant === "complete" ? "Missão concluída!" : "Boa! Task movida"}
        </span>
        <span aria-hidden="true">{variant === "complete" ? "🏆" : "🚀"}</span>
      </div>
    </div>
  );
}
