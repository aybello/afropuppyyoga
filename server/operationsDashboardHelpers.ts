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

/**
 * The breeder follow-up queue is introduced by a later, dependent migration.
 * Until then, Run APY must remain usable while surfacing every other action.
 */
export function isMissingBreederFollowUpsTable(error: unknown) {
  const messages: string[] = [];
  const codes: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;

  while (current && !seen.has(current)) {
    seen.add(current);
    if (current instanceof Error) {
      messages.push(current.message);
      const code = (current as Error & { code?: unknown }).code;
      if (typeof code === "string") codes.push(code);
      current = current.cause;
      continue;
    }
    messages.push(String(current));
    current = undefined;
  }

  const message = messages.join(" ");
  const targetsFutureFollowUpQuery = /breederLeadFollowUps/i.test(message);
  const tableIsAbsent = /(does not exist|doesn't exist|unknown table|no such table)/i.test(message);
  const legacyColumnIsAbsent = codes.includes("ER_BAD_FIELD_ERROR")
    && /breederleadfollowups\.(completed|dueat|note)/i.test(message)
    && /unknown column/i.test(message);

  return targetsFutureFollowUpQuery && (tableIsAbsent || legacyColumnIsAbsent);
}
