export type CodeBlockLanguage = "code" | "json";

export function expandSlashCodeCommand(
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
