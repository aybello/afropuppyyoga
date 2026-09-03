import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { lumaReminderOutcomeReports } from "../drizzle/schema";
import { getDb } from "./db";
import { sendEmail } from "./email";
import { notifyOwner } from "./_core/notification";

/** The active Monday/Thursday Luma agent schedule, used to authorize its callback. */
export const LUMA_REMINDER_SCHEDULE_TASK_UID = "GSedrNCOrQS1qKUTIFbv8k";
export const LUMA_REMINDER_OWNER_EMAIL = "afropuppyyoga@gmail.com";

const STOP_REASONS = [
  "no_invited_recipients",
  "duplicate_blast_today",
  "authentication_unavailable",
  "eligibility_unverified",
  "recipient_audience_unverified",
  "message_copy_unavailable",
  "luma_interface_unavailable",
  "schedule_interrupted",
  "other_safe_stop",
] as const;

const REASON_LABELS: Record<(typeof STOP_REASONS)[number], string> = {
  no_invited_recipients: "no Invited-only audience was available",
  duplicate_blast_today: "a promotional blast was already sent or scheduled today",
  authentication_unavailable: "Luma authentication could not be verified",
  eligibility_unverified: "event eligibility could not be verified",
  recipient_audience_unverified: "the Invited-only audience could not be verified",
  message_copy_unavailable: "approved reminder copy was not available for Luma’s composer",
  luma_interface_unavailable: "Luma’s visible controls could not be verified",
  schedule_interrupted: "the scheduled review was interrupted before it could complete",
  other_safe_stop: "a required safety check did not complete",
};

const rawOutcomeSchema = z.object({
  eventName: z.string().trim().min(1).max(240),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["sent", "safely_stopped"]),
  reason: z.enum(STOP_REASONS).optional(),
}).superRefine((value, ctx) => {
  if (value.status === "safely_stopped" && !value.reason) {
    ctx.addIssue({ code: "custom", message: "A safely stopped outcome requires a reason." });
  }
  if (value.status === "sent" && value.reason) {
    ctx.addIssue({ code: "custom", message: "A sent outcome cannot include a stop reason." });
  }
});

const rawReportSchema = z.object({
  runStatus: z.enum(["completed", "safely_stopped", "no_eligible_events"]),
  outcomes: z.array(rawOutcomeSchema).max(30),
}).superRefine((value, ctx) => {
  if (value.runStatus === "no_eligible_events" && value.outcomes.length !== 0) {
    ctx.addIssue({ code: "custom", message: "No-eligible-events reports cannot include event outcomes." });
  }
  if (value.runStatus === "completed" && value.outcomes.length === 0) {
    ctx.addIssue({ code: "custom", message: "Completed reports require at least one event outcome." });
  }
});

export type LumaReminderOutcomeReportInput = z.infer<typeof rawReportSchema>;
export type NormalizedLumaReminderOutcomeReport = LumaReminderOutcomeReportInput & {
  outcomes: Array<z.infer<typeof rawOutcomeSchema> & { eventName: string }>;
};

export type OutcomeDeliveryStatus = "pending" | "sent" | "failed";

export type OutcomeReportRecord = {
  id: number;
  deliveryStatus: OutcomeDeliveryStatus;
};

export type LumaReminderOutcomeRepository = {
  findByScheduleAndDate: (scheduleTaskUid: string, attemptDate: string) => Promise<OutcomeReportRecord | null>;
  claim: (input: {
    scheduleTaskUid: string;
    attemptDate: string;
    runStatus: LumaReminderOutcomeReportInput["runStatus"];
    outcomeSummary: string;
  }) => Promise<OutcomeReportRecord | null>;
  updateDelivery: (id: number, status: Exclude<OutcomeDeliveryStatus, "pending">, failureCode?: string) => Promise<void>;
};

export type LumaReminderOutcomeDependencies = {
  repository: LumaReminderOutcomeRepository;
  sendEmail: (input: { to: string; subject: string; text: string; html: string }) => Promise<void>;
  notifyOwner: (input: { title: string; content: string }) => Promise<boolean>;
  now?: Date;
};

const EMAIL_ADDRESS_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/g;

