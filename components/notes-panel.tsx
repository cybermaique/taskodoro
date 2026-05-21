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
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
        active
          ? "bg-violet-500 text-white"
          : "bg-violet-100 text-violet-700 hover:bg-violet-200 dark:bg-violet-900/40 dark:text-violet-300 dark:hover:bg-violet-800/60",
        onClick ? "cursor-pointer" : "cursor-default",
      ].join(" ")}
    >
      <Hash className="size-3 shrink-0" />
      {tag.replace(/^#/, "")}
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
        "group relative rounded-2xl border bg-white/70 p-4 shadow-sm backdrop-blur transition-shadow hover:shadow-md",
        "dark:bg-white/[0.05] dark:border-white/10",
        deleting ? "opacity-50 pointer-events-none" : "",
      ].join(" ")}
    >
      {/* actions */}
      <div className="absolute right-3 top-3 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {!editing && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white"
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
          className="size-7 rounded-xl text-slate-400 hover:text-red-500"
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
            className="min-h-[80px] resize-none rounded-xl border-violet-300 bg-white text-sm focus-visible:ring-violet-400 dark:bg-white/10 dark:border-white/20"
            rows={3}
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="h-7 rounded-full bg-violet-600 px-3 text-xs text-white hover:bg-violet-700"
              onClick={handleSave}
              disabled={saving || !draft.trim()}
            >
              {saving ? "Salvando…" : "Salvar"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 rounded-full px-3 text-xs"
              onClick={() => {
                setEditing(false);
                setDraft(note.content);
              }}
            >
              Cancelar
            </Button>
            <span className="ml-auto text-xs text-slate-400">
              Ctrl+Enter para salvar · Esc para cancelar
            </span>
          </div>
        </div>
      ) : (
        <p
          className="whitespace-pre-wrap break-words pr-10 text-sm leading-relaxed text-slate-800 dark:text-white/85"
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
          <div className="ml-auto flex items-center gap-1 text-xs text-slate-400 dark:text-white/35">
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
    <div className="space-y-5">
      {/* compose */}
      <div className="rounded-2xl border border-slate-900/10 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/[0.05]">
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
          className="min-h-[80px] resize-none rounded-xl border-slate-200 bg-white/50 text-sm leading-relaxed focus-visible:ring-violet-400 dark:border-white/10 dark:bg-white/10"
          rows={3}
        />
        <div className="mt-2 flex items-center gap-2">
          <Button
            size="sm"
            className="h-8 gap-1.5 rounded-full bg-violet-600 px-4 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
            onClick={handleCreate}
            disabled={submitting || !draft.trim()}
          >
            <Plus className="size-3.5" />
            {submitting ? "Salvando…" : "Salvar anotação"}
          </Button>
          {draft.trim() && (
            <span className="text-xs text-slate-400">
              Ctrl+Enter para salvar
            </span>
          )}
          {draft.trim() && (
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto h-7 rounded-full px-3 text-xs"
              onClick={() => setDraft("")}
            >
              <X className="size-3" />
              Limpar
            </Button>
          )}
        </div>
        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
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
              className="h-9 rounded-full border-slate-200 bg-white/70 pl-9 text-sm backdrop-blur dark:border-white/10 dark:bg-white/10"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          {allTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
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
                  className="ml-1 text-xs text-slate-400 underline hover:text-slate-600"
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
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 py-14 text-center dark:border-white/15">
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
