const ptBrFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

const ptBrDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
});

export function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return ptBrFormatter.format(new Date(value));
}

export function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return ptBrDateFormatter.format(new Date(`${value}T00:00:00`));
}

export function secondsToClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.max(totalSeconds % 60, 0)
    .toString()
    .padStart(2, "0");

  return `${minutes}:${seconds}`;
}
