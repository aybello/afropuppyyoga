import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { communicationsLog } from "../drizzle/schema";
import { getDb } from "./db";
import { sendEmail, type EmailOptions } from "./email";

export type InterviewEmailResult = { status: "sent" | "unknown" | "failed"; reason?: string; reused?: boolean };

const BODY_PREVIEW = "Private offer letter and NDA signing link emailed. Link redacted.";
const CLAIM_FAILURE = "Email was not attempted because its delivery record could not be saved.";
const RETRY_CONFLICT = "The offer notification changed during a retry. Close and reopen the offer before starting a new send.";
const PRIOR_UNCONFIRMED = "An earlier email attempt is pending or unconfirmed. Check the delivery history before sending a new offer notification.";
const PROVIDER_UNCONFIRMED = "The email provider did not confirm this offer notification. Check the APY Sent folder before starting a new send.";
const FINALIZATION_WARNING = "Email was accepted, but its delivery record could not be finalized. Do not resend it.";
const UNEXPECTED_FAILURE = "Email delivery could not be confirmed. Check its delivery history before starting a new send.";

function isDuplicateEntry(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; message?: unknown; cause?: unknown };
  if (candidate.code === "ER_DUP_ENTRY") return true;
  if (typeof candidate.message === "string" && /duplicate entry/i.test(candidate.message)) return true;
  return isDuplicateEntry(candidate.cause);
}

/** Claim before provider dispatch. Uncertain sends are never automatically repeated. */
export async function sendOfferSigningEmail(input: {
  applicationId: number;
  requestKey: string;
  actor: { id: number; name: string | null };
  email: EmailOptions;
}): Promise<InterviewEmailResult> {
  const key = `offer-email:${input.applicationId}:${input.requestKey}`;
  const fingerprint = createHash("sha256").update(JSON.stringify(input.email)).digest("hex");
  const ledgerSubject = `Offer signing notification ${fingerprint}`;

  try {
    const db = await getDb();
    if (!db) return { status: "failed", reason: CLAIM_FAILURE };

    try {
      await db.insert(communicationsLog).values({
        entityType: "job_application",
        entityId: input.applicationId,
        channel: "email",
        direction: "outbound",
        action: "offer_signing_email",
        recipient: input.email.to,
        subject: ledgerSubject,
        bodyPreview: BODY_PREVIEW,
        deliveryStatus: "processing",
        idempotencyKey: key,
        actorUserId: input.actor.id,
        actorName: input.actor.name,
      });
    } catch (error) {
      if (!isDuplicateEntry(error)) return { status: "failed", reason: CLAIM_FAILURE };

      const [prior] = await db
        .select()
        .from(communicationsLog)
        .where(eq(communicationsLog.idempotencyKey, key))
        .limit(1);
      if (!prior || prior.recipient !== input.email.to || prior.subject !== ledgerSubject) {
        return { status: "failed", reason: RETRY_CONFLICT };
      }
      return prior.deliveryStatus === "sent"
        ? { status: "sent", reused: true }
        : { status: "unknown", reused: true, reason: PRIOR_UNCONFIRMED };
    }

    try {
      await sendEmail(input.email);
    } catch {
      try {
        await db
          .update(communicationsLog)
          .set({ deliveryStatus: "unknown" })
          .where(eq(communicationsLog.idempotencyKey, key));
      } catch {
        // The processing claim remains durable and prevents an automatic resend.
      }
      return { status: "unknown", reason: PROVIDER_UNCONFIRMED };
    }

    try {
      await db
        .update(communicationsLog)
        .set({ deliveryStatus: "sent" })
        .where(eq(communicationsLog.idempotencyKey, key));
    } catch {
      return { status: "sent", reason: FINALIZATION_WARNING };
    }
    return { status: "sent" };
  } catch {
    return { status: "unknown", reason: UNEXPECTED_FAILURE };
  }
}
