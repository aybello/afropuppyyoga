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
import { desc, eq } from "drizzle-orm";
import twilio from "twilio";
import { z } from "zod";

import { getDb } from "../db";
import { callLogs } from "../../drizzle/schema";
import { staffProcedure, router } from "../_core/trpc";
import { sendClassCancellationEmail } from "../email";

const LUMA_BASE = "https://public-api.luma.com/v1";

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
      }>;
      has_more: boolean;
      next_cursor: string | null;
    };

    for (const entry of data.entries) {
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

      // ── Generate rebooking code from event start date (MONTHDDAY format) ──
      const allEvents = await fetchLumaEvents();
      const cancelledEvent = allEvents.find((e) => e.api_id === input.eventApiId);
      const eventDate = cancelledEvent ? new Date(cancelledEvent.start_at) : new Date();
      const monthNames = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
      const rebookingCode = `${monthNames[eventDate.getMonth()]}${eventDate.getDate()}`;

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
      const voiceMessage =
        input.customMessage ??
        `Hello, this is a message from AfroPuppyYoga. We regret to inform you that your upcoming class, ${input.eventName}, has been cancelled. We apologize for the inconvenience. Please check your email for your rebooking credit code. Thank you for your understanding.`;

      // SMS message (concise for text — includes rebooking code and next class)
      const nextClassSmsHint = nextClassName && nextClassDate
        ? ` Our next class is ${nextClassName} on ${nextClassDate} — we'd love to see you there!`
        : " We'd love to see you at a future class at any of our locations — Hamilton, Kitchener & Oakville. Book at afropuppyyoga.ca.";

      const smsMessage =
        input.customMessage ??
        `Hi from AfroPuppyYoga! Your class "${input.eventName}" has been cancelled. Sorry for the inconvenience! Use code ${rebookingCode} for a credit on your next booking.${nextClassSmsHint}`;

      // ── Fetch all guests
      const guests = await fetchLumaGuests(input.eventApiId);
      const now = Date.now();

      // Build webhook callback URLs for real-time status updates
      const baseUrl = process.env.NODE_ENV === "production"
        ? "https://afropuppyyoga.ca"
        : `http://localhost:${process.env.PORT ?? 3000}`;

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

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      for (const guest of guests) {
        // ── 1. Phone call (only if phone number available) ──────────────────
        let callStatus = "skipped";
        let callSid: string | undefined;
        let callError: string | undefined;

        if (guest.phone) {
          const callResult = await Promise.allSettled([
            client.calls.create({
              to: guest.phone,
              from: fromNumber,
              twiml: `<Response><Say voice="Polly.Joanna">${voiceMessage}</Say></Response>`,
              statusCallback: `${baseUrl}/api/twilio/call-status`,
              statusCallbackMethod: "POST",
              statusCallbackEvent: ["completed", "no-answer", "busy", "failed", "canceled"],
            }),
          ]);
          const r = callResult[0];
          callStatus = r.status === "fulfilled" ? (r.value.status ?? "queued") : "failed";
          callSid = r.status === "fulfilled" ? r.value.sid : undefined;
          callError = r.status === "rejected"
            ? (r.reason instanceof Error ? r.reason.message : String(r.reason))
            : undefined;
        }

        // ── 2. SMS (only if phone number available) ──────────────────────────
        let smsStatus = "skipped";
        let smsSid: string | undefined;
        let smsError: string | undefined;

        if (guest.phone) {
          const smsResult = await Promise.allSettled([
            client.messages.create({
              to: guest.phone,
              from: fromNumber,
              body: smsMessage,
              statusCallback: `${baseUrl}/api/twilio/sms-status`,
            }),
          ]);
          const r = smsResult[0];
          smsStatus = r.status === "fulfilled" ? (r.value.status ?? "queued") : "failed";
          smsSid = r.status === "fulfilled" ? r.value.sid : undefined;
          smsError = r.status === "rejected"
            ? (r.reason instanceof Error ? r.reason.message : String(r.reason))
            : undefined;
        }

        // ── 3. Email (always sent if email available) ────────────────────────
        let emailStatus = "skipped";
        let emailError: string | undefined;

        if (guest.email) {
          try {
            await sendClassCancellationEmail({
              to: guest.email,
              guestName: guest.name,
              eventName: input.eventName,
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

        await db.insert(callLogs).values({
          lumaEventId: input.eventApiId,
          eventName: input.eventName,
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

        results.push({
          name: guest.name,
          phone: guest.phone ?? (guest.email ? `email:${guest.email}` : "N/A"),
          callStatus,
          smsStatus,
          emailStatus,
          callSid,
          smsSid,
          error: combinedError,
        });
      }

      const called = results.filter((r) => r.callStatus !== "skipped" && r.callStatus !== "failed").length;
      const texted = results.filter((r) => r.smsStatus !== "skipped" && r.smsStatus !== "failed").length;
      const emailed = results.filter((r) => r.emailStatus === "sent").length;
      const failed = results.filter((r) =>
        r.callStatus === "failed" || r.smsStatus === "failed" || r.emailStatus === "failed"
      ).length;

      return { total: guests.length, called, texted, emailed, failed, results };
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
