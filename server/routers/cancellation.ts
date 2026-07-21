/**
 * Class Cancellation Router
 *
 * Fetches all guests for a given Luma event, calls each one via Twilio
 * with a pre-recorded TTS cancellation message, and logs the results.
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

  const res = await fetch(`${LUMA_BASE}/calendar/list-events?pagination_limit=20`, {
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

  /** Cancel a class: call all guests with a Twilio TTS message */
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

      // Build the TTS message
      const message =
        input.customMessage ??
        `Hello, this is a message from AfroPuppyYoga. We regret to inform you that your upcoming class, ${input.eventName}, has been cancelled. We apologize for the inconvenience. Please visit afropuppyyoga.ca or check your email for rebooking options. Thank you for your understanding.`;

      // Fetch all guests
      const guests = await fetchLumaGuests(input.eventApiId);
      const now = Date.now();

      const results: Array<{
        name: string;
        phone: string;
        status: string;
        callSid?: string;
        error?: string;
      }> = [];

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      for (const guest of guests) {
        if (!guest.phone) {
          // Log as skipped — no phone number
          await db.insert(callLogs).values({
            lumaEventId: input.eventApiId,
            eventName: input.eventName,
            guestName: guest.name,
            phone: "N/A",
            status: "skipped",
            errorMessage: "No phone number on file",
            calledAt: now,
          });
          results.push({ name: guest.name, phone: "N/A", status: "skipped" });
          continue;
        }

        try {
          const call = await client.calls.create({
            to: guest.phone,
            from: fromNumber,
            twiml: `<Response><Say voice="Polly.Joanna">${message}</Say></Response>`,
          });

          await db.insert(callLogs).values({
            lumaEventId: input.eventApiId,
            eventName: input.eventName,
            guestName: guest.name,
            phone: guest.phone,
            callSid: call.sid,
            status: call.status ?? "queued",
            calledAt: now,
          });

          results.push({
            name: guest.name,
            phone: guest.phone,
            status: call.status ?? "queued",
            callSid: call.sid,
          });
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          await db.insert(callLogs).values({
            lumaEventId: input.eventApiId,
            eventName: input.eventName,
            guestName: guest.name,
            phone: guest.phone,
            status: "failed",
            errorMessage: errorMsg,
            calledAt: now,
          });
          results.push({
            name: guest.name,
            phone: guest.phone,
            status: "failed",
            error: errorMsg,
          });
        }
      }

      const called = results.filter((r) => r.status !== "skipped" && r.status !== "failed").length;
      const skipped = results.filter((r) => r.status === "skipped").length;
      const failed = results.filter((r) => r.status === "failed").length;

      return { total: guests.length, called, skipped, failed, results };
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
