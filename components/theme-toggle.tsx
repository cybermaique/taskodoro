"use client";

import {
  type CSSProperties,
  type MouseEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { BookOpen, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

type AppTheme = "light" | "comfort" | "dark";

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const [transition, setTransition] = useState<{
    id: number;
    x: number;
    y: number;
    target: AppTheme;
  } | null>(null);
  const transitionIdRef = useRef(0);
  const timeoutRefs = useRef<number[]>([]);

  useEffect(() => {
    const timeoutIds = timeoutRefs.current;
    return () => {
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, []);

  const currentTheme: AppTheme =
    resolvedTheme === "dark" || resolvedTheme === "comfort"
      ? resolvedTheme
      : "light";
  const nextTheme: AppTheme =
    currentTheme === "light"
      ? "comfort"
      : currentTheme === "comfort"
        ? "dark"
        : "light";
  const nextThemeLabel =
    nextTheme === "comfort"
      ? "Conforto"
      : nextTheme === "dark"
        ? "Escuro"
        : "Claro";

  const changeTheme = (event: MouseEvent<HTMLButtonElement>) => {
    if (transition) return;
    const rect = event.currentTarget.getBoundingClientRect();
    transitionIdRef.current += 1;
    setTransition({
      id: transitionIdRef.current,
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      target: nextTheme,
    });

    timeoutRefs.current.push(
      window.setTimeout(() => setTheme(nextTheme), 170),
      window.setTimeout(() => {
        setTransition(null);
        timeoutRefs.current = [];
      }, 820),
    );
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={changeTheme}
        disabled={Boolean(transition)}
        aria-label={`Alternar para modo ${nextThemeLabel}`}
        title={`Mudar para ${nextThemeLabel}`}
        className="size-11 shrink-0 rounded-full sm:size-8 sm:rounded-lg"
      >
        {currentTheme === "light" ? (
          <BookOpen key="light" className="app-theme-icon size-5 sm:size-4" />
        ) : currentTheme === "comfort" ? (
          <Moon key="comfort" className="app-theme-icon size-5 sm:size-4" />
        ) : (
          <Sun key="dark" className="app-theme-icon size-5 sm:size-4" />
        )}
      </Button>
      {transition ? (
        <span
          key={transition.id}
          className={`app-theme-transition app-theme-transition-${transition.target}`}
          style={
            {
              "--theme-x": `${transition.x}px`,
              "--theme-y": `${transition.y}px`,
            } as CSSProperties
          }
          aria-hidden="true"
        />
      ) : null}
    </>
  );
}
