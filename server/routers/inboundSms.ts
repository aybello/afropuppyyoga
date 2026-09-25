/**
 * Inbound SMS Router
 *
 * Provides procedures for the admin SMS Inbox page:
 * - list: fetch all inbound SMS messages (newest first)
 * - markRead: mark a message as read
 * - markAllRead: mark all messages as read
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, desc, eq, lt } from "drizzle-orm";
import twilio from "twilio";
import { createHash } from "node:crypto";
import { staffProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { normalizeCanadianPhoneNumber } from "../../shared/phone";
import { isSmsSuppressed } from "../smsConsent";
import { communicationsLog, inboundSms, inboundSmsReplyLocks } from "../../drizzle/schema";

const RECENT_REPLY_DUPLICATE_GUARD_MS = 2 * 60 * 1000;

function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;
  if (!accountSid || !authToken || !fromNumber) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Twilio credentials are not configured." });
  }
  return { client: twilio(accountSid, authToken), fromNumber };
}

export function getInboundReplyBodyHash(body: string) {
  return createHash("sha256").update(body.trim()).digest("hex");
}

/** A client attempt ID identifies a retry; the database reply lock blocks other devices while it is unresolved. */
export function getInboundReplyIdempotencyKey(messageId: number, attemptId: string) {
  return `inbound_sms_reply:${messageId}:${attemptId}`;
}

/** Only a provider 4xx is a definite rejection. Timeouts can happen after acceptance. */
export function isDefinitiveTwilioRejection(error: unknown): boolean {
  const status = typeof error === "object" && error !== null && "status" in error
    ? Number((error as { status?: unknown }).status)
    : NaN;
  return Number.isInteger(status) && status >= 400 && status < 500;
}

