import { communicationsLog, jobApplicationActions } from "../drizzle/schema";
import { getDb } from "./db";

export type OfferSigningOutcomeInput = {
  applicationId: number;
  requestKey: string;
  actor: { id: number; name: string | null; email: string | null };
  fromStatus: string;
  toStatus: string;
  reused: boolean;
  offerLetterType: string;
  expiresAt: Date;
  emailStatus: string;
  smsStatus: string;
  smsReason?: string;
};

export type OfferSigningOutcomeResult = {
  recorded: boolean;
  warning?: string;
};

const TIMELINE_WARNING =
  "Offer link accepted for sending, but its timeline could not be saved. Do not resend.";

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

function safeSmsReason(reason: string | undefined): string | undefined {
  if (reason === undefined) return undefined;
  return /^[a-z0-9_-]{1,64}$/i.test(reason) ? reason : "redacted";
}

/**
 * Atomically claims an accepted offer-signing delivery outcome and appends its
 * hiring timeline entry. Signing credentials and URLs are deliberately absent.
 */
export async function recordOfferSigningOutcome(
  input: OfferSigningOutcomeInput,
): Promise<OfferSigningOutcomeResult> {
  try {
    const db = await getDb();
    if (!db) return { recorded: false, warning: TIMELINE_WARNING };

    const smsReason = safeSmsReason(input.smsReason);
    const outcome = {
      offerLetterType: input.offerLetterType,
      tokenReused: input.reused,
      expiresAt: input.expiresAt.toISOString(),
      requestKey: input.requestKey,
      emailStatus: input.emailStatus,
      smsStatus: input.smsStatus,
      ...(smsReason === undefined ? {} : { smsReason }),
    };

    await db.transaction(async (tx) => {
      await tx.insert(communicationsLog).values({
        idempotencyKey: `offer-outcome:${input.applicationId}:${input.requestKey}`,
        entityType: "job_application",
        entityId: input.applicationId,
        channel: "system",
        direction: "system",
        action: "offer_signing_outcome",
        deliveryStatus: "recorded",
        recipient: null,
        subject: "Offer signing outcome",
        bodyPreview: JSON.stringify({
          fromStatus: input.fromStatus,
          toStatus: input.toStatus,
          ...outcome,
        }),
        actorUserId: input.actor.id,
        actorName: input.actor.name,
      });

      await tx.insert(jobApplicationActions).values({
        applicationId: input.applicationId,
        action: input.reused ? "offer_resent" : "offer_sent",
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        actorUserId: input.actor.id,
        actorName: input.actor.name,
        actorEmail: input.actor.email,
        details: JSON.stringify(outcome),
      });
    });

    return { recorded: true };
  } catch (error) {
    if (isDuplicateEntry(error)) return { recorded: false };
    return { recorded: false, warning: TIMELINE_WARNING };
  }
}
