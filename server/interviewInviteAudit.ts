import { communicationsLog, jobApplicationActions } from "../drizzle/schema";
import { getDb } from "./db";

export type InterviewInviteOutcomeInput = {
  applicationId: number;
  requestKey: string;
  actor: { id: number; name: string | null; email: string | null };
  fromStatus: string;
  toStatus: string;
  bookingLink: string;
  emailStatus: string;
  smsStatus: string;
  smsReason?: string;
};

export type InterviewInviteOutcomeResult = {
  recorded: boolean;
  warning?: string;
};

const TIMELINE_WARNING =
  "Invitation accepted for sending, but its timeline could not be saved. Do not resend.";

function isDuplicateEntry(error: unknown): boolean {
  const visited = new Set<unknown>();
  let current: unknown = error;

  while (typeof current === "object" && current !== null && !visited.has(current)) {
    visited.add(current);
    const candidate = current as { code?: unknown; errno?: unknown; cause?: unknown };
    if (candidate.code === "ER_DUP_ENTRY" || candidate.errno === 1062) return true;
    current = candidate.cause;
  }

  return false;
}

/**
 * Atomically claims an invitation outcome and appends its hiring timeline entry.
 * A failed timeline insert rejects the transaction so the idempotency claim rolls
 * back and the same request key can safely be retried.
 */
export async function recordInterviewInviteOutcome(
  input: InterviewInviteOutcomeInput,
): Promise<InterviewInviteOutcomeResult> {
  try {
    const db = await getDb();
    if (!db) return { recorded: false, warning: TIMELINE_WARNING };

    await db.transaction(async (tx) => {
      await tx.insert(communicationsLog).values({
        idempotencyKey: `interview-outcome:${input.applicationId}:${input.requestKey}`,
        entityType: "job_application",
        entityId: input.applicationId,
        channel: "system",
        direction: "system",
        action: "interview_invite_outcome",
        deliveryStatus: "recorded",
        recipient: null,
        subject: "Interview invitation outcome",
        bodyPreview: JSON.stringify({
          fromStatus: input.fromStatus,
          toStatus: input.toStatus,
          emailStatus: input.emailStatus,
          smsStatus: input.smsStatus,
          ...(input.smsReason === undefined ? {} : { smsReason: input.smsReason }),
        }),
        actorUserId: input.actor.id,
        actorName: input.actor.name,
      });

      await tx.insert(jobApplicationActions).values({
        applicationId: input.applicationId,
        action: "interview_invite_sent",
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        actorUserId: input.actor.id,
        actorName: input.actor.name,
        actorEmail: input.actor.email,
        details: JSON.stringify({
          requestKey: input.requestKey,
          bookingLink: input.bookingLink,
          emailStatus: input.emailStatus,
          smsStatus: input.smsStatus,
          ...(input.smsReason === undefined ? {} : { smsReason: input.smsReason }),
        }),
      });
    });

    return { recorded: true };
  } catch (error) {
    if (isDuplicateEntry(error)) return { recorded: false };
    return { recorded: false, warning: TIMELINE_WARNING };
  }
}
