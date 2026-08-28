/**
 * Class Cancellation Router
 *
 * When a class is cancelled, EVERY registered attendee receives ALL THREE:
 *   1. Phone call (TTS via Twilio)
 *   2. SMS (via Twilio)
 *   3. Email (via Gmail/Nodemailer)
 *
 * All three are fired in parallel per guest.
 * Results and statuses are logged to the callLogs table.
 *
 * Only accessible to admin/staff roles.
 */
import { TRPCError } from "@trpc/server";
import { randomBytes } from "crypto";
import { desc, eq } from "drizzle-orm";
import twilio from "twilio";
import { z } from "zod";

import { getDb } from "../db";
import { callLogs, cancellationCredits } from "../../drizzle/schema";
import { staffProcedure, router } from "../_core/trpc";
import { sendClassCancellationEmail } from "../email";
import { getTwilioWebhookUrl } from "../twilioWebhook";
import { createCappedCalendarRebookingCoupon } from "../lumaCalendarCoupon";
import { isSmsSuppressed } from "../smsConsent";

const LUMA_BASE = "https://public-api.luma.com/v1";
const IN_FLIGHT_TWILIO_STATUSES = new Set(["accepted", "queued", "sending", "sent", "in-progress", "ringing"]);

export function isInFlightTwilioStatus(status: string | null | undefined): boolean {
  return !!status && IN_FLIGHT_TWILIO_STATUSES.has(status.toLowerCase());
}

export function createCancellationCode() {
  return `APY-${randomBytes(7).toString("hex").toUpperCase()}`;
}

async function setLumaRegistrationOpen(eventId: string, registrationOpen: boolean) {
  const apiKey = process.env.LUMA_API_KEY;
  if (!apiKey) throw new Error("LUMA_API_KEY is not set");
  const response = await fetch(`${LUMA_BASE}/events/update`, {
    method: "POST",
    headers: { "x-luma-api-key": apiKey, "content-type": "application/json" },
    body: JSON.stringify({ event_id: eventId, registration_open: registrationOpen, suppress_notifications: true }),
  });
  if (!response.ok) throw new Error(`Luma registration update failed (${response.status})`);
}

/** Fetch all guests for a Luma event (handles pagination) */
async function fetchLumaGuests(eventApiId: string): Promise<
  Array<{ name: string; phone: string | null; email: string }>
