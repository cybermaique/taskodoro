import type { ReactNode } from "react";

const URL_PATTERN = /(https?:\/\/[^\s<>"']+)/gi;
const MAX_VISIBLE_URL_LENGTH = 72;
const VISIBLE_URL_PREFIX_LENGTH = 44;
const VISIBLE_URL_SUFFIX_LENGTH = 24;

function splitUrlTrailingPunctuation(value: string) {
  const match = /[.,;:!?\])}]+$/.exec(value);
  if (!match) return { url: value, trailingPunctuation: "" };

  return {
    url: value.slice(0, -match[0].length),
    trailingPunctuation: match[0],
  };
}

function shortenUrl(url: string) {
  if (url.length <= MAX_VISIBLE_URL_LENGTH) return url;

  return `${url.slice(0, VISIBLE_URL_PREFIX_LENGTH)}…${url.slice(-VISIBLE_URL_SUFFIX_LENGTH)}`;
}

function renderUrl(url: string, key: number): ReactNode {
  const { url: cleanUrl, trailingPunctuation } =
    splitUrlTrailingPunctuation(url);

  return (
    <span key={key}>
      <a
        href={cleanUrl}
        target="_blank"
        rel="noreferrer"
        title={cleanUrl}
        className="font-medium text-teal-700 underline decoration-teal-500/50 underline-offset-2 hover:text-teal-800 dark:text-teal-300 dark:hover:text-teal-200"
      >
        {shortenUrl(cleanUrl)}
      </a>
      {trailingPunctuation}
    </span>
  );
}

export function TaskDescription({ children }: { children: string }) {
  const parts = children.split(URL_PATTERN);

  return (
    <>
      {parts.map((part, index) =>
        /^https?:\/\//i.test(part) ? part && renderUrl(part, index) : part,
      )}
    </>
  );
}