export const inboundSmsRouter = router({
  list: staffProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(200).default(100),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const limit = input?.limit ?? 100;
      return db
        .select()
        .from(inboundSms)
        .orderBy(desc(inboundSms.receivedAt))
        .limit(limit);
    }),

  unreadCount: staffProcedure.query(async () => {
    const db = await getDb();
    if (!db) return 0;
    const rows = await db
      .select({ id: inboundSms.id })
      .from(inboundSms)
      .where(eq(inboundSms.isRead, 0));
    return rows.length;
  }),

  markRead: staffProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return;
      await db
        .update(inboundSms)
        .set({ isRead: 1 })
        .where(eq(inboundSms.id, input.id));
    }),

  markAllRead: staffProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) return;
    await db.update(inboundSms).set({ isRead: 1 }).where(eq(inboundSms.isRead, 0));
  }),

  /** Reads only the durable outcome for a reply request owned by this inbox message. */
  replyStatus: staffProcedure
    .input(z.object({ messageId: z.number().int().positive(), attemptId: z.string().uuid() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
      const idempotencyKey = getInboundReplyIdempotencyKey(input.messageId, input.attemptId);
      const [record] = await db.select({ deliveryStatus: communicationsLog.deliveryStatus })
        .from(communicationsLog)
        .where(and(eq(communicationsLog.idempotencyKey, idempotencyKey), eq(communicationsLog.action, "inbound_reply")))
        .limit(1);
      return record ? { found: true, deliveryStatus: record.deliveryStatus } : { found: false, deliveryStatus: null };
    }),

  /** Reply from the APY business number to the exact sender of an inbox message. */
  reply: staffProcedure
    .input(z.object({
      messageId: z.number().int().positive(),
      body: z.string().trim().min(1, "Reply cannot be empty").max(1600, "Reply is too long"),
      attemptId: z.string().uuid(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });

      const [inbound] = await db.select().from(inboundSms).where(eq(inboundSms.id, input.messageId)).limit(1);
      if (!inbound) throw new TRPCError({ code: "NOT_FOUND", message: "This inbound SMS no longer exists." });

      const to = normalizeCanadianPhoneNumber(inbound.fromPhone);
      if (!to) throw new TRPCError({ code: "BAD_REQUEST", message: "The sender's phone number is not valid." });
      if (await isSmsSuppressed(to)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "This number has opted out of APY text messages." });
      }
      // Validate credentials before reserving a reply. Once a reply is claimed, retries
      // fail closed because an upstream timeout can still mean Twilio accepted the SMS.
      const { client, fromNumber } = getTwilioClient();

      const bodyHash = getInboundReplyBodyHash(input.body);
      const idempotencyKey = getInboundReplyIdempotencyKey(inbound.id, input.attemptId);
      const lockValues = {
        inboundSmsId: inbound.id,
        idempotencyKey,
        bodyHash,
      };
      try {
        await db.insert(inboundSmsReplyLocks).values(lockValues);
      } catch {
        const [existingLock] = await db.select({
          idempotencyKey: inboundSmsReplyLocks.idempotencyKey,
          createdAt: inboundSmsReplyLocks.createdAt,
        }).from(inboundSmsReplyLocks).where(eq(inboundSmsReplyLocks.inboundSmsId, inbound.id)).limit(1);
        const [existingReply] = existingLock
          ? await db.select({ deliveryStatus: communicationsLog.deliveryStatus })
            .from(communicationsLog)
            .where(eq(communicationsLog.idempotencyKey, existingLock.idempotencyKey))
            .limit(1)
          : [];
        const isRecentTerminalReply = Boolean(
          existingLock
          && existingReply
          && existingReply.deliveryStatus !== "processing"
          && existingReply.deliveryStatus !== "failed"
          && existingLock.createdAt.getTime() > Date.now() - RECENT_REPLY_DUPLICATE_GUARD_MS,
        );
        if (!existingLock || !existingReply || existingReply.deliveryStatus === "processing" || isRecentTerminalReply) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A reply to this message is already being processed, has an unknown delivery outcome, or was just sent. No duplicate SMS will be sent.",
          });
        }

        // A terminal reply that is more than two minutes old can make room for a genuine follow-up.
        await db.delete(inboundSmsReplyLocks).where(and(
          eq(inboundSmsReplyLocks.inboundSmsId, inbound.id),
          lt(inboundSmsReplyLocks.createdAt, new Date(Date.now() - RECENT_REPLY_DUPLICATE_GUARD_MS)),
        ));
        try {
          await db.insert(inboundSmsReplyLocks).values(lockValues);
        } catch {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A reply to this message is already being processed or was just sent. No duplicate SMS will be sent.",
          });
        }
      }
      try {
        await db.insert(communicationsLog).values({
          entityType: inbound.breederId ? "breeder" : "general",
          entityId: inbound.breederId,
          channel: "sms",
          direction: "outbound",
          action: "inbound_reply",
          recipient: to,
          bodyPreview: input.body.slice(0, 1000),
          deliveryStatus: "processing",
          idempotencyKey,
          actorUserId: ctx.user.id,
          actorName: ctx.user.name,
        });
      } catch {
        await db.delete(inboundSmsReplyLocks).where(eq(inboundSmsReplyLocks.inboundSmsId, inbound.id)).catch((lockError) => {
          console.error("[SMS Inbox] Failed to release reply lock after claim failure", lockError);
        });
        throw new TRPCError({
          code: "CONFLICT",
          message: "This reply is already being processed or was already sent. Refresh the SMS Inbox before sending again.",
        });
      }

      let sent: { sid: string; status: string };
      try {
        sent = await client.messages.create({ to, from: fromNumber, body: input.body });
      } catch (error) {
        if (isDefinitiveTwilioRejection(error)) {
          await Promise.allSettled([
            db.update(communicationsLog).set({ deliveryStatus: "failed" }).where(eq(communicationsLog.idempotencyKey, idempotencyKey)),
            db.delete(inboundSmsReplyLocks).where(eq(inboundSmsReplyLocks.inboundSmsId, inbound.id)),
          ]);
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error instanceof Error ? error.message : "Twilio rejected the SMS reply.",
          });
        }
        // Keep the claim processing. We cannot know whether Twilio accepted the SMS
        // after a timeout or connection drop, so retries must fail closed.
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Twilio did not confirm the reply outcome. Do not send it again; the SMS Inbox will keep this request protected from duplicates.",
        });
      }

      const auditResults = await Promise.allSettled([
        db.update(communicationsLog).set({ deliveryStatus: sent.status, providerMessageId: sent.sid }).where(eq(communicationsLog.idempotencyKey, idempotencyKey)),
        db.update(inboundSms).set({ isRead: 1 }).where(eq(inboundSms.id, inbound.id)),
      ]);
      if (auditResults.some((result) => result.status === "rejected")) {
        // Twilio accepted the SMS. Preserve that fact rather than returning a failure
        // that might tempt an operator to send the same reply again.
        console.error("[SMS Inbox] Reply accepted by Twilio but local audit update failed", auditResults);
      }
      return { success: true, to, sid: sent.sid, status: sent.status };
    }),
});