> {
  const apiKey = process.env.LUMA_API_KEY;
  if (!apiKey) throw new Error("LUMA_API_KEY is not set");

  const guests: Array<{ name: string; phone: string | null; email: string }> = [];
  let cursor: string | null = null;

  do {
    const url = new URL(`${LUMA_BASE}/event/get-guests`);
    url.searchParams.set("event_api_id", eventApiId);
    url.searchParams.set("pagination_limit", "100");
    if (cursor) url.searchParams.set("pagination_cursor", cursor);

    const res = await fetch(url.toString(), {
      headers: { "x-luma-api-key": apiKey },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Luma API error ${res.status}: ${text}`);
    }
    const data = (await res.json()) as {
      entries: Array<{
        user_name?: string;
        name?: string;
        user_email?: string;
        email?: string;
        phone_number?: string | null;
        guest?: { phone_number?: string | null };
        approval_status?: string;
      }>;
      has_more: boolean;
      next_cursor: string | null;
    };

    for (const entry of data.entries) {
      // Only include guests who actually registered (approved).
      // Skip invited-but-not-registered and declined guests.
      if (entry.approval_status && entry.approval_status !== "approved") {
        continue;
      }
      const phone = entry.phone_number ?? entry.guest?.phone_number ?? null;
      guests.push({
        name: entry.user_name ?? entry.name ?? "Guest",
        phone,
        email: entry.user_email ?? entry.email ?? "",
      });
    }

    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);

  return guests;
}

/** Fetch upcoming events from Luma calendar */
async function fetchLumaEvents(): Promise<
  Array<{ api_id: string; name: string; start_at: string; geo_address_json?: { full_address?: string } }>
> {
  const apiKey = process.env.LUMA_API_KEY;
  if (!apiKey) throw new Error("LUMA_API_KEY is not set");

  const after = new Date().toISOString();
  const res = await fetch(`${LUMA_BASE}/calendar/list-events?pagination_limit=50&after=${encodeURIComponent(after)}`, {
    headers: { "x-luma-api-key": apiKey },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Luma API error ${res.status}: ${text}`);
  }
  const data = (await res.json()) as {
    entries: Array<{
      event: {
        api_id: string;
        name: string;
        start_at: string;
        geo_address_json?: { full_address?: string };
      };
    }>;
  };
  return data.entries.map((e) => e.event);
}

export const cancellationRouter = router({
  /** List upcoming Luma events for the cancel-class selector */
  listEvents: staffProcedure.query(async () => {
    const events = await fetchLumaEvents();
    return events.map((e) => ({
      apiId: e.api_id,
      name: e.name,
      startAt: e.start_at,
      address: e.geo_address_json?.full_address ?? "",
    }));
  }),

  /** Preview cancellation: fetch approved guests so admin can review before sending */
  previewCancellation: staffProcedure
    .input(
      z.object({
        eventApiId: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      const guests = await fetchLumaGuests(input.eventApiId);
      return {
        total: guests.length,
        guests: guests.map((g) => ({
          name: g.name,
          email: g.email,
          phone: g.phone,
          hasPhone: !!g.phone,
        })),
      };
    }),

  /** Cancel a class: send call + SMS + email to EVERY guest simultaneously */
  cancelClass: staffProcedure
    .input(
      z.object({
        eventApiId: z.string().min(1),
        eventName: z.string().min(1),
        /** Optional custom message override */
        customMessage: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromNumber = process.env.TWILIO_PHONE_NUMBER;

      if (!accountSid || !authToken || !fromNumber) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Twilio credentials are not configured",
        });
      }

      const client = twilio(accountSid, authToken);

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [existingCredit] = await db.select().from(cancellationCredits).where(eq(cancellationCredits.lumaEventId, input.eventApiId)).limit(1);
      if (existingCredit) throw new TRPCError({ code: "CONFLICT", message: `This class was already cancelled with credit ${existingCredit.couponCode}.` });

      const allEvents = await fetchLumaEvents();
      const cancelledEvent = allEvents.find((e) => e.api_id === input.eventApiId);
      if (!cancelledEvent) throw new TRPCError({ code: "NOT_FOUND", message: "That upcoming Luma event could not be found." });
      const canonicalEventName = cancelledEvent.name;
      const guests = await fetchLumaGuests(input.eventApiId);
      if (guests.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "This event has no approved guests to notify." });
      const rebookingCode = createCancellationCode();
      await setLumaRegistrationOpen(input.eventApiId, false);
      try {
        await createCappedCalendarRebookingCoupon(rebookingCode, guests.length, { apiKey: process.env.LUMA_API_KEY ?? "" });
      } catch (error) {
        await setLumaRegistrationOpen(input.eventApiId, true).catch((rollbackError) => console.error("[Cancellation] Could not reopen registration", rollbackError));
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `The free Luma rebooking code could not be created. No guest notifications were sent. ${error instanceof Error ? error.message : ""}`.trim(),
        });
      }
      const provisionedAt = new Date();
      await db.insert(cancellationCredits).values({ lumaEventId: input.eventApiId, eventName: canonicalEventName, couponCode: rebookingCode, maxUses: guests.length, registrationClosedAt: provisionedAt, couponCreatedAt: provisionedAt, createdByUserId: ctx.user.id });

      // ── Find next upcoming class (any location) ───────────────────────────
      const nextEvent = allEvents
        .filter((e) => e.api_id !== input.eventApiId && new Date(e.start_at) > new Date())
        .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())[0];

      const nextClassName = nextEvent?.name;
      const nextClassDate = nextEvent
        ? new Date(nextEvent.start_at).toLocaleDateString("en-CA", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })
        : undefined;

      // Voice message (TTS — slightly more formal for spoken delivery)
      const voiceMessage = input.customMessage
        ? `${input.customMessage} Please check your email for the free rebooking code ${rebookingCode}, valid across the AfroPuppyYoga calendar.`
        : `Hello, this is a message from AfroPuppyYoga. We regret to inform you that your upcoming class, ${canonicalEventName}, has been cancelled. We apologize for the inconvenience. Please check your email for your free rebooking code, valid across the AfroPuppyYoga calendar. Thank you for your understanding.`;

      // SMS message (concise for text — includes rebooking code and next class)
      const nextClassSmsHint = nextClassName && nextClassDate
        ? ` Our next class is ${nextClassName} on ${nextClassDate} — we'd love to see you there!`
        : " We'd love to see you at a future class at any of our locations — Hamilton, Kitchener & Oakville. Book at afropuppyyoga.ca.";

      const smsMessage = input.customMessage
        ? `${input.customMessage}\n\nUse free code ${rebookingCode} for 100% off any future APY class booked through our Luma calendar.`
        : `Hi from AfroPuppyYoga! Your class "${canonicalEventName}" has been cancelled. Sorry for the inconvenience! Use free code ${rebookingCode} for 100% off any future APY class booked through our Luma calendar.${nextClassSmsHint}`;
      const now = Date.now();

      const results: Array<{
        name: string;
        phone: string;
        callStatus: string;
        smsStatus: string;
        emailStatus: string;
        callSid?: string;
        smsSid?: string;
        error?: string;
      }> = [];

      // ── Process all guests in parallel (batches of 10 to avoid overwhelming Twilio) ──
      const BATCH_SIZE = 10;
      for (let i = 0; i < guests.length; i += BATCH_SIZE) {
        const batch = guests.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.allSettled(
          batch.map(async (guest) => {
            const smsSuppressed = guest.phone ? await isSmsSuppressed(guest.phone) : false;
            // ── 1. Phone call (only if phone number available) ──────────────────
            let callStatus = "skipped";
            let callSid: string | undefined;
            let callError: string | undefined;

            if (guest.phone) {
              try {
                const call = await client.calls.create({
                  to: guest.phone,
                  from: fromNumber,
                  twiml: `<Response><Say voice="Polly.Joanna">${voiceMessage}</Say></Response>`,
                  statusCallback: getTwilioWebhookUrl("/api/twilio/call-status"),
                  statusCallbackMethod: "POST",
                  statusCallbackEvent: ["completed", "no-answer", "busy", "failed", "canceled"],
                });
                callStatus = call.status ?? "queued";
                callSid = call.sid;
              } catch (err) {
                callStatus = "failed";
                callError = err instanceof Error ? err.message : String(err);
              }
            }

            // ── 2. SMS (only if phone number available) ──────────────────────────
            let smsStatus = "skipped";
            let smsSid: string | undefined;
            let smsError: string | undefined;

            if (smsSuppressed) {
              smsStatus = "suppressed";
            } else if (guest.phone) {
              try {
                const msg = await client.messages.create({
                  to: guest.phone,
                  from: fromNumber,
                  body: smsMessage,
                  statusCallback: getTwilioWebhookUrl("/api/twilio/sms-status"),
                });
                smsStatus = msg.status ?? "queued";
                smsSid = msg.sid;
              } catch (err) {
                smsStatus = "failed";
                smsError = err instanceof Error ? err.message : String(err);
              }
            }

            // ── 3. Email (always sent if email available) ────────────────────────
            let emailStatus = "skipped";
            let emailError: string | undefined;

            if (guest.email) {
              try {
                await sendClassCancellationEmail({
                  to: guest.email,
                  guestName: guest.name,
                  eventName: canonicalEventName,
                  rebookingCode,
                  nextClassName,
                  nextClassDate,
                  customMessage: input.customMessage,
                });
                emailStatus = "sent";
              } catch (err) {
                emailStatus = "failed";
                emailError = err instanceof Error ? err.message : String(err);
              }
            }

            // ── Combine errors ───────────────────────────────────────────────────
            const combinedError = [callError, smsError, emailError].filter(Boolean).join(" | ") || undefined;

            // ── Log to database ──────────────────────────────────────────────────
            await db.insert(callLogs).values({
              lumaEventId: input.eventApiId,
              eventName: canonicalEventName,
              guestName: guest.name,
              phone: guest.phone ?? (guest.email ? `email:${guest.email}` : "N/A"),
              callSid,
              status: callStatus,
              smsSid,
              smsStatus,
              emailStatus,
              errorMessage: combinedError ?? null,
              calledAt: now,
            });

            return {
              name: guest.name,
              phone: guest.phone ?? (guest.email ? `email:${guest.email}` : "N/A"),
              callStatus,
              smsStatus,
              emailStatus,
              callSid,
              smsSid,
              error: combinedError,
            };
          })
        );

        // Collect results from this batch
        for (const r of batchResults) {
          if (r.status === "fulfilled") {
            results.push(r.value);
          } else {
            // Shouldn't happen since inner errors are caught, but just in case
            results.push({
              name: "Unknown",
              phone: "N/A",
              callStatus: "failed",
              smsStatus: "failed",
              emailStatus: "failed",
              error: r.reason instanceof Error ? r.reason.message : String(r.reason),
            });
          }
        }
      }

      const called = results.filter((r) => r.callStatus !== "skipped" && r.callStatus !== "failed").length;
      const texted = results.filter((r) => !["skipped", "failed", "suppressed"].includes(r.smsStatus)).length;
      const emailed = results.filter((r) => r.emailStatus === "sent").length;
      const failed = results.filter((r) =>
        r.callStatus === "failed" || r.smsStatus === "failed" || r.emailStatus === "failed"
      ).length;

      return { total: guests.length, called, texted, emailed, failed, results, rebookingCode, couponState: "created" as const, registrationClosed: true };
    }),

  /** Reconcile in-flight delivery records with Twilio when an admin refreshes the notification log. */
  syncDeliveryStatuses: staffProcedure
    .input(z.object({ eventApiId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      if (!accountSid || !authToken) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Twilio credentials are not configured" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const client = twilio(accountSid, authToken);
      const logs = await db
        .select()
        .from(callLogs)
        .where(eq(callLogs.lumaEventId, input.eventApiId))
        .orderBy(desc(callLogs.calledAt));

      let reviewed = 0;
      let updated = 0;
      const errors: string[] = [];

      for (const log of logs) {
        const changes: { status?: string; smsStatus?: string } = {};
        try {
          if (log.callSid && isInFlightTwilioStatus(log.status)) {
            reviewed += 1;
            const call = await client.calls(log.callSid).fetch();
            if (call.status && call.status !== log.status) changes.status = call.status;
          }
          if (log.smsSid && isInFlightTwilioStatus(log.smsStatus)) {
            reviewed += 1;
            const message = await client.messages(log.smsSid).fetch();
            if (message.status && message.status !== log.smsStatus) changes.smsStatus = message.status;
          }
          if (Object.keys(changes).length > 0) {
            await db.update(callLogs).set(changes).where(eq(callLogs.id, log.id));
            updated += 1;
          }
        } catch (error) {
          errors.push(error instanceof Error ? error.message : String(error));
        }
      }

      return { reviewed, updated, errors };
    }),

  /** Send a test SMS to verify Twilio is working */
  sendTestSms: staffProcedure
    .input(
      z.object({
        phone: z.string().min(10, "Phone number must be at least 10 digits"),
        message: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromNumber = process.env.TWILIO_PHONE_NUMBER;

      if (!accountSid || !authToken || !fromNumber) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Twilio credentials are not configured",
        });
      }

      const client = twilio(accountSid, authToken);

      // Normalize phone: ensure it starts with +1 for Canadian/US numbers
      let to = input.phone.replace(/\D/g, "");
      if (!to.startsWith("1")) to = "1" + to;
      to = "+" + to;
      if (await isSmsSuppressed(to)) throw new TRPCError({ code: "FORBIDDEN", message: "This number has opted out of APY text messages." });

      const body =
        input.message?.trim() ||
        "👋 Test message from AfroPuppyYoga! Your Twilio SMS integration is working correctly. 🐶";

      try {
        const msg = await client.messages.create({ to, from: fromNumber, body });
        return { success: true, sid: msg.sid, status: msg.status, to };
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }),

  /** Make a test call to verify Twilio voice is working */
  sendTestCall: staffProcedure
    .input(
      z.object({
        phone: z.string().min(10, "Phone number must be at least 10 digits"),
        message: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromNumber = process.env.TWILIO_PHONE_NUMBER;

      if (!accountSid || !authToken || !fromNumber) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Twilio credentials are not configured",
        });
      }

      const client = twilio(accountSid, authToken);

      // Normalize phone: ensure it starts with +1 for Canadian/US numbers
      let to = input.phone.replace(/\D/g, "");
      if (!to.startsWith("1")) to = "1" + to;
      to = "+" + to;

      const spokenMessage =
        input.message?.trim() ||
        "Hello! This is a test call from AfroPuppyYoga. Your Twilio voice integration is working correctly. Have a great day!";

      try {
        const call = await client.calls.create({
          to,
          from: fromNumber,
          twiml: `<Response><Say voice="Polly.Joanna">${spokenMessage}</Say></Response>`,
        });
        return { success: true, sid: call.sid, status: call.status, to };
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }),

  /** Get call logs for a specific event */
  getCallLogs: staffProcedure
    .input(z.object({ eventApiId: z.string().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = input.eventApiId
        ? await db
            .select()
            .from(callLogs)
            .where(eq(callLogs.lumaEventId, input.eventApiId))
            .orderBy(desc(callLogs.calledAt))
        : await db.select().from(callLogs).orderBy(desc(callLogs.calledAt)).limit(200);
      return rows;
    }),
});
