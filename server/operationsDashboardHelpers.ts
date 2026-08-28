export type OperationsAction = {
  id: string;
  severity: "critical" | "warning" | "normal";
  title: string;
  detail: string;
  href: string;
};

export function sortOperationsActions(actions: OperationsAction[]) {
  const severityOrder = { critical: 0, warning: 1, normal: 2 } as const;
  return [...actions].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

export function torontoDate(offsetDays = 0, now = Date.now()) {
  const date = new Date(now + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
