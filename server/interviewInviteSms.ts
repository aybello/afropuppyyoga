import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import twilio from "twilio";
import { communicationsLog } from "../drizzle/schema";
import { normalizeCanadianPhoneNumber } from "../shared/phone";
import { getDb } from "./db";
import { isSmsSuppressed } from "./smsConsent";

export type InterviewInviteSmsStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "skipped"
  | "failed"
  | "unknown";

export type InterviewInviteSmsResult = {
  status: InterviewInviteSmsStatus;
  reason?: string;
  phone: string | null;
  providerMessageId?: string;
};

export type InterviewInviteSmsInput = {
  applicationId: number;
  applicantName: string;
  role: string;
  phone: string | null;
  bookingLink: string;
  requestKey: string;
  actor: { id: number; name: string | null };
};

const ACTION = "interview_invite_sms";
const FAILURE_STATUSES = new Set(["failed", "undelivered", "canceled"]);

function safeText(value: string, maxLength: number) {
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function firstName(name: string) {
  return safeText(name, 30).split(" ")[0] || "there";
}

function buildBody(input: InterviewInviteSmsInput) {
  const role = safeText(input.role, 100) || "role";
  return `AfroPuppyYoga: Hi ${firstName(input.applicantName)}, please book your ${role} interview: ${input.bookingLink}. Check your email for details. Questions? afropuppyyoga@gmail.com. Reply STOP to opt out.`;
}

function payloadHash(phone: string, body: string) {
  return createHash("sha256").update(phone + body).digest("hex");
}

function isDuplicateKeyError(error: unknown) {
  const candidate = error as { code?: unknown; message?: unknown } | null;
  return candidate?.code === "ER_DUP_ENTRY" || /duplicate|unique constraint/i.test(String(candidate?.message ?? ""));
}

function isExplicitProviderRejection(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { status?: unknown; code?: unknown };
  return typeof candidate.status === "number" && candidate.status >= 400 && candidate.status < 500
    && candidate.status !== 408;
}

function publicStatus(providerStatus: string | null | undefined): InterviewInviteSmsStatus {
  const status = providerStatus?.toLowerCase();
  if (status === "delivered") return "delivered";
  if (status === "sent") return "sent";
  if (status && FAILURE_STATUSES.has(status)) return "failed";
  if (["queued", "accepted", "scheduled", "sending"].includes(status ?? "")) return "queued";
  return "unknown";
}

function replayStatus(status: string): InterviewInviteSmsStatus {
  if (status === "processing") return "unknown";
  return publicStatus(status);
}

export async function sendInterviewInviteSms(input: InterviewInviteSmsInput): Promise<InterviewInviteSmsResult> {
  let phone: string | null = null;
  try {
    phone = input.phone ? normalizeCanadianPhoneNumber(input.phone) : null;
    if (!phone) return { status: "skipped", reason: "No valid saved applicant phone number.", phone: null };

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_PHONE_NUMBER;
    if (!accountSid || !authToken || !from) {
      return { status: "skipped", reason: "SMS is not configured.", phone };
    }

    try {
      if (await isSmsSuppressed(phone)) {
        return { status: "skipped", reason: "Applicant opted out of SMS.", phone };
      }
    } catch {
      return { status: "unknown", reason: "SMS consent could not be verified.", phone };
    }

    const body = buildBody(input);
    const hash = payloadHash(phone, body);
    const idempotencyKey = `interview-sms:${input.applicationId}:${input.requestKey}`;
    const db = await getDb();
    if (!db) return { status: "unknown", reason: "SMS delivery could not be reserved.", phone };

    try {
      await db.insert(communicationsLog).values({
        entityType: "job_application",
        entityId: input.applicationId,
        channel: "sms",
        direction: "outbound",
        action: ACTION,
        recipient: phone,
        subject: hash,
        bodyPreview: body,
        deliveryStatus: "processing",
        providerMessageId: null,
        idempotencyKey,
        actorUserId: input.actor.id,
        actorName: input.actor.name,
      });
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        return { status: "unknown", reason: "SMS delivery could not be reserved.", phone };
      }

      try {
        const [existing] = await db.select({
          recipient: communicationsLog.recipient,
          subject: communicationsLog.subject,
          deliveryStatus: communicationsLog.deliveryStatus,
          providerMessageId: communicationsLog.providerMessageId,
        }).from(communicationsLog).where(and(
          eq(communicationsLog.idempotencyKey, idempotencyKey),
          eq(communicationsLog.entityType, "job_application"),
          eq(communicationsLog.entityId, input.applicationId),
          eq(communicationsLog.channel, "sms"),
          eq(communicationsLog.action, ACTION),
        )).limit(1);

        if (!existing || existing.recipient !== phone || existing.subject !== hash) {
          return { status: "failed", reason: "SMS request conflicts with a previous request.", phone };
        }
        const status = replayStatus(existing.deliveryStatus);
        return {
          status,
          reason: status === "unknown" ? "A previous SMS outcome is still unknown." : undefined,
          phone,
          ...(existing.providerMessageId ? { providerMessageId: existing.providerMessageId } : {}),
        };
      } catch {
        return { status: "unknown", reason: "Previous SMS delivery could not be verified.", phone };
      }
    }

    let providerMessageId: string | undefined;
    let resultStatus: InterviewInviteSmsStatus;
    try {
      const client = twilio(accountSid, authToken, { timeout: 10_000, autoRetry: false });
      const message = await client.messages.create({ to: phone, from, body });
      providerMessageId = message.sid || undefined;
      resultStatus = providerMessageId ? publicStatus(message.status) : "unknown";
    } catch (error) {
      resultStatus = isExplicitProviderRejection(error) ? "failed" : "unknown";
    }

    try {
      await db.update(communicationsLog).set({
        deliveryStatus: resultStatus,
        providerMessageId: providerMessageId ?? null,
      }).where(and(
        eq(communicationsLog.idempotencyKey, idempotencyKey),
        eq(communicationsLog.entityType, "job_application"),
        eq(communicationsLog.entityId, input.applicationId),
        eq(communicationsLog.channel, "sms"),
        eq(communicationsLog.action, ACTION),
      ));
    } catch {
      return {
        status: "unknown",
        reason: "SMS outcome could not be recorded.",
        phone,
        ...(providerMessageId ? { providerMessageId } : {}),
      };
    }

    return {
      status: resultStatus,
      ...(resultStatus === "failed" ? { reason: "SMS provider rejected the message." } : {}),
      ...(resultStatus === "unknown" ? { reason: "SMS provider outcome is unknown." } : {}),
      phone,
      ...(providerMessageId ? { providerMessageId } : {}),
    };
  } catch {
    return { status: "unknown", reason: "SMS delivery could not be completed.", phone };
  }
}
