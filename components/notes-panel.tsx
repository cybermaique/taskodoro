"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Braces,
  CalendarDays,
  Clock,
  Copy,
  Hash,
  Maximize2,
  Pencil,
  Pin,
  Plus,
  Search,
  StickyNote,
  Tag,
  Trash2,
  X,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  ContextMenu,
  type ContextMenuAction,
} from "@/components/ui/context-menu";
import { useToast } from "@/components/ui/toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import type { Note } from "@/types/note";

/* ── helpers ───────────────────────────────────────────── */

const NOTE_PREVIEW_MAX_CHARACTERS = 600;
const NOTE_PREVIEW_MAX_LINES = 8;

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function hasBeenUpdated(note: Note) {
  return (
    new Date(note.updated_at).getTime() !== new Date(note.created_at).getTime()
  );
}

function formatJsonIfValid(content: string) {
  try {
    const value: unknown = JSON.parse(content);
    return JSON.stringify(value, null, 2);
  } catch {
    return null;
  }
}

function getJsonSummary(content: string) {
  const value: unknown = JSON.parse(content);
  if (Array.isArray(value)) return `JSON · ${value.length} itens`;
  if (value && typeof value === "object")
    return `JSON · ${Object.keys(value).length} campos`;
  return "JSON";
}

type NoteContentBlock =
  | { type: "text"; content: string }
  | { type: "code"; content: string; language: "code" | "json" };

type CodeBlockLanguage = "code" | "json";

function expandSlashCodeCommand(
  value: string,
  selectionStart: number,
  selectionEnd: number,
) {
  const beforeSelection = value.slice(0, selectionStart);
  const commandMatch = /\/(code|json)$/.exec(beforeSelection);
  if (
    !commandMatch ||
    (commandMatch.index > 0 && beforeSelection[commandMatch.index - 1] !== "\n")
  ) {
    return null;
  }

  const language = commandMatch[1] as CodeBlockLanguage;
  const block = `\`\`\`${language}\n\n\`\`\``;
  const prefix = value.slice(0, commandMatch.index);
  const suffix = value.slice(selectionEnd);

  return {
    value: `${prefix}${block}${suffix}`,
    caretPosition: prefix.length + language.length + 4,
  };
}

function parseNoteContent(content: string): NoteContentBlock[] {
  const blocks: NoteContentBlock[] = [];
  const codeBlockPattern = /```(json|code)?[ \t]*\r?\n([\s\S]*?)```/gi;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockPattern.exec(content))) {
    const text = content.slice(cursor, match.index).trim();
    if (text) blocks.push({ type: "text", content: text });

    blocks.push({
      type: "code",
      language: match[1]?.toLowerCase() === "json" ? "json" : "code",
      content: match[2].trim(),
    });
    cursor = match.index + match[0].length;
  }

  const remainingText = content.slice(cursor).trim();
  if (remainingText) blocks.push({ type: "text", content: remainingText });

  return blocks.length > 0 ? blocks : [{ type: "text", content }];
}

function getCopyableNoteContent(content: string) {
  return content
    .replace(/```[^\r\n]*\r?\n([\s\S]*?)```/g, "$1")
    .trim();
}

function getPreview(content: string) {
  const lines = content.split(/\r?\n/);
  const linePreview = lines.slice(0, NOTE_PREVIEW_MAX_LINES).join("\n");
  const preview = linePreview.slice(0, NOTE_PREVIEW_MAX_CHARACTERS).trimEnd();
  return {
    content: preview,
    isTruncated: preview.length < content.length,
  };
}

function isCreatedWithinRange(note: Note, from: string, to: string) {
  const createdAt = new Date(note.created_at).getTime();

  if (from && createdAt < new Date(`${from}T00:00:00`).getTime()) {
    return false;
  }

  if (to && createdAt >= new Date(`${to}T00:00:00`).getTime() + 86_400_000) {
    return false;
  }

  return true;
}

function isNoteCardControl(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      "button, a, input, textarea, select, label, summary, details",
    ),
  );
}

function splitUrlTrailingPunctuation(value: string) {
  const match = /[.,;:!?\])}]+$/.exec(value);
  if (!match) return { url: value, trailingPunctuation: "" };

  return {
    url: value.slice(0, -match[0].length),
    trailingPunctuation: match[0],
  };
}