function redactSensitiveFragments(value: string): string {
  return value
    .replace(EMAIL_ADDRESS_PATTERN, "[redacted email]")
    .replace(PHONE_PATTERN, "[redacted phone]")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function sanitizeLumaReminderEventName(value: string): string {
  const sanitized = redactSensitiveFragments(value);
  return sanitized.slice(0, 160) || "APY event";
}

export function parseLumaReminderOutcomeReport(input: unknown): NormalizedLumaReminderOutcomeReport {
  const parsed = rawReportSchema.parse(input);
  return {
    ...parsed,
    outcomes: parsed.outcomes.map(outcome => ({
      ...outcome,
      eventName: sanitizeLumaReminderEventName(outcome.eventName),
    })),
  };
}

export function torontoAttemptDate(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function displayAttemptDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(now);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

export function summarizeLumaReminderOutcomes(report: NormalizedLumaReminderOutcomeReport): string[] {
  if (report.runStatus === "no_eligible_events") {
    return ["No eligible APY public classes were found for this scheduled reminder attempt."];
  }

  if (report.outcomes.length === 0) {
    return ["The scheduled review was safely stopped before any event could be verified. No Luma blast was sent."];
  }

  return report.outcomes.map(outcome => {
    const event = `${outcome.eventName} (${outcome.eventDate})`;
    if (outcome.status === "sent") return `${event} — Sent to Invited-only.`;
    return `${event} — Safely stopped: ${REASON_LABELS[outcome.reason!]}.`;
  });
}

export function buildLumaReminderOutcomeEmail(
  report: NormalizedLumaReminderOutcomeReport,
  now: Date = new Date()
): { subject: string; text: string; html: string; summary: string } {
  const attemptDate = displayAttemptDate(now);
  const lines = summarizeLumaReminderOutcomes(report);
  const summary = lines.join("\n");
  const heading = report.runStatus === "completed"
    ? "Luma reminder attempt completed"
    : report.runStatus === "no_eligible_events"
      ? "No eligible Luma reminder events"
      : "Luma reminder attempt safely stopped";
  const text = [
    `${heading} — ${attemptDate}`,
    "",
    ...lines.map(line => `• ${line}`),
    "",
    "This operational report contains no attendee or recipient details.",
  ].join("\n");
  const htmlLines = lines.map(line => `<li style="margin:0 0 8px;">${escapeHtml(line)}</li>`).join("");
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#fff8f5;color:#321622;font-family:Arial,Helvetica,sans-serif;"><main style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #f2d9e3;border-radius:16px;padding:28px;"><p style="margin:0 0 8px;color:#8b2252;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">AfroPuppyYoga operations</p><h1 style="margin:0 0 8px;font-family:Georgia,serif;font-size:26px;line-height:1.25;">${escapeHtml(heading)}</h1><p style="margin:0 0 22px;color:#725061;">${escapeHtml(attemptDate)}</p><ul style="margin:0 0 22px;padding-left:20px;line-height:1.55;">${htmlLines}</ul><p style="margin:0;color:#725061;font-size:13px;line-height:1.5;">This operational report contains no attendee or recipient details.</p></main></body></html>`;
  return { subject: `APY Luma reminder outcome — ${attemptDate}`, text, html, summary };
}

export function isAuthorizedLumaReminderSchedule(taskUid: string | undefined): boolean {
  return taskUid === LUMA_REMINDER_SCHEDULE_TASK_UID;
}

export async function deliverLumaReminderOutcomeReport(
  report: NormalizedLumaReminderOutcomeReport,
  dependencies: LumaReminderOutcomeDependencies
): Promise<{ delivery: "sent" | "already_reported" | "failed"; attemptDate: string }> {
  const now = dependencies.now ?? new Date();
  const attemptDate = torontoAttemptDate(now);
  const existing = await dependencies.repository.findByScheduleAndDate(
    LUMA_REMINDER_SCHEDULE_TASK_UID,
    attemptDate
  );
  if (existing) return { delivery: "already_reported", attemptDate };

  const email = buildLumaReminderOutcomeEmail(report, now);
  const claimed = await dependencies.repository.claim({
    scheduleTaskUid: LUMA_REMINDER_SCHEDULE_TASK_UID,
    attemptDate,
    runStatus: report.runStatus,
    outcomeSummary: email.summary,
  });
  if (!claimed) return { delivery: "already_reported", attemptDate };

  try {
    await dependencies.sendEmail({
      to: LUMA_REMINDER_OWNER_EMAIL,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
    await dependencies.repository.updateDelivery(claimed.id, "sent");
    return { delivery: "sent", attemptDate };
  } catch (error) {
    await dependencies.repository.updateDelivery(claimed.id, "failed", "owner_email_delivery_failed");
    try {
      await dependencies.notifyOwner({
        title: "APY Luma reminder outcome email needs review",
        content: `The scheduled Luma reminder outcome email could not be delivered for ${attemptDate}. No attendee or recipient details are included in this alert.`,
      });
    } catch {
      // The primary failed-email record remains durable even if the fallback service is unavailable.
    }
    return { delivery: "failed", attemptDate };
  }
}

function isDuplicateError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "ER_DUP_ENTRY";
}

export function createLumaReminderOutcomeRepository(): LumaReminderOutcomeRepository {
  return {
    async findByScheduleAndDate(scheduleTaskUid, attemptDate) {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable for Luma reminder outcome reporting");
      const rows = await db.select({ id: lumaReminderOutcomeReports.id, deliveryStatus: lumaReminderOutcomeReports.deliveryStatus })
        .from(lumaReminderOutcomeReports)
        .where(and(
          eq(lumaReminderOutcomeReports.scheduleTaskUid, scheduleTaskUid),
          eq(lumaReminderOutcomeReports.attemptDate, attemptDate)
        ))
        .limit(1);
      return rows[0] ?? null;
    },
    async claim(input) {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable for Luma reminder outcome reporting");
      try {
        const result = await db.insert(lumaReminderOutcomeReports).values({
          ...input,
          deliveryStatus: "pending",
        });
        return { id: Number(result[0].insertId), deliveryStatus: "pending" };
      } catch (error) {
        if (isDuplicateError(error)) return null;
        throw error;
      }
    },
    async updateDelivery(id, deliveryStatus, failureCode) {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable for Luma reminder outcome reporting");
      await db.update(lumaReminderOutcomeReports)
        .set({ deliveryStatus, failureCode: failureCode ?? null })
        .where(eq(lumaReminderOutcomeReports.id, id));
    },
  };
}
