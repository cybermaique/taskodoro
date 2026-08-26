"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { createPortal } from "react-dom";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const monthFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
});
const displayFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const CALENDAR_PANEL_WIDTH = 352;
const CALENDAR_PANEL_HEIGHT = 360;
const RANGE_PANEL_WIDTH = 288;
const RANGE_PANEL_HEIGHT = 350;
const CALENDAR_VIEWPORT_GAP = 12;

type CalendarPlacement = {
  top: number;
  left: number;
  vertical: "top" | "bottom";
  horizontal: "start" | "end";
};

function formatMonthYear(date: Date) {
  return monthFormatter.format(date).replace(/\s+de\s+/i, " ");
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}

function toIsoDate(date: Date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function isSameDate(left: Date | null, right: Date) {
  return Boolean(left) && left?.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Selecionar data",
  disabled = false,
}: {
  value?: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const selectedDate = parseDate(value);
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<CalendarPlacement>({
    top: CALENDAR_VIEWPORT_GAP,
    left: CALENDAR_VIEWPORT_GAP,
    vertical: "bottom",
    horizontal: "start",
  });
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const initialDate = selectedDate ?? new Date();
    return new Date(initialDate.getFullYear(), initialDate.getMonth(), 1);
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !popoverRef.current?.contains(target)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const firstWeekday = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1).getDay();
  const daysInMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();
  const calendarDays = Array.from({ length: firstWeekday + daysInMonth }, (_, index) =>
    index < firstWeekday
      ? null
      : new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), index - firstWeekday + 1),
  );
  const today = startOfDay(new Date());
  const moveMonth = (offset: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  const selectDate = (date: Date) => {
    onChange(toIsoDate(date));
    setOpen(false);
  };

  const updatePlacement = () => {
    const bounds = rootRef.current?.getBoundingClientRect();
    if (!bounds) return;

    const panelWidth = Math.min(CALENDAR_PANEL_WIDTH, window.innerWidth - CALENDAR_VIEWPORT_GAP * 2);
    const panelHeight = popoverRef.current?.offsetHeight ?? CALENDAR_PANEL_HEIGHT;
    const spaceBelow = window.innerHeight - bounds.bottom;
    const spaceAbove = bounds.top;
    const shouldOpenAbove = spaceBelow < CALENDAR_PANEL_HEIGHT && spaceAbove > spaceBelow;
    const shouldAlignEnd = bounds.left + panelWidth > window.innerWidth - CALENDAR_VIEWPORT_GAP && bounds.right - panelWidth > CALENDAR_VIEWPORT_GAP;
    const preferredTop = shouldOpenAbove
      ? bounds.top - panelHeight - 8
      : bounds.bottom + 8;
    const preferredLeft = shouldAlignEnd
      ? bounds.right - panelWidth
      : bounds.left;

    setPlacement({
      top: Math.max(
        CALENDAR_VIEWPORT_GAP,
        Math.min(preferredTop, window.innerHeight - panelHeight - CALENDAR_VIEWPORT_GAP),
      ),
      left: Math.max(
        CALENDAR_VIEWPORT_GAP,
        Math.min(preferredLeft, window.innerWidth - panelWidth - CALENDAR_VIEWPORT_GAP),
      ),
      vertical: shouldOpenAbove ? "top" : "bottom",
      horizontal: shouldAlignEnd ? "end" : "start",
    });
  };

  useEffect(() => {
    if (!open) return;

    const frame = window.requestAnimationFrame(updatePlacement);
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, [open, visibleMonth]);

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          updatePlacement();
          if (selectedDate) {
            setVisibleMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
          }
          setOpen((current) => !current);
        }}
        className="flex h-11 w-full min-w-0 items-center gap-2 rounded-xl border border-slate-900/10 bg-white px-3 text-left text-sm shadow-none transition hover:border-teal-500/50 focus-visible:border-teal-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/25 disabled:cursor-not-allowed disabled:opacity-60 md:h-10 dark:border-white/10 dark:bg-black/20 dark:hover:border-teal-300/50"
      >
        <CalendarDays className="size-4 shrink-0 text-teal-600 dark:text-teal-300" />
        <span className={selectedDate ? "truncate" : "truncate text-slate-500 dark:text-white/45"}>
          {selectedDate ? displayFormatter.format(selectedDate) : placeholder}
        </span>
        <ChevronDown className={["ml-auto size-4 shrink-0 text-slate-400 transition-transform", open ? "rotate-180" : ""].join(" ")} />
      </button>

      {open && typeof document !== "undefined" ? createPortal(
        <div
          ref={popoverRef}
          role="dialog"
          aria-label={placeholder}
          className="fixed z-[9999] w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-slate-900/10 bg-white p-3 text-slate-800 shadow-2xl shadow-slate-950/25 ring-1 ring-black/5 dark:border-white/15 dark:bg-[#111719] dark:text-white dark:shadow-black/70 dark:ring-white/10"
          style={{ top: placement.top, left: placement.left }}
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-900/10 pb-3 dark:border-white/10">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-600 dark:text-teal-300">Calendário</p>
              <p className="mt-0.5 text-sm font-semibold capitalize">{formatMonthYear(visibleMonth)}</p>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => moveMonth(-1)} className="inline-flex size-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-900/5 hover:text-teal-600 dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-teal-200" aria-label="Mês anterior">
                <ChevronLeft className="size-4" />
              </button>
              <button type="button" onClick={() => moveMonth(1)} className="inline-flex size-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-900/5 hover:text-teal-600 dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-teal-200" aria-label="Próximo mês">
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-400 dark:text-white/40">
            {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1">
            {calendarDays.map((date, index) => date ? (
              <button
                key={toIsoDate(date)}
                type="button"
                onClick={() => selectDate(date)}
                aria-label={displayFormatter.format(date)}
                aria-pressed={isSameDate(selectedDate, date)}
                className={[
                  "relative flex aspect-square items-center justify-center rounded-lg text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/60",
                  isSameDate(selectedDate, date)
                    ? "bg-teal-500 font-semibold text-white shadow-lg shadow-teal-500/20"
                    : "hover:bg-teal-500/10 hover:text-teal-700 dark:hover:bg-teal-300/10 dark:hover:text-teal-200",
                  isSameDate(null, date) && date.getTime() === today.getTime() ? "ring-1 ring-inset ring-teal-500/60 dark:ring-teal-300/60" : "",
                ].join(" ")}
              >
                {date.getDate()}
              </button>
            ) : <span key={`empty-${index}`} aria-hidden="true" />)}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-slate-900/10 pt-3 dark:border-white/10">
            <button type="button" onClick={() => { onChange(null); setOpen(false); }} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-600 dark:text-white/55 dark:hover:text-rose-300" disabled={!value}>
              <X className="size-3.5" />
              Limpar
            </button>
            <button type="button" onClick={() => { const current = startOfDay(new Date()); setVisibleMonth(new Date(current.getFullYear(), current.getMonth(), 1)); selectDate(current); }} className="rounded-lg bg-teal-500/10 px-3 py-1.5 text-xs font-semibold text-teal-700 transition hover:bg-teal-500/20 dark:text-teal-200">
              Hoje
            </button>
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}

export function DateRangePicker({
  from,
  to,
  onChange,
  placeholder = "Selecionar período",
  compact = false,
}: {
  from?: string | null;
  to?: string | null;
  onChange: (from: string, to: string) => void;
  placeholder?: string;
  compact?: boolean;
}) {
  const fromDate = parseDate(from);
  const toDate = parseDate(to);
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const initialDate = fromDate ?? new Date();
    return new Date(initialDate.getFullYear(), initialDate.getMonth(), 1);
  });
  const [placement, setPlacement] = useState<CalendarPlacement>({
    top: CALENDAR_VIEWPORT_GAP,
    left: CALENDAR_VIEWPORT_GAP,
    vertical: "bottom",
    horizontal: "start",
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !popoverRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const updatePlacement = () => {
    const bounds = rootRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const panelWidth = Math.min(RANGE_PANEL_WIDTH, window.innerWidth - CALENDAR_VIEWPORT_GAP * 2);
    const panelHeight = popoverRef.current?.offsetHeight ?? RANGE_PANEL_HEIGHT;
    const spaceBelow = window.innerHeight - bounds.bottom;
    const spaceAbove = bounds.top;
    const shouldOpenAbove = spaceBelow < RANGE_PANEL_HEIGHT && spaceAbove > spaceBelow;
    const shouldAlignEnd = bounds.left + panelWidth > window.innerWidth - CALENDAR_VIEWPORT_GAP && bounds.right - panelWidth > CALENDAR_VIEWPORT_GAP;
    const preferredTop = shouldOpenAbove ? bounds.top - panelHeight - 8 : bounds.bottom + 8;
    const preferredLeft = shouldAlignEnd ? bounds.right - panelWidth : bounds.left;
    setPlacement({
      top: Math.max(CALENDAR_VIEWPORT_GAP, Math.min(preferredTop, window.innerHeight - panelHeight - CALENDAR_VIEWPORT_GAP)),
      left: Math.max(CALENDAR_VIEWPORT_GAP, Math.min(preferredLeft, window.innerWidth - panelWidth - CALENDAR_VIEWPORT_GAP)),
      vertical: shouldOpenAbove ? "top" : "bottom",
      horizontal: shouldAlignEnd ? "end" : "start",
    });
  };

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(updatePlacement);
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, [open, visibleMonth]);

  const firstWeekday = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1).getDay();
  const daysInMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();
  const calendarDays = Array.from({ length: firstWeekday + daysInMonth }, (_, index) =>
    index < firstWeekday
      ? null
      : new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), index - firstWeekday + 1),
  );
  const today = startOfDay(new Date());
  const moveMonth = (offset: number) => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  const selectDate = (date: Date) => {
    const nextValue = toIsoDate(date);
    if (!fromDate || (fromDate && toDate) || date < fromDate) {
      onChange(nextValue, "");
      return;
    }
    onChange(from ?? nextValue, nextValue);
    setOpen(false);
  };
  const dateLabel = fromDate && toDate
    ? `${displayFormatter.format(fromDate)} – ${displayFormatter.format(toDate)}`
    : fromDate
      ? `${displayFormatter.format(fromDate)} – selecionar fim`
      : placeholder;

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          updatePlacement();
          if (fromDate) setVisibleMonth(new Date(fromDate.getFullYear(), fromDate.getMonth(), 1));
          setOpen((current) => !current);
        }}
        className={[
          "flex h-11 w-full min-w-0 items-center gap-2 rounded-xl border border-slate-900/10 bg-white px-3 text-left text-sm shadow-none transition hover:border-teal-500/50 focus-visible:border-teal-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/25 dark:border-white/10 dark:bg-black/20 dark:hover:border-teal-300/50",
          compact ? "md:h-8 md:text-xs" : "md:h-10",
        ].join(" ")}
      >
        <CalendarDays className="size-4 shrink-0 text-teal-600 dark:text-teal-300" />
        <span className={fromDate ? "truncate" : "truncate text-slate-500 dark:text-white/45"}>{dateLabel}</span>
        <ChevronDown className={["ml-auto size-4 shrink-0 text-slate-400 transition-transform", open ? "rotate-180" : ""].join(" ")} />
      </button>

      {open && typeof document !== "undefined" ? createPortal(
        <div
          ref={popoverRef}
          role="dialog"
          aria-label={placeholder}
          className="fixed z-[9999] max-h-[calc(100dvh-1rem)] w-[min(18rem,calc(100vw-1rem))] overflow-y-auto rounded-2xl border border-slate-900/10 bg-white p-2 text-slate-800 shadow-2xl shadow-slate-950/25 ring-1 ring-black/5 dark:border-white/15 dark:bg-[#111719] dark:text-white dark:shadow-black/70"
          style={{ top: placement.top, left: placement.left }}
        >
          <div className="flex items-center justify-between gap-1.5 border-b border-slate-900/10 pb-2 dark:border-white/10">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-600 dark:text-teal-300">Período</p>
              <p className="mt-0.5 text-xs font-semibold capitalize">{formatMonthYear(visibleMonth)}</p>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-white/45">{fromDate && !toDate ? "Agora selecione o fim" : "Selecione o início"}</p>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => moveMonth(-1)} className="inline-flex size-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-900/5 hover:text-teal-600 dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-teal-200" aria-label="Mês anterior"><ChevronLeft className="size-4" /></button>
              <button type="button" onClick={() => moveMonth(1)} className="inline-flex size-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-900/5 hover:text-teal-600 dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-teal-200" aria-label="Próximo mês"><ChevronRight className="size-4" /></button>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-7 gap-0.5 text-center text-[10px] font-semibold text-slate-400 dark:text-white/40">{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
          <div className="mt-1 grid grid-cols-7 gap-0.5">
            {calendarDays.map((date, index) => {
              if (!date) return <span key={`empty-${index}`} aria-hidden="true" />;
              const isStart = isSameDate(fromDate, date);
              const isEnd = isSameDate(toDate, date);
              const isBetween = Boolean(fromDate && toDate && date > fromDate && date < toDate);
              const isToday = date.getTime() === today.getTime();
              return (
                <button
                  key={toIsoDate(date)}
                  type="button"
                  onClick={() => selectDate(date)}
                  aria-label={displayFormatter.format(date)}
                  className={["relative flex aspect-square items-center justify-center rounded-md text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/60", isStart || isEnd ? "bg-teal-500 font-semibold text-white shadow-lg shadow-teal-500/20" : isBetween ? "bg-teal-500/15 text-teal-800 dark:bg-teal-300/15 dark:text-teal-100" : "hover:bg-teal-500/10 hover:text-teal-700 dark:hover:bg-teal-300/10 dark:hover:text-teal-200", isToday && !isStart && !isEnd ? "ring-1 ring-inset ring-teal-500/60 dark:ring-teal-300/60" : ""].join(" ")}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-slate-900/10 pt-2 dark:border-white/10">
            <button type="button" onClick={() => { onChange("", ""); setOpen(false); }} disabled={!from && !to} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-600 disabled:opacity-40 dark:text-white/55 dark:hover:text-rose-300"><X className="size-3.5" />Limpar</button>
            <button type="button" onClick={() => { const current = startOfDay(new Date()); const value = toIsoDate(current); onChange(value, value); setVisibleMonth(new Date(current.getFullYear(), current.getMonth(), 1)); setOpen(false); }} className="rounded-lg bg-teal-500/10 px-3 py-1.5 text-xs font-semibold text-teal-700 transition hover:bg-teal-500/20 dark:text-teal-200">Hoje</button>
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
