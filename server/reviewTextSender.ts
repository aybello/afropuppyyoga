/**
 * Post-Class Google Review SMS Sender
 *
 * Called by heartbeat every 30 minutes.
 * Finds Luma events that ended between 1.5h and 2.5h ago (a 1-hour window centred on 2h post-class).
 * Fetches all registered guests (approval_status = "approved" or registered_at non-null).
 * Sends each guest a personalised Google review request via Twilio SMS.
 * Logs every send attempt to reviewTextLogs — unique on (lumaEventId, lumaGuestId) prevents duplicates.
 */

import { getDb } from "./db";
import { reviewTextLogs } from "../drizzle/schema";
import { and, eq } from "drizzle-orm";

const GOOGLE_REVIEW_URL = "https://g.page/r/CYyqTsuYY7oGEBM/review";
const LUMA_BASE = "https://api.lu.ma/public/v1";

interface LumaEvent {
  api_id: string;
  name: string;
  start_at: string;
  end_at: string;
}

interface LumaGuest {
  api_id: string;
  user_first_name?: string | null;
  user_last_name?: string | null;
  user_email?: string | null;
  phone_number?: string | null;
  approval_status?: string | null;
  registered_at?: string | null;
}

async function fetchRecentEndedEvents(apiKey: string): Promise<LumaEvent[]> {
  // Fetch events from the past 24 hours to find ones that ended ~2h ago
  const after = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const url = new URL(`${LUMA_BASE}/calendar/list-events`);
  url.searchParams.set("pagination_limit", "50");
  url.searchParams.set("after", after);

  const res = await fetch(url.toString(), {
    headers: { "x-luma-api-key": apiKey },
  });
  if (!res.ok) throw new Error(`Luma list-events failed: ${res.status}`);
  const data = await res.json() as { entries: LumaEvent[] };
  return data.entries ?? [];
}

async function fetchAllGuests(apiKey: string, eventId: string): Promise<LumaGuest[]> {
  const guests: LumaGuest[] = [];
  let cursor: string | undefined;

  do {
    const url = new URL(`${LUMA_BASE}/event/get-guests`);
    url.searchParams.set("event_api_id", eventId);
    url.searchParams.set("pagination_limit", "100");
    if (cursor) url.searchParams.set("pagination_cursor", cursor);

    const res = await fetch(url.toString(), {
      headers: { "x-luma-api-key": apiKey },
    });
    if (!res.ok) {
      console.error(`[ReviewText] Luma get-guests failed for ${eventId}: ${res.status}`);
      break;
    }
    const data = await res.json() as { entries: LumaGuest[]; has_more?: boolean; next_cursor?: string };
    guests.push(...(data.entries ?? []));
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);

  return guests;
}

async function sendSms(to: string, body: string): Promise<{ sid: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const auth = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_PHONE_NUMBER!;

  const params = new URLSearchParams();
  params.append("To", to);
  params.append("From", from);
  params.append("Body", body);

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${sid}:${auth}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const data = await res.json() as { sid?: string; message?: string };
  if (!data.sid) throw new Error(data.message ?? "Twilio error");
  return { sid: data.sid };
}

function normalisePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  // Already E.164 (Luma returns +1XXXXXXXXXX)
  if (phone.startsWith("+")) return phone;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export async function reviewTextSender(): Promise<{ sent: number; skipped: number; errors: number }> {
  const apiKey = process.env.LUMA_API_KEY;
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_PHONE_NUMBER;

  if (!apiKey || !twilioSid || !twilioAuth || !twilioFrom) {
    console.error("[ReviewText] Missing required env vars — skipping");
    return { sent: 0, skipped: 0, errors: 0 };
  }

  const db = await getDb();
  if (!db) {
    console.error("[ReviewText] DB unavailable — skipping");
    return { sent: 0, skipped: 0, errors: 0 };
  }

  let sent = 0;
  let skipped = 0;
  let errors = 0;

  const now = Date.now();
  // Target window: events that ended between 1.5h and 2.5h ago
  const windowStart = now - 2.5 * 60 * 60 * 1000;
  const windowEnd = now - 1.5 * 60 * 60 * 1000;

  let events: LumaEvent[];
  try {
    events = await fetchRecentEndedEvents(apiKey);
  } catch (err) {
    console.error("[ReviewText] Failed to fetch events:", err);
    return { sent: 0, skipped: 0, errors: 1 };
  }

  // Filter to events whose end_at falls in the 2h window
  const targetEvents = events.filter((e) => {
    if (!e.end_at) return false;
    const endMs = Date.parse(e.end_at);
    return endMs >= windowStart && endMs <= windowEnd;
  });

  console.log(`[ReviewText] Found ${targetEvents.length} event(s) in the 2h window`);

  for (const event of targetEvents) {
    console.log(`[ReviewText] Processing event: ${event.name} (${event.api_id})`);

    let guests: LumaGuest[];
    try {
      guests = await fetchAllGuests(apiKey, event.api_id);
    } catch (err) {
      console.error(`[ReviewText] Failed to fetch guests for ${event.api_id}:`, err);
      errors++;
      continue;
    }

    // Only send to guests who registered (have a registered_at or approval_status approved/going)
    const eligibleGuests = guests.filter((g) =>
      g.registered_at || g.approval_status === "approved" || g.approval_status === "going"
    );

    console.log(`[ReviewText] ${eligibleGuests.length} eligible guests for ${event.api_id}`);

    for (const guest of eligibleGuests) {
      const phone = normalisePhone(guest.phone_number);
      if (!phone) {
        console.log(`[ReviewText] No phone for guest ${guest.api_id} — skipping`);
        skipped++;
        continue;
      }

      // Check if already sent to this guest for this event
      const existing = await db
        .select({ id: reviewTextLogs.id })
        .from(reviewTextLogs)
        .where(
          and(
            eq(reviewTextLogs.lumaEventId, event.api_id),
            eq(reviewTextLogs.lumaGuestId, guest.api_id)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        skipped++;
        continue;
      }

      const firstName = guest.user_first_name ?? "there";
      const message = `Hi ${firstName}! 🐾 Thank you for joining us at AfroPuppyYoga today — we hope the puppies made your day a little brighter! If you had a great time, we'd love it if you shared your experience on Google. It only takes a minute and helps us so much: ${GOOGLE_REVIEW_URL} 💛`;

      let smsSid: string | undefined;
      let status = "sent";
      let errorMessage: string | undefined;

      try {
        const result = await sendSms(phone, message);
        smsSid = result.sid;
        sent++;
        console.log(`[ReviewText] Sent to ${firstName} (${phone}) — SID: ${smsSid}`);
      } catch (err: any) {
        status = "failed";
        errorMessage = err?.message ?? "Unknown error";
        errors++;
        console.error(`[ReviewText] Failed to send to ${phone}:`, errorMessage);
      }

      // Log the attempt regardless of success/failure
      try {
        await db.insert(reviewTextLogs).values({
          lumaEventId: event.api_id,
          lumaGuestId: guest.api_id,
          eventName: event.name,
          eventEndAt: event.end_at,
          guestName: `${guest.user_first_name ?? ""} ${guest.user_last_name ?? ""}`.trim() || "Unknown",
          guestEmail: guest.user_email ?? null,
          phone,
          smsSid: smsSid ?? null,
          status,
          errorMessage: errorMessage ?? null,
          sentAt: Date.now(),
        });
      } catch (dbErr) {
        console.error("[ReviewText] Failed to log send:", dbErr);
      }

      // Small delay to avoid Twilio rate limits
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  console.log(`[ReviewText] Done — sent: ${sent}, skipped: ${skipped}, errors: ${errors}`);
  return { sent, skipped, errors };
}
