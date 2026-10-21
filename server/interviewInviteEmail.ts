import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { communicationsLog } from "../drizzle/schema";
import { getDb } from "./db";
import { sendEmail, type EmailOptions } from "./email";

export type InterviewEmailResult = { status: "sent" | "unknown" | "failed"; reason?: string; reused?: boolean };

/** Claim before provider dispatch. Uncertain sends are never automatically repeated. */
export async function sendInterviewInviteEmail(input: {
  applicationId: number;
  requestKey: string;
  actor: { id: number; name: string | null };
  email: EmailOptions;
}): Promise<InterviewEmailResult> {
  const key = `interview-email:${input.applicationId}:${input.requestKey}`;
  const fingerprint = createHash("sha256").update(JSON.stringify(input.email)).digest("hex");
  try {
    const db = await getDb();
    if (!db) return { status: "failed", reason: "Email was not attempted because its delivery record could not be saved." };
    try {
      await db.insert(communicationsLog).values({
        entityType: "job_application", entityId: input.applicationId, channel: "email", direction: "outbound",
        action: "interview_invite_email", recipient: input.email.to,
        subject: `Interview invitation ${fingerprint}`, bodyPreview: input.email.text?.slice(0, 1000) ?? null,
        deliveryStatus: "processing", idempotencyKey: key, actorUserId: input.actor.id, actorName: input.actor.name,
      });
    } catch (error) {
      const cause = error as { code?: string; cause?: { code?: string }; message?: string };
      if (cause.code !== "ER_DUP_ENTRY" && cause.cause?.code !== "ER_DUP_ENTRY" && !/duplicate entry/i.test(cause.message ?? "")) {
        return { status: "failed", reason: "Email was not attempted because its delivery record could not be saved." };
      }
      const [prior] = await db.select().from(communicationsLog).where(eq(communicationsLog.idempotencyKey, key)).limit(1);
      if (!prior || prior.recipient !== input.email.to || prior.subject !== `Interview invitation ${fingerprint}`) {
        return { status: "failed", reason: "The invitation changed during a retry. Close and reopen the invitation before starting a new send." };
      }
      return prior.deliveryStatus === "sent"
        ? { status: "sent", reused: true }
        : { status: "unknown", reused: true, reason: "An earlier email attempt is pending or unconfirmed. Check the delivery history before sending a new invitation." };
    }
    try {
      await sendEmail(input.email);
    } catch {
      // SMTP may have accepted the message before the connection failed.
      try { await db.update(communicationsLog).set({ deliveryStatus: "unknown" }).where(eq(communicationsLog.idempotencyKey, key)); } catch { /* Processing remains a no-resend claim. */ }
      return { status: "unknown", reason: "The email provider did not confirm this invitation. Check the APY Sent folder before starting a new invitation." };
    }
    try {
      await db.update(communicationsLog).set({ deliveryStatus: "sent" }).where(eq(communicationsLog.idempotencyKey, key));
    } catch {
      return { status: "sent", reason: "Email was accepted, but its delivery record could not be finalized. Do not resend it." };
    }
    return { status: "sent" };
  } catch {
    return { status: "unknown", reason: "Email delivery could not be confirmed. Check its delivery history before starting a new invitation." };
  }
}
