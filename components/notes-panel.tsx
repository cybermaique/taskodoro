"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Clock,
  Hash,
  Pencil,
  Plus,
  Search,
  StickyNote,
  Tag,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import type { Note } from "@/types/note";

/* ── helpers ───────────────────────────────────────────── */

function formatRelative(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "agora mesmo";
  if (diff < 3600) return `há ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
  if (diff < 86400 * 7) return `há ${Math.floor(diff / 86400)}d`;
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

/* parse #tags out of note content */
function extractHashtags(content: string): string[] {
  const matches = content.match(/#[\w\u00C0-\u024F]+/g) ?? [];
  return [...new Set(matches.map((t) => t.toLowerCase()))];
}

/* ── sub-components ────────────────────────────────────── */

interface TagChipProps {
  tag: string;
  active?: boolean;
  onClick?: () => void;
}

function TagChip({ tag, active, onClick }: TagChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex min-h-11 max-w-full items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors sm:min-h-0 sm:px-2.5 sm:py-0.5",
        active
          ? "bg-violet-500 text-white"
          : "bg-violet-100 text-violet-700 hover:bg-violet-200 dark:bg-violet-900/40 dark:text-violet-300 dark:hover:bg-violet-800/60",
        onClick ? "cursor-pointer" : "cursor-default",
      ].join(" ")}
    >
      <Hash className="size-3 shrink-0" />
      <span className="truncate">{tag.replace(/^#/, "")}</span>
    </button>
  );
}

interface NoteCardProps {
  note: Note;
  onUpdate: (id: string, content: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onTagClick: (tag: string) => void;
  activeTag: string | null;
}

function NoteCard({
  note,
  onUpdate,
  onDelete,
  onTagClick,
  activeTag,
}: NoteCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.content);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [editing]);

  /* auto-grow textarea */
  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [draft, editing]);

  const tags = extractHashtags(note.content);

  const handleSave = async () => {
    if (draft.trim() === note.content || !draft.trim()) {
      setEditing(false);
      setDraft(note.content);
      return;
    }
    setSaving(true);
    try {
      await onUpdate(note.id, draft.trim());
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      setEditing(false);
      setDraft(note.content);
    }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(note.id);
    } finally {
      setDeleting(false);
    }
  };

  /* highlight #tags inside content */
  function renderContent(text: string) {
    const parts = text.split(/(#[\w\u00C0-\u024F]+)/g);
    return parts.map((part, i) => {
      if (/^#[\w\u00C0-\u024F]+$/.test(part)) {
        const isActive = activeTag === part.toLowerCase();
        return (
          <span
            key={i}
            onClick={() => onTagClick(part.toLowerCase())}
            className={[
              "cursor-pointer font-semibold transition-colors",
              isActive
                ? "text-violet-600 dark:text-violet-400"
                : "text-violet-500 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300",
            ].join(" ")}
          >
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  }

  return (
    <div
      className={[
        "group relative min-w-0 rounded-2xl border bg-white/70 p-3 shadow-sm backdrop-blur transition-shadow hover:shadow-md sm:p-4",
        "dark:bg-white/[0.05] dark:border-white/10",
        deleting ? "opacity-50 pointer-events-none" : "",
      ].join(" ")}
    >
      {/* actions */}
      <div className="-mr-1 -mt-1 mb-1 flex items-center justify-end gap-1 opacity-100 transition-opacity sm:absolute sm:right-3 sm:top-3 sm:m-0 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
        {!editing && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-11 rounded-xl text-slate-500 hover:text-slate-700 sm:size-7 sm:text-slate-400 dark:hover:text-white"
            aria-label="Editar anotação"
            title="Editar anotação"
            onClick={() => {
              setDraft(note.content);
              setEditing(true);
            }}
          >
            <Pencil className="size-3.5" />
          </Button>
        )}
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-11 rounded-xl text-slate-500 hover:text-red-500 sm:size-7 sm:text-slate-400"
          aria-label="Excluir anotação"
          title="Excluir anotação"
          onClick={handleDelete}
          disabled={deleting}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      {/* body */}
      {editing ? (
        <div className="space-y-2">
          <Textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            className="min-h-24 resize-none rounded-xl border-violet-300 bg-white text-base focus-visible:ring-violet-400 sm:min-h-[80px] sm:text-sm dark:bg-white/10 dark:border-white/20"
            rows={3}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              className="h-11 flex-1 rounded-full bg-violet-600 px-4 text-sm text-white hover:bg-violet-700 sm:h-7 sm:flex-none sm:px-3 sm:text-xs"
              onClick={handleSave}
              disabled={saving || !draft.trim()}
            >
              {saving ? "Salvando…" : "Salvar"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-11 flex-1 rounded-full px-4 text-sm sm:h-7 sm:flex-none sm:px-3 sm:text-xs"
              onClick={() => {
                setEditing(false);
                setDraft(note.content);
              }}
            >
              Cancelar
            </Button>
            <span className="ml-auto hidden text-xs text-slate-400 sm:inline">
              Ctrl+Enter para salvar · Esc para cancelar
            </span>
          </div>
        </div>
      ) : (
        <p
          className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800 [overflow-wrap:anywhere] sm:pr-10 dark:text-white/85"
          onDoubleClick={() => {
            setDraft(note.content);
            setEditing(true);
          }}
        >
          {renderContent(note.content)}
        </p>
      )}

      {/* footer */}
      {!editing && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {tags.length > 0 && (
            <>
              {tags.map((tag) => (
                <TagChip
                  key={tag}
                  tag={tag}
                  active={activeTag === tag}
                  onClick={() => onTagClick(tag)}
                />
              ))}
            </>
          )}
          <div className="flex w-full items-center justify-end gap-1 text-xs text-slate-400 sm:ml-auto sm:w-auto dark:text-white/35">
            <Clock className="size-3" />
            <span>{formatRelative(note.updated_at)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── main panel ────────────────────────────────────────── */

interface NotesPanelProps {
  initialNotes: Note[];
}

export function NotesPanel({ initialNotes }: NotesPanelProps) {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* auto-grow compose textarea */
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [draft]);

  /* all unique tags across all notes */
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    notes.forEach((n) =>
      extractHashtags(n.content).forEach((t) => tagSet.add(t)),
    );
    return Array.from(tagSet).sort();
  }, [notes]);

  /* filtered notes */
  const filtered = useMemo(() => {
    let result = notes;
    if (activeTag) {
      result = result.filter((n) =>
        extractHashtags(n.content).includes(activeTag),
      );
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((n) => n.content.toLowerCase().includes(q));
    }
    return result;
  }, [notes, activeTag, search]);

  const handleCreate = async () => {
    const content = draft.trim();
    if (!content) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = (await res.json()) as { note?: Note; error?: string };
      if (!res.ok || !data.note)
        throw new Error(data.error ?? "Erro ao salvar.");
      setNotes((prev) => [data.note as Note, ...prev]);
      setDraft("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar anotação.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = useCallback(async (id: string, content: string) => {
    const res = await fetch(`/api/notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    const data = (await res.json()) as { note?: Note; error?: string };
    if (!res.ok || !data.note)
      throw new Error(data.error ?? "Erro ao atualizar.");
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? (data.note as Note) : n)),
    );
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      throw new Error(data.error ?? "Erro ao excluir.");
    }
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const handleTagClick = useCallback((tag: string) => {
    setActiveTag((prev) => (prev === tag ? null : tag));
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleCreate();
    }
  };

  return (
    <div className="min-w-0 space-y-4 sm:space-y-5">
      {/* compose */}
      <div className="min-w-0 rounded-2xl border border-slate-900/10 bg-white/70 p-3 shadow-sm backdrop-blur sm:p-4 dark:border-white/10 dark:bg-white/[0.05]">
        <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase text-slate-500 dark:text-white/40">
          <StickyNote className="size-3.5" />
          Nova anotação
        </div>
        <Textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Anote qualquer coisa… use #tags para organizar. Ex: Marcilio perguntou sobre #feature-flag da coluna discrepância."
          className="min-h-24 resize-none rounded-xl border-slate-200 bg-white/50 text-base leading-relaxed focus-visible:ring-violet-400 sm:min-h-[80px] sm:text-sm dark:border-white/10 dark:bg-white/10"
          rows={3}
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            className="h-11 min-w-0 flex-1 gap-1.5 rounded-full bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 sm:h-8 sm:flex-none sm:text-xs"
            onClick={handleCreate}
            disabled={submitting || !draft.trim()}
          >
            <Plus className="size-3.5" />
            {submitting ? "Salvando…" : "Salvar anotação"}
          </Button>
          {draft.trim() && (
            <span className="hidden text-xs text-slate-400 sm:inline">
              Ctrl+Enter para salvar
            </span>
          )}
          {draft.trim() && (
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto h-11 rounded-full px-4 text-sm sm:h-7 sm:px-3 sm:text-xs"
              onClick={() => setDraft("")}
            >
              <X className="size-3" />
              Limpar
            </Button>
          )}
        </div>
        {error && (
          <p className="mt-2 break-words text-xs text-red-500 [overflow-wrap:anywhere]">
            {error}
          </p>
        )}
      </div>

      {/* search + tag filters */}
      {notes.length > 0 && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar anotações…"
              className="h-11 rounded-full border-slate-200 bg-white/70 pl-9 pr-12 text-base backdrop-blur sm:h-9 sm:pr-10 sm:text-sm dark:border-white/10 dark:bg-white/10"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-0 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:text-slate-600 sm:right-1 sm:size-9"
                aria-label="Limpar busca"
                title="Limpar busca"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          {allTags.length > 0 && (
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <Tag className="size-3.5 shrink-0 text-slate-400" />
              {allTags.map((tag) => (
                <TagChip
                  key={tag}
                  tag={tag}
                  active={activeTag === tag}
                  onClick={() => handleTagClick(tag)}
                />
              ))}
              {activeTag && (
                <button
                  type="button"
                  onClick={() => setActiveTag(null)}
                  className="ml-1 inline-flex min-h-11 items-center text-xs text-slate-400 underline hover:text-slate-600 sm:min-h-0"
                >
                  limpar filtro
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* notes list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center sm:py-14 dark:border-white/15">
          <StickyNote className="size-8 text-slate-300 dark:text-white/20" />
          <p className="text-sm text-slate-500 dark:text-white/40">
            {notes.length === 0
              ? "Nenhuma anotação ainda. Escreva algo acima!"
              : "Nenhuma anotação encontrada para este filtro."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {search || activeTag ? (
            <p className="text-xs text-slate-400 dark:text-white/35">
              {filtered.length} anotaç{filtered.length === 1 ? "ão" : "ões"}{" "}
              encontrada{filtered.length === 1 ? "" : "s"}
            </p>
          ) : null}
          {filtered.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onTagClick={handleTagClick}
              activeTag={activeTag}
            />
          ))}
        </div>
      )}
    </div>
  );
}
