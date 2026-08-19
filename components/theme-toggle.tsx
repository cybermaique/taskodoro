"use client";

import { BookOpen, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();

  const currentTheme = resolvedTheme === "dark" || resolvedTheme === "comfort"
    ? resolvedTheme
    : "light";
  const nextTheme =
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

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={() => setTheme(nextTheme)}
      aria-label={`Alternar para modo ${nextThemeLabel}`}
      title={`Mudar para ${nextThemeLabel}`}
      className="size-11 shrink-0 rounded-full sm:size-8 sm:rounded-lg"
    >
      {currentTheme === "light" ? (
        <BookOpen className="size-5 sm:size-4" />
      ) : currentTheme === "comfort" ? (
        <Moon className="size-5 sm:size-4" />
      ) : (
        <Sun className="size-5 sm:size-4" />
      )}
    </Button>
  );
}
