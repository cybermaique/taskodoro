"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, AlertTriangle, Info, X, XCircle } from "lucide-react";

import { useSensoryEffects } from "@/components/sensory-effects";

/* ── types ─────────────────────────────────────────────── */

type ToastVariant = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: number;
  variant: ToastVariant;
  message: string;
}

interface ToastContextValue {
  toast: (variant: ToastVariant, message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

/* ── context ───────────────────────────────────────────── */

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

/* ── styling ───────────────────────────────────────────── */

const variantStyles: Record<
  ToastVariant,
  { container: string; icon: ReactNode }
> = {
  success: {
    container:
      "border-emerald-500/30 bg-emerald-50 text-emerald-900 dark:border-emerald-400/25 dark:bg-emerald-950/80 dark:text-emerald-100",
    icon: <CheckCircle2 className="size-5 shrink-0 text-emerald-500" />,
  },
  error: {
    container:
      "border-rose-500/30 bg-rose-50 text-rose-900 dark:border-rose-400/25 dark:bg-rose-950/80 dark:text-rose-100",
    icon: <XCircle className="size-5 shrink-0 text-rose-500" />,
  },
  warning: {
    container:
      "border-amber-500/30 bg-amber-50 text-amber-900 dark:border-amber-400/25 dark:bg-amber-950/80 dark:text-amber-100",
    icon: <AlertTriangle className="size-5 shrink-0 text-amber-500" />,
  },
  info: {
    container:
      "border-sky-500/30 bg-sky-50 text-sky-900 dark:border-sky-400/25 dark:bg-sky-950/80 dark:text-sky-100",
    icon: <Info className="size-5 shrink-0 text-sky-500" />,
  },
};

const TOAST_DURATION_MS = 4000;
const TOAST_ANIMATION_MS = 300;

/* ── individual toast ──────────────────────────────────── */

function Toast({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: number) => void;
}) {
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => onDismiss(item.id), TOAST_ANIMATION_MS);
  }, [item.id, onDismiss]);

  useEffect(() => {
    timerRef.current = setTimeout(dismiss, TOAST_DURATION_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [dismiss]);

  const style = variantStyles[item.variant];

  return (
    <div
      role="alert"
      className={[
        "app-toast-enter pointer-events-auto relative flex min-w-72 max-w-sm items-center gap-3 overflow-hidden rounded-2xl border px-4 py-3 shadow-lg backdrop-blur-xl transition-all",
        style.container,
        exiting
          ? "translate-y-2 scale-95 opacity-0"
          : "translate-y-0 scale-100 opacity-100",
      ].join(" ")}
      style={{ transitionDuration: `${TOAST_ANIMATION_MS}ms` }}
    >
      <span className="app-toast-icon">{style.icon}</span>
      <p className="min-w-0 flex-1 break-words text-sm font-medium [overflow-wrap:anywhere]">
        {item.message}
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-black/10 dark:hover:bg-white/15"
        aria-label="Fechar"
      >
        <X className="size-3.5" />
      </button>
      <span
        className={`app-toast-timer app-toast-timer-${item.variant}`}
        aria-hidden="true"
      />
    </div>
  );
}

/* ── provider ──────────────────────────────────────────── */

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const { playSound } = useSensoryEffects();

  const addToast = useCallback((variant: ToastVariant, message: string) => {
    const id = nextId++;
    setToasts((current) => [...current, { id, variant, message }]);
    playSound(
      variant === "success"
        ? "success"
        : variant === "error"
          ? "error"
          : variant === "warning"
            ? "warning"
            : "click",
    );
  }, [playSound]);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const ctx: ToastContextValue = {
    toast: addToast,
    success: useCallback((msg: string) => addToast("success", msg), [addToast]),
    error: useCallback((msg: string) => addToast("error", msg), [addToast]),
    warning: useCallback((msg: string) => addToast("warning", msg), [addToast]),
    info: useCallback((msg: string) => addToast("info", msg), [addToast]),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      {/* toast viewport */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col-reverse items-end gap-2 sm:bottom-6 sm:right-6"
      >
        {toasts.map((item) => (
          <Toast key={item.id} item={item} onDismiss={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
