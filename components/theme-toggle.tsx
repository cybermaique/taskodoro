"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Alternar tema"
      title="Alternar tema"
      className="size-11 shrink-0 rounded-full sm:size-8 sm:rounded-lg"
    >
      {isDark ? (
        <Sun className="size-5 sm:size-4" />
      ) : (
        <Moon className="size-5 sm:size-4" />
      )}
    </Button>
  );
}