function normalizeShortcutUrl(value: string) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function CodeBlock({
  label,
  content,
  collapsible = false,
}: {
  label: string;
  content: string;
  collapsible?: boolean;
}) {
  const lineCount = content.split(/\r?\n/).length;
  const body = (
    <pre className="overflow-auto border-t border-white/10 p-3 font-mono text-xs leading-relaxed text-slate-100 [overflow-wrap:anywhere]">
      {content}
    </pre>
  );

  if (collapsible) {
    return (
      <details className="group/code rounded-xl border border-slate-700 bg-slate-950 text-slate-100 dark:border-white/10">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
          <Braces className="size-4 text-violet-300" />
          <span>{label}</span>
          <span className="text-xs font-normal text-slate-400">
            · {lineCount} linhas
          </span>
          <span className="ml-auto text-xs font-normal text-slate-400 group-open/code:hidden">
            Expandir
          </span>
          <span className="ml-auto hidden text-xs font-normal text-slate-400 group-open/code:inline">
            Recolher
          </span>
        </summary>
        <div className="max-h-80 overflow-auto">{body}</div>
      </details>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-700 bg-slate-950 text-slate-100 dark:border-white/10">
      <div className="flex min-h-10 items-center gap-2 px-3 text-xs font-medium text-slate-300">
        <Braces className="size-3.5 text-violet-300" />
        <span>{label}</span>
        <span className="text-slate-500">· {lineCount} linhas</span>
      </div>
      <div className="max-h-[min(65svh,42rem)] overflow-auto">{body}</div>
    </section>
  );
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
  onUpdate: (id: string, title: string, content: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onTogglePinned: (id: string, isPinned: boolean) => Promise<void>;
  onTagClick: (tag: string) => void;
  activeTag: string | null;
  isPinning: boolean;
  openViewerRequest: boolean;
  onOpenViewerRequestHandled: () => void;
  editRequest: boolean;
  onEditRequestHandled: () => void;
  deleteRequest: boolean;
  onDeleteRequestHandled: () => void;
  isNewlyCreated?: boolean;
  onOpenContextMenu: (x: number, y: number) => void;
}

function NoteCard({
  note,
  onUpdate,
  onDelete,
  onTogglePinned,
  onTagClick,
  activeTag,
  isPinning,
  openViewerRequest,
  onOpenViewerRequestHandled,
  editRequest,
  onEditRequestHandled,
  deleteRequest,
  onDeleteRequestHandled,
  isNewlyCreated = false,
  onOpenContextMenu,
}: NoteCardProps) {
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(note.title);
  const [draft, setDraft] = useState(note.content);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isEditing = editing && !viewerOpen;

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

  useEffect(() => {
    if (!editRequest) return;
    const frame = window.requestAnimationFrame(() => {
      setDraftTitle(note.title);
      setDraft(note.content);
      setEditing(true);
      setViewerOpen(true);
      onEditRequestHandled();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [editRequest, note.content, note.title, onEditRequestHandled]);

  const tags = extractHashtags(note.content);
  const contentBlocks = useMemo(
    () => parseNoteContent(note.content),
    [note.content],
  );
  const contentLineCount = note.content.split(/\r?\n/).length;
  const containsCodeBlock = contentBlocks.some((block) => block.type === "code");
  const useFullscreenViewer =
    note.content.length > 1600 || contentLineCount > 30;
  const viewerWidthClass =
    containsCodeBlock || note.content.length > 900 || contentLineCount > 18
      ? "sm:w-[min(92vw,72rem)] sm:max-w-[72rem]"
      : note.content.length > 420 || contentLineCount > 9
        ? "sm:w-[min(88vw,54rem)] sm:max-w-[54rem]"
        : "sm:w-[min(82vw,42rem)] sm:max-w-[42rem]";

  const handleSave = async () => {
    if (
      !draftTitle.trim() ||
      !draft.trim() ||
      (draftTitle.trim() === note.title && draft.trim() === note.content)
    ) {
      setEditing(false);
      setViewerOpen(false);
      onEditRequestHandled();
      setDraftTitle(note.title);
      setDraft(note.content);
      return;
    }
    setSaving(true);
    try {
      await onUpdate(note.id, draftTitle.trim(), draft.trim());
    } finally {
      setSaving(false);
      setEditing(false);
      setViewerOpen(false);
      onEditRequestHandled();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      setEditing(false);
      setViewerOpen(false);
      onEditRequestHandled();
      setDraftTitle(note.title);
      setDraft(note.content);
    }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    }
  };

  const handleEditDraftChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    const expansion = expandSlashCodeCommand(
      event.target.value,
      event.target.selectionStart,
      event.target.selectionEnd,
    );

    if (!expansion) {
      setDraft(event.target.value);
      return;
    }

    setDraft(expansion.value);
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(
        expansion.caretPosition,
        expansion.caretPosition,
      );
    });
  };

  const handleDelete = async () => {
    setConfirmDeleteOpen(false);
    onDeleteRequestHandled();
    setDeleting(true);
    try {
      await onDelete(note.id);
    } finally {
      setDeleting(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(getCopyableNoteContent(note.content));
    setCopied(true);
  };

  const handleCardClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isNoteCardControl(event.target)) return;
    setViewerOpen(true);
  };

  const closeViewer = () => {
    setViewerOpen(false);
    onOpenViewerRequestHandled();
  };

  const startEditingFromViewer = () => {
    setDraftTitle(note.title);
    setDraft(note.content);
    setEditing(true);
    setViewerOpen(true);
  };

  const requestDeleteFromViewer = () => {
    closeViewer();
    setConfirmDeleteOpen(true);
  };

  /* highlight #tags inside content */
  function renderContent(text: string) {
    const renderPlainContent = (value: string, keyPrefix: string) => {
      const parts = value.split(
        /(https?:\/\/[^\s<>"']+|#[\w\u00C0-\u024F]+)/g,
      );

      return parts.map((part, index) => {
        const key = `${keyPrefix}-${index}`;
        if (/^https?:\/\//i.test(part)) {
          const { url, trailingPunctuation } =
            splitUrlTrailingPunctuation(part);
          return (
            <span key={key}>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => event.stopPropagation()}
                className="font-medium text-violet-600 underline decoration-violet-400/60 underline-offset-2 hover:text-violet-700 dark:text-violet-300 dark:hover:text-violet-200"
              >
                {url}
              </a>
              {trailingPunctuation}
            </span>
          );
        }

        if (/^#[\w\u00C0-\u024F]+$/.test(part)) {
          const isActive = activeTag === part.toLowerCase();
          return (
            <span
              key={key}
              onClick={(event) => {
                event.stopPropagation();
                onTagClick(part.toLowerCase());
              }}
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
        return <span key={key}>{part}</span>;
      });
    };

    const shortcutPattern = /(^|\n)([^<>\n]+?)\s*>\s*((?:https?:\/\/|www\.)?[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+(?:[/?#][^\s<>]*)?)(?=\s|$)/gim;
    const rendered: ReactNode[] = [];
    let cursor = 0;
    let match: RegExpExecArray | null;
    let shortcutIndex = 0;

    while ((match = shortcutPattern.exec(text))) {
      const leadingLength = match[1]?.length ?? 0;
      const labelStart = match.index + leadingLength;
      const prefix = text.slice(cursor, labelStart);
      if (prefix) {
        rendered.push(
          <Fragment key={`shortcut-prefix-${shortcutIndex}`}>
            {renderPlainContent(prefix, `shortcut-prefix-${shortcutIndex}`)}
          </Fragment>,
        );
      }

      const label = match[2].trim();
      const { url, trailingPunctuation } = splitUrlTrailingPunctuation(
        match[3],
      );
      rendered.push(
        <span key={`shortcut-${shortcutIndex}`}>
          <a
            href={normalizeShortcutUrl(url)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="font-medium text-violet-600 underline decoration-violet-400/60 underline-offset-2 hover:text-violet-700 dark:text-violet-300 dark:hover:text-violet-200"
          >
            {label}
          </a>
          {trailingPunctuation}
        </span>,
      );
      cursor = shortcutPattern.lastIndex;
      shortcutIndex += 1;
    }

    const remaining = text.slice(cursor);
    if (remaining || rendered.length === 0) {
      rendered.push(
        <Fragment key="shortcut-remaining">
          {renderPlainContent(remaining, "shortcut-remaining")}
        </Fragment>,
      );
    }

    return rendered;
  }

  function renderNoteContent(full = false) {
    return contentBlocks.map((block, index) => {
      if (block.type === "code") {
        const formattedJson =
          block.language === "json" ? formatJsonIfValid(block.content) : null;
        const codeContent = formattedJson ?? block.content;
        const label =
          block.language === "json"
            ? formattedJson
              ? getJsonSummary(formattedJson)
              : "JSON inválido"
            : "Código";

        return (
          <CodeBlock
            key={`${block.language}-${index}`}
            label={label}
            content={codeContent}
            collapsible={!full}
          />
        );
      }

      const textPreview = full
        ? { content: block.content, isTruncated: false }
        : getPreview(block.content);

      return (
        <div key={`text-${index}`} className="space-y-3">
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800 [overflow-wrap:anywhere] dark:text-white/85">
            {renderContent(textPreview.content)}
            {textPreview.isTruncated ? "…" : null}
          </p>
          {textPreview.isTruncated ? (
            <div className="flex min-h-11 flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-800 dark:border-violet-400/25 dark:bg-violet-400/10 dark:text-violet-200">
              <Maximize2 className="size-3.5 shrink-0" />
              <span className="font-medium">Conteúdo resumido</span>
              <span className="text-violet-700/75 dark:text-violet-200/70">
                {contentLineCount} linhas
              </span>
              <span className="sm:ml-auto">Clique para abrir completo</span>
            </div>
          ) : null}
        </div>
      );
    });
  }

  return (
    <div
      className={[
        "app-note-card app-list-item-enter dashboard-reveal-card group relative min-w-0 rounded-2xl border bg-white/70 p-3 shadow-sm backdrop-blur transition-[border-color,box-shadow] hover:shadow-md sm:p-4",
        "dark:bg-white/[0.05] dark:border-white/10",
        isEditing ? "" : "cursor-pointer",
        isNewlyCreated ? "note-card-created" : "",
        deleting ? "note-card-deleting pointer-events-none" : "",
      ].join(" ")}
      onClick={handleCardClick}
      onContextMenu={(event) => {
        if (
          event.target instanceof Element &&
          event.target.closest(
            "input, textarea, select, [contenteditable='true']",
          )
        ) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        onOpenContextMenu(event.clientX, event.clientY);
      }}
    >
      {/* actions */}
      <div className="-mr-1 -mt-1 mb-1 flex items-center justify-end gap-1 opacity-100 transition-opacity sm:absolute sm:right-3 sm:top-3 sm:m-0 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
        {!editing && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-11 rounded-xl text-slate-500 hover:text-slate-700 sm:size-7 sm:text-slate-400 dark:hover:text-white"
            aria-label={copied ? "Anotação copiada" : "Copiar anotação"}
            title={copied ? "Copiado" : "Copiar anotação"}
            onClick={handleCopy}
          >
            <Copy className="size-3.5" />
          </Button>
        )}
        {!editing && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-11 rounded-xl text-slate-500 hover:text-slate-700 sm:size-7 sm:text-slate-400 dark:hover:text-white"
            aria-label="Editar anotação"
            title="Editar anotação"
            onClick={startEditingFromViewer}
          >
            <Pencil className="size-3.5" />
          </Button>
        )}
        {!editing && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className={[
              "size-11 rounded-xl sm:size-7",
              note.is_pinned
                ? "text-violet-500 hover:text-violet-700 dark:text-violet-300 dark:hover:text-violet-200"
                : "text-slate-500 hover:text-violet-600 sm:text-slate-400 dark:hover:text-violet-300",
            ].join(" ")}
            aria-label={
              note.is_pinned
                ? "Desafixar anota\u00e7\u00e3o"
                : "Fixar anota\u00e7\u00e3o"
            }
            title={note.is_pinned ? "Desafixar" : "Fixar"}
            onClick={() => onTogglePinned(note.id, !note.is_pinned)}
            disabled={isPinning}
          >
            {isPinning ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Pin
                className={
                  note.is_pinned ? "size-3.5 fill-current" : "size-3.5"
                }
              />
            )}
          </Button>
        )}
        {!editing && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-11 rounded-xl text-slate-500 hover:text-red-500 sm:size-7 sm:text-slate-400"
            aria-label="Excluir anotação"
            title="Excluir anotação"
            onClick={() => setConfirmDeleteOpen(true)}
            disabled={deleting}
          >
            <Trash2 className="size-3.5" />
          </Button>
        )}
      </div>

      {/* body */}
      {isEditing ? (
        <div className="space-y-2">
          <Input
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            disabled={saving}
            maxLength={160}
            placeholder="Título da anotação"
            className="h-11 rounded-xl border-violet-300 bg-white text-base font-semibold focus-visible:ring-violet-400 sm:h-9 sm:text-sm dark:bg-white/10 dark:border-white/20 disabled:opacity-60"
          />
          <Textarea
            ref={textareaRef}
            value={draft}
            disabled={saving}
            onChange={handleEditDraftChange}
            onKeyDown={handleKeyDown}
            className="min-h-24 resize-none rounded-xl border-violet-300 bg-white text-base focus-visible:ring-violet-400 sm:min-h-[80px] sm:text-sm dark:bg-white/10 dark:border-white/20 disabled:opacity-60"
            rows={3}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              className="h-11 flex-1 gap-1.5 rounded-full bg-violet-600 px-4 text-sm text-white hover:bg-violet-700 sm:h-7 sm:flex-none sm:px-3 sm:text-xs"
              onClick={handleSave}
              disabled={saving || !draftTitle.trim() || !draft.trim()}
            >
              {saving ? (
                <>
                  <Loader2 className="size-3 animate-spin" />
                  Salvando…
                </>
              ) : (
                "Salvar"
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-11 flex-1 rounded-full px-4 text-sm sm:h-7 sm:flex-none sm:px-3 sm:text-xs"
              disabled={saving}
              onClick={() => {
                setEditing(false);
                onEditRequestHandled();
                setDraftTitle(note.title);
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
        <div className="min-w-0 sm:pr-10">
          <div className="mb-3 min-w-0 space-y-1">
            <h3 className="truncate text-base font-semibold text-slate-900 dark:text-white">
              {renderContent(note.title)}
            </h3>
            <div className="flex flex-wrap items-center gap-1 text-xs text-slate-400 dark:text-white/35">
              <Clock className="size-3" />
              <span>Criada em {formatDateTime(note.created_at)}</span>
              {hasBeenUpdated(note) && (
                <span
                  title={`Atualizada em ${formatDateTime(note.updated_at)}`}
                >
                  · Atualizada em {formatDateTime(note.updated_at)}
                </span>
              )}
            </div>
          </div>
          <div className="space-y-3">{renderNoteContent()}</div>
        </div>
      )}

      {!isEditing && tags.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {tags.map((tag) => (
            <TagChip
              key={tag}
              tag={tag}
              active={activeTag === tag}
              onClick={() => onTagClick(tag)}
            />
          ))}
        </div>
      ) : null}

      <Dialog
        open={viewerOpen || openViewerRequest}
        onOpenChange={(open) => {
          setViewerOpen(open);
          if (!open) {
            setEditing(false);
            setDraftTitle(note.title);
            setDraft(note.content);
          }
          if (!open) onOpenViewerRequestHandled();
        }}
        disablePointerDismissal
      >
        <DialogContent
          onBackdropClick={() => {
            setViewerOpen(false);
            setEditing(false);
            setDraftTitle(note.title);
            setDraft(note.content);
            onOpenViewerRequestHandled();
          }}
          className={[
            "grid grid-rows-[auto_minmax(0,1fr)] gap-3 bg-white dark:bg-zinc-950",
            useFullscreenViewer
              ? "h-[100svh] w-screen max-w-none rounded-none p-4 sm:w-screen sm:max-w-none sm:p-6"
              : `max-h-[min(92svh,56rem)] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] overflow-hidden p-4 sm:p-6 ${viewerWidthClass}`,
          ].join(" ")}
        >
          <div className="flex min-w-0 items-start gap-3 pr-8">
            <div className="min-w-0">
              <DialogTitle>
                {editing ? "Editar anotação" : note.title}
              </DialogTitle>
              <DialogDescription className="mt-1">
                Criada em {formatDateTime(note.created_at)}
                {hasBeenUpdated(note)
                  ? ` · Atualizada em ${formatDateTime(note.updated_at)}`
                  : ""}
              </DialogDescription>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={copied ? "Anotação copiada" : "Copiar anotação"}
                title={copied ? "Copiado" : "Copiar anotação"}
                onClick={handleCopy}
              >
                <Copy className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Editar anotação"
                title="Editar anotação"
                onClick={startEditingFromViewer}
                className={editing ? "hidden" : ""}
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={note.is_pinned ? "Desafixar anotação" : "Fixar anotação"}
                title={note.is_pinned ? "Desafixar anotação" : "Fixar anotação"}
                onClick={() => void onTogglePinned(note.id, !note.is_pinned)}
                disabled={isPinning}
                className={note.is_pinned ? "text-violet-600 dark:text-violet-300" : ""}
              >
                {isPinning ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Pin
                    className={note.is_pinned ? "size-3.5 fill-current" : "size-3.5"}
                  />
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Excluir anotação"
                title="Excluir anotação"
                onClick={requestDeleteFromViewer}
                disabled={deleting}
                className={
                  editing
                    ? "hidden"
                    : "text-rose-500 hover:text-rose-600 dark:text-rose-400"
                }
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>
          {editing ? (
            <div className="min-h-0 overflow-auto rounded-xl border border-violet-300 bg-slate-50 p-3 dark:border-violet-400/70 dark:bg-white/[0.04]">
              <div className="space-y-3">
                <Input
                  value={draftTitle}
                  onChange={(event) => setDraftTitle(event.target.value)}
                  disabled={saving}
                  maxLength={160}
                  placeholder="Título da anotação"
                  className="h-11 rounded-xl border-violet-300 bg-white text-base font-semibold focus-visible:ring-violet-400 dark:border-white/20 dark:bg-white/10"
                />
                <Textarea
                  ref={textareaRef}
                  value={draft}
                  disabled={saving}
                  onChange={handleEditDraftChange}
                  onKeyDown={handleKeyDown}
                  className="min-h-40 resize-none rounded-xl border-violet-300 bg-white text-base focus-visible:ring-violet-400 dark:border-white/20 dark:bg-white/10"
                  rows={8}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="h-10 gap-1.5 rounded-full bg-violet-600 px-4 text-white hover:bg-violet-700"
                    onClick={() => void handleSave()}
                    disabled={saving || !draftTitle.trim() || !draft.trim()}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        Salvando…
                      </>
                    ) : (
                      "Salvar"
                    )}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-10 rounded-full px-4"
                    disabled={saving}
                    onClick={() => {
                      setEditing(false);
                      setViewerOpen(false);
                      onEditRequestHandled();
                      setDraftTitle(note.title);
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
            </div>
          ) : (
            <div className="min-h-0 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/[0.04]">
              <div className="space-y-3">{renderNoteContent(true)}</div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDeleteOpen || deleteRequest}
        onOpenChange={(open) => {
          setConfirmDeleteOpen(open);
          if (!open) onDeleteRequestHandled();
        }}
        title="Excluir anotação"
        description={`Tem certeza que deseja excluir "${note.title}"? Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}

/* ── main panel ────────────────────────────────────────── */

interface NotesPanelProps {
  initialNotes: Note[];
}

interface NoteContextMenuState {
  noteId: string;
  x: number;
  y: number;
}

export function NotesPanel({ initialNotes }: NotesPanelProps) {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [titleDraft, setTitleDraft] = useState("");
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [pinningId, setPinningId] = useState<string | null>(null);
  const [pinnedViewerNoteId, setPinnedViewerNoteId] = useState<string | null>(
    null,
  );
  const [noteContextMenu, setNoteContextMenu] =
    useState<NoteContextMenuState | null>(null);
  const [noteEditRequestId, setNoteEditRequestId] = useState<string | null>(
    null,
  );
  const [noteDeleteRequestId, setNoteDeleteRequestId] = useState<string | null>(
    null,
  );
  const [newlyCreatedNoteId, setNewlyCreatedNoteId] = useState<string | null>(
    null,
  );
  const newNoteTimeoutRef = useRef<number | null>(null);
  const toast = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    return () => {
      if (newNoteTimeoutRef.current !== null) {
        window.clearTimeout(newNoteTimeoutRef.current);
      }
    };
  }, []);

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
      result = result.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q),
      );
    }
    result = result.filter((note) =>
      isCreatedWithinRange(note, createdFrom, createdTo),
    );
    return result;
  }, [notes, activeTag, search, createdFrom, createdTo]);

  const pinnedNotes = useMemo(
    () =>
      notes
        .filter((note) => note.is_pinned)
        .sort(
          (a, b) =>
            new Date(b.updated_at).getTime() -
            new Date(a.updated_at).getTime(),
        ),
    [notes],
  );

  const handleCreate = async () => {
    const title = titleDraft.trim();
    const content = draft.trim();
    if (!title || !content) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });
      const data = (await res.json()) as { note?: Note; error?: string };
      if (!res.ok || !data.note)
        throw new Error(data.error ?? "Erro ao salvar.");
      setNotes((prev) => [data.note as Note, ...prev]);
      setNewlyCreatedNoteId(data.note.id);
      if (newNoteTimeoutRef.current !== null) {
        window.clearTimeout(newNoteTimeoutRef.current);
      }
      newNoteTimeoutRef.current = window.setTimeout(() => {
        setNewlyCreatedNoteId(null);
        newNoteTimeoutRef.current = null;
      }, 2200);
      setTitleDraft("");
      setDraft("");
      setCreateDialogOpen(false);
      toast.success("Anotação criada!");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao salvar anotação.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = useCallback(
    async (id: string, title: string, content: string) => {
      try {
        const res = await fetch(`/api/notes/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, content }),
        });
        const data = (await res.json()) as { note?: Note; error?: string };
        if (!res.ok || !data.note)
          throw new Error(data.error ?? "Erro ao atualizar.");
        setNotes((prev) =>
          prev.map((n) => (n.id === id ? (data.note as Note) : n)),
        );
        toast.success("Anotação atualizada!");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro ao atualizar.";
        toast.error(msg);
        throw e;
      }
    },
    [toast],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          throw new Error(data.error ?? "Erro ao excluir.");
        }
        await new Promise((resolve) => window.setTimeout(resolve, 680));
        setNotes((prev) => prev.filter((n) => n.id !== id));
        setNoteDeleteRequestId((current) => (current === id ? null : current));
        toast.success("Anotação excluída!");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro ao excluir.";
        toast.error(msg);
        throw e;
      }
    },
    [toast],
  );

  const handleTogglePinned = useCallback(
    async (id: string, isPinned: boolean) => {
      setPinningId(id);
      try {
        const res = await fetch(`/api/notes/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_pinned: isPinned }),
        });
        const data = (await res.json()) as { note?: Note; error?: string };
        if (!res.ok || !data.note) {
          throw new Error(data.error ?? "Erro ao atualizar fixa\u00e7\u00e3o.");
        }
        setNotes((prev) =>
          prev.map((note) => (note.id === id ? (data.note as Note) : note)),
        );
        toast.success(
          isPinned ? "Anota\u00e7\u00e3o fixada!" : "Anota\u00e7\u00e3o desafixada!",
        );
      } catch (e) {
        const msg =
          e instanceof Error
            ? e.message
            : "Erro ao atualizar fixa\u00e7\u00e3o.";
        toast.error(msg);
      } finally {
        setPinningId(null);
      }
    },
    [toast],
  );

  const handleTagClick = useCallback((tag: string) => {
    setActiveTag((prev) => (prev === tag ? null : tag));
  }, []);

  const contextMenuNote = noteContextMenu
    ? notes.find((note) => note.id === noteContextMenu.noteId) ?? null
    : null;
  const noteContextMenuActions: ContextMenuAction[] = contextMenuNote
    ? [
        {
          label: "Editar anota\u00e7\u00e3o",
          icon: Pencil,
          onSelect: () => setNoteEditRequestId(contextMenuNote.id),
        },
        {
          label: "Excluir anota\u00e7\u00e3o",
          icon: Trash2,
          destructive: true,
          onSelect: () => setNoteDeleteRequestId(contextMenuNote.id),
        },
        {
          label: contextMenuNote.is_pinned
            ? "Desafixar anota\u00e7\u00e3o"
            : "Fixar anota\u00e7\u00e3o",
          icon: Pin,
          onSelect: () =>
            void handleTogglePinned(
              contextMenuNote.id,
              !contextMenuNote.is_pinned,
            ),
        },
      ]
    : [];

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleCreate();
    }
  };

  const handleDraftChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const expansion = expandSlashCodeCommand(
      event.target.value,
      event.target.selectionStart,
      event.target.selectionEnd,
    );

    if (!expansion) {
      setDraft(event.target.value);
      return;
    }

    setDraft(expansion.value);
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(
        expansion.caretPosition,
        expansion.caretPosition,
      );
    });
  };

  const handleCreateDialogChange = (open: boolean) => {
    if (
      !open &&
      !submitting &&
      (titleDraft.trim() || draft.trim()) &&
      !window.confirm("Fechar e manter o rascunho da anotação para depois?")
    ) {
      return;
    }

    setCreateDialogOpen(open);
  };

  return (
    <div className="dashboard-reveal-notes min-w-0 space-y-4 sm:space-y-5">
      <Dialog open={createDialogOpen} onOpenChange={handleCreateDialogChange}>
        <DialogContent className="h-svh max-h-svh w-screen max-w-none overflow-y-auto rounded-none border-slate-900/10 bg-white/95 dark:border-white/10 dark:bg-zinc-950/95 sm:h-[calc(100svh-1rem)] sm:max-h-none sm:w-[calc(100vw-1rem)] sm:max-w-none sm:rounded-3xl sm:p-6">
          <DialogTitle className="text-xl">Nova anotação</DialogTitle>
          <DialogDescription>
            Registre uma ideia, um link ou um bloco de código para consultar
            depois.
          </DialogDescription>
          <div className="app-panel-enter min-w-0 space-y-4 rounded-2xl border border-slate-900/10 bg-white/70 p-4 shadow-sm backdrop-blur sm:p-6 dark:border-white/10 dark:bg-white/[0.05]">
            <Input
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
              disabled={submitting}
              maxLength={160}
              placeholder="Título da anotação"
              className="mb-2 h-11 rounded-xl border-slate-200 bg-white/50 text-base font-semibold focus-visible:ring-violet-400 sm:h-9 sm:text-sm dark:border-white/10 dark:bg-white/10 disabled:opacity-60"
            />
            <Textarea
              ref={textareaRef}
              value={draft}
              disabled={submitting}
              onChange={handleDraftChange}
              onKeyDown={handleKeyDown}
              placeholder="Anote qualquer coisa… use #tags para organizar. Ex: Marcilio perguntou sobre #feature-flag da coluna discrepância."
              className="min-h-24 resize-none rounded-xl border-slate-200 bg-white/50 text-base leading-relaxed focus-visible:ring-violet-400 sm:min-h-[80px] sm:text-sm dark:border-white/10 dark:bg-white/10 disabled:opacity-60"
              rows={3}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                className="h-11 min-w-0 flex-1 gap-1.5 rounded-full bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 sm:h-8 sm:flex-none sm:text-xs"
                onClick={handleCreate}
                disabled={submitting || !titleDraft.trim() || !draft.trim()}
              >
                {submitting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Plus className="size-3.5" />
                )}
                {submitting ? "Salvando…" : "Salvar anotação"}
              </Button>
              {(titleDraft.trim() || draft.trim()) && (
                <span className="hidden text-xs text-slate-400 sm:inline">
                  Ctrl+Enter para salvar
                </span>
              )}
              {(titleDraft.trim() || draft.trim()) && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto h-11 rounded-full px-4 text-sm sm:h-7 sm:flex-none sm:px-3 sm:text-xs"
                  disabled={submitting}
                  onClick={() => {
                    setTitleDraft("");
                    setDraft("");
                  }}
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
        </DialogContent>
      </Dialog>

      {pinnedNotes.length > 0 && (
        <section className="app-pinned-live app-panel-enter dashboard-reveal-panel rounded-2xl border border-violet-300/30 bg-violet-500/[0.04] px-3 py-2.5 dark:border-violet-300/15 dark:bg-violet-400/[0.04]">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-600/80 dark:text-violet-200/60">
            <Pin className="size-3.5 fill-current" />
            Fixadas
          </div>
          <div className="flex flex-wrap gap-1.5">
            {pinnedNotes.map((note) => (
              <button
                key={note.id}
                type="button"
                className="group inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-lg border border-violet-300/35 bg-white/50 px-2.5 text-left text-xs font-medium text-slate-700 transition-all hover:-translate-y-0.5 hover:border-violet-400/70 hover:bg-violet-100/70 hover:text-violet-800 hover:shadow-[0_6px_18px_rgba(139,92,246,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 dark:border-violet-300/20 dark:bg-white/[0.04] dark:text-white/75 dark:hover:border-violet-300/50 dark:hover:bg-violet-400/10 dark:hover:text-violet-100"
                onClick={() => {
                  setSearch("");
                  setActiveTag(null);
                  setCreatedFrom("");
                  setCreatedTo("");
                  setPinnedViewerNoteId(note.id);
                }}
                title="Abrir anota\u00e7\u00e3o"
              >
                <Pin className="size-3 shrink-0 text-violet-500 transition-transform group-hover:-rotate-12 dark:text-violet-300" />
                <span className="truncate">{note.title}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* search + tag filters */}
      {notes.length > 0 && (
        <div className="app-stagger-list dashboard-reveal-panel space-y-3">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_10rem]">
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
            <label className="relative block">
              <span className="sr-only">Criada a partir de</span>
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="date"
                value={createdFrom}
                max={createdTo || undefined}
                onChange={(event) => setCreatedFrom(event.target.value)}
                aria-label="Criada a partir de"
                title="Criada a partir de"
                className="h-11 rounded-full border-slate-200 bg-white/70 pl-9 text-sm backdrop-blur sm:h-9 dark:border-white/10 dark:bg-white/10"
              />
            </label>
            <label className="relative block">
              <span className="sr-only">Criada até</span>
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="date"
                value={createdTo}
                min={createdFrom || undefined}
                onChange={(event) => setCreatedTo(event.target.value)}
                aria-label="Criada até"
                title="Criada até"
                className="h-11 rounded-full border-slate-200 bg-white/70 pl-9 text-sm backdrop-blur sm:h-9 dark:border-white/10 dark:bg-white/10"
              />
            </label>
          </div>

          {createdFrom || createdTo ? (
            <button
              type="button"
              onClick={() => {
                setCreatedFrom("");
                setCreatedTo("");
              }}
              className="inline-flex min-h-11 items-center text-xs text-slate-400 underline hover:text-slate-600 sm:min-h-0 dark:hover:text-white/80"
            >
              Limpar período de criação
            </button>
          ) : null}

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

      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Anotações</h2>
          <p className="text-sm text-slate-500 dark:text-white/45">
            {notes.length} {notes.length === 1 ? "anotação" : "anotações"} no
            seu espaço
          </p>
        </div>
        <Button
          type="button"
          className="h-10 shrink-0 gap-1.5 rounded-full bg-violet-600 px-3 text-white hover:bg-violet-700 sm:px-4"
          onClick={() => {
            setError(null);
            setCreateDialogOpen(true);
          }}
        >
          <Plus className="size-4" />
          <span className="hidden sm:inline">Nova anotação</span>
          <span className="sm:hidden">Nova</span>
        </Button>
      </div>

      {/* notes list */}
      {filtered.length === 0 ? (
        <div className="app-empty-breathe dashboard-reveal-panel flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center sm:py-14 dark:border-white/15">
          <StickyNote className="size-8 text-slate-300 dark:text-white/20" />
          <p className="text-sm text-slate-500 dark:text-white/40">
            {notes.length === 0
              ? "Nenhuma anotação ainda. Clique em Nova anotação para começar."
              : "Nenhuma anotação encontrada para este filtro."}
          </p>
        </div>
      ) : (
        <div className="app-stagger-list space-y-3">
          {search || activeTag || createdFrom || createdTo ? (
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
              onTogglePinned={handleTogglePinned}
              onTagClick={handleTagClick}
              activeTag={activeTag}
              isPinning={pinningId === note.id}
              openViewerRequest={pinnedViewerNoteId === note.id}
              onOpenViewerRequestHandled={() => setPinnedViewerNoteId(null)}
              editRequest={noteEditRequestId === note.id}
              onEditRequestHandled={() => setNoteEditRequestId(null)}
              deleteRequest={noteDeleteRequestId === note.id}
              onDeleteRequestHandled={() => setNoteDeleteRequestId(null)}
              isNewlyCreated={newlyCreatedNoteId === note.id}
              onOpenContextMenu={(x, y) =>
                setNoteContextMenu({ noteId: note.id, x, y })
              }
            />
          ))}
        </div>
      )}

      {noteContextMenu && contextMenuNote ? (
        <ContextMenu
          x={noteContextMenu.x}
          y={noteContextMenu.y}
          actions={noteContextMenuActions}
          onClose={() => setNoteContextMenu(null)}
        />
      ) : null}
    </div>
  );
}
