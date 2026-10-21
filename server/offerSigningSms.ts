import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import twilio from "twilio";
import { communicationsLog } from "../drizzle/schema";
import { normalizeCanadianPhoneNumber } from "../shared/phone";
import { getDb } from "./db";
import type { InterviewInviteSmsResult, InterviewInviteSmsStatus } from "./interviewInviteSms";
import { isSmsSuppressed } from "./smsConsent";

export type OfferSigningSmsInput = {
  applicationId: number;
  applicantName: string;
  role: string;
  phone: string | null;
  signingLink: string;
  requestKey: string;
  actor: { id: number; name: string | null };
};

const ACTION = "offer_signing_sms";
const BODY_PREVIEW = "Private offer letter and NDA signing link sent by text. Link redacted.";
const FAILURE_STATUSES = new Set(["failed", "undelivered", "canceled"]);
const SIGNING_LINK = /^https:\/\/afropuppyyoga\.ca\/sign\?token=[0-9a-f]{96}$/;

function safeText(value: string, maxLength: number) {
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function firstName(name: string) {
  return safeText(name, 30).split(" ")[0] || "there";
}

function isValidSigningLink(value: string) {
  if (!SIGNING_LINK.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && url.hostname === "afropuppyyoga.ca"
      && url.port === ""
      && url.username === ""
      && url.password === ""
      && url.pathname === "/sign"
      && url.hash === ""
      && Array.from(url.searchParams.keys()).length === 1
      && url.searchParams.get("token")?.length === 96;
  } catch {
    return false;
  }
}

function buildBody(input: OfferSigningSmsInput) {
  const role = safeText(input.role, 100) || "role";
  return `AfroPuppyYoga: Hi ${firstName(input.applicantName)}, please review and sign your ${role} offer letter and NDA on the same page: ${input.signingLink}. This link is private; do not forward it. Help: afropuppyyoga@gmail.com. Reply STOP to opt out.`;
}

function payloadHash(phone: string, body: string) {
  return createHash("sha256").update(phone + body).digest("hex");
}

function isDuplicateKeyError(error: unknown) {
  let current: unknown = error;
  for (let depth = 0; current && typeof current === "object" && depth < 8; depth += 1) {
    const candidate = current as { code?: unknown; errno?: unknown; message?: unknown; cause?: unknown };
    if (candidate.code === "ER_DUP_ENTRY" || candidate.code === "23505"
      || candidate.errno === 1062 || candidate.code === 1062
      || /duplicate|unique constraint/i.test(String(candidate.message ?? ""))) return true;
    current = candidate.cause;
  }
  return false;
}

function isExplicitProviderRejection(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { status?: unknown };
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
  return status === "processing" ? "unknown" : publicStatus(status);
}

function safeProviderMessageId(value: unknown) {
  if (typeof value !== "string") return undefined;
  const sid = value.trim();
  return /^SM[A-Za-z0-9]{1,62}$/.test(sid) ? sid : undefined;
}

export async function sendOfferSigningSms(input: OfferSigningSmsInput): Promise<InterviewInviteSmsResult> {
  let phone: string | null = null;
  try {
    if (!isValidSigningLink(input.signingLink)) {
      return { status: "failed", reason: "Offer signing link is invalid.", phone: null };
    }

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
    const fingerprint = payloadHash(phone, body);
    const idempotencyKey = `offer-sms:${input.applicationId}:${input.requestKey}`;
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
        subject: fingerprint,
        bodyPreview: BODY_PREVIEW,
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

        if (!existing || existing.recipient !== phone || existing.subject !== fingerprint) {
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
      providerMessageId = safeProviderMessageId(message.sid);
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
