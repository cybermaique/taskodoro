"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";

export interface ContextMenuAction {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  actions: ContextMenuAction[];
  onClose: () => void;
}

export function ContextMenu({
  x,
  y,
  actions,
  onClose,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    const focusTimeout = window.setTimeout(() => {
      menuRef.current
        ?.querySelector<HTMLButtonElement>("[data-context-menu-action]")
        ?.focus();
    }, 0);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.clearTimeout(focusTimeout);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label="Opções do item"
      className="fixed z-[90] min-w-48 overflow-hidden rounded-xl border border-slate-900/15 bg-white/95 p-1.5 shadow-2xl shadow-slate-950/25 backdrop-blur-xl dark:border-white/15 dark:bg-zinc-950/95"
      style={{
        left: `max(0.5rem, min(calc(100vw - 13rem), ${x}px))`,
        top: `max(0.5rem, min(calc(100vh - 10rem), ${y}px))`,
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.label}
            type="button"
            role="menuitem"
            data-context-menu-action
            disabled={action.disabled}
            className={[
              "flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm transition-colors disabled:pointer-events-none disabled:opacity-40",
              action.destructive
                ? "text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
                : "text-slate-700 hover:bg-violet-500/10 hover:text-violet-700 dark:text-white/80 dark:hover:text-violet-200",
            ].join(" ")}
            onClick={() => {
              action.onSelect();
              onClose();
            }}
          >
            <Icon className="size-4 shrink-0" />
            {action.label}
          </button>
        );
      })}
    </div>,
    document.body,
  );
}
