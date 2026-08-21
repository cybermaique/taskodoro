import { Braces } from "lucide-react";
import type { ReactNode } from "react";

const URL_PATTERN = /(https?:\/\/[^\s<>"']+)/gi;
const SHORTCUT_PATTERN = /(^|\n)([^<>\n]+?)\s*>\s*((?:https?:\/\/|www\.)?[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+(?:[/?#][^\s<>]*)?)(?=\s|$)/gim;
const CODE_BLOCK_PATTERN = /```(json|code)?[ \t]*\r?\n([\s\S]*?)```/gi;
const MAX_VISIBLE_URL_LENGTH = 72;
const VISIBLE_URL_PREFIX_LENGTH = 44;
const VISIBLE_URL_SUFFIX_LENGTH = 24;

type DescriptionBlock =
  | { type: "text"; content: string }
  | { type: "code"; content: string; language: "code" | "json" };

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

function shortenUrl(url: string) {
  if (url.length <= MAX_VISIBLE_URL_LENGTH) return url;

  return `${url.slice(0, VISIBLE_URL_PREFIX_LENGTH)}…${url.slice(-VISIBLE_URL_SUFFIX_LENGTH)}`;
}

function formatJsonIfValid(content: string) {
  try {
    return JSON.stringify(JSON.parse(content), null, 2);
  } catch {
    return null;
  }
}

function parseDescription(content: string): DescriptionBlock[] {
  const blocks: DescriptionBlock[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = CODE_BLOCK_PATTERN.exec(content))) {
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

  return blocks.length ? blocks : [{ type: "text", content }];
}

function renderLink(url: string, key: string) {
  const { url: cleanUrl, trailingPunctuation } =
    splitUrlTrailingPunctuation(url);

  return (
    <span key={key}>
      <a
        href={cleanUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={cleanUrl}
        onClick={(event) => event.stopPropagation()}
        className="font-medium text-teal-700 underline decoration-teal-500/50 underline-offset-2 hover:text-teal-800 dark:text-teal-300 dark:hover:text-teal-200"
      >
        {shortenUrl(cleanUrl)}
      </a>
      {trailingPunctuation}
    </span>
  );
}

function renderPlainContent(value: string, keyPrefix: string): ReactNode[] {
  const parts = value.split(URL_PATTERN);

  return parts.map((part, index) =>
    /^https?:\/\//i.test(part)
      ? renderLink(part, `${keyPrefix}-url-${index}`)
      : part,
  );
}

function renderInlineContent(text: string, keyPrefix: string) {
  const rendered: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  let shortcutIndex = 0;

  SHORTCUT_PATTERN.lastIndex = 0;
  while ((match = SHORTCUT_PATTERN.exec(text))) {
    const leadingLength = match[1]?.length ?? 0;
    const labelStart = match.index + leadingLength;
    const prefix = text.slice(cursor, labelStart);
    if (prefix) {
      rendered.push(
        <span key={`${keyPrefix}-prefix-${shortcutIndex}`}>
          {renderPlainContent(prefix, `${keyPrefix}-prefix-${shortcutIndex}`)}
        </span>,
      );
    }

    const label = match[2].trim();
    const { url, trailingPunctuation } = splitUrlTrailingPunctuation(
      match[3],
    );
    const normalizedUrl = normalizeShortcutUrl(url);
    rendered.push(
      <span key={`${keyPrefix}-shortcut-${shortcutIndex}`}>
        <a
          href={normalizedUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={normalizedUrl}
          onClick={(event) => event.stopPropagation()}
          className="font-medium text-teal-700 underline decoration-teal-500/50 underline-offset-2 hover:text-teal-800 dark:text-teal-300 dark:hover:text-teal-200"
        >
          {label}
        </a>
        {trailingPunctuation}
      </span>,
    );
    cursor = SHORTCUT_PATTERN.lastIndex;
    shortcutIndex += 1;
  }

  const remaining = text.slice(cursor);
  if (remaining || rendered.length === 0) {
    rendered.push(
      <span key={`${keyPrefix}-remaining`}>
        {renderPlainContent(remaining, `${keyPrefix}-remaining`)}
      </span>,
    );
  }

  return rendered;
}

function CodeBlock({
  content,
  language,
}: {
  content: string;
  language: "code" | "json";
}) {
  const formattedJson = language === "json" ? formatJsonIfValid(content) : null;
  const codeContent = formattedJson ?? content;
  const lineCount = codeContent.split(/\r?\n/).length;
  const label = language === "json" ? "JSON" : "Código";

  return (
    <details className="my-2 overflow-hidden rounded-xl border border-slate-700 bg-slate-950 text-slate-100 dark:border-white/10">
      <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 px-3 text-xs font-medium [&::-webkit-details-marker]:hidden">
        <Braces className="size-3.5 text-teal-300" />
        <span>{label}</span>
        <span className="text-slate-400">· {lineCount} linhas</span>
        <span className="ml-auto text-slate-400">Abrir</span>
      </summary>
      <pre className="max-h-80 overflow-auto border-t border-white/10 p-3 font-mono text-xs leading-relaxed text-slate-100 [overflow-wrap:anywhere]">
        {codeContent}
      </pre>
    </details>
  );
}

export function TaskDescription({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <>
      {parseDescription(children).map((block, index) =>
        block.type === "code" ? (
          <CodeBlock
            key={`code-${index}`}
            content={block.content}
            language={block.language}
          />
        ) : (
          <p
            key={`text-${index}`}
            className={
              className ??
              "whitespace-pre-wrap break-words text-sm leading-relaxed"
            }
          >
            {renderInlineContent(block.content, `text-${index}`)}
          </p>
        ),
      )}
    </>
  );
}
