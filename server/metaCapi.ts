/**
 * Meta Conversions API Integration
 *
 * Architecture (Path B — email-only matching):
 *   1. lumaPoller()  — calls Luma get-guests on all upcoming/recent events,
 *      inserts new paid registrations as `pending` rows in metaConversionEvents.
 *   2. capiSender()  — picks up `pending` rows, hashes PII, POSTs to Meta CAPI,
 *      marks rows `sent` or `failed` (retried up to 3 times).
 *
 * Idempotency: lumaGuestId UNIQUE constraint prevents duplicate rows.
 * Free tickets: rows with amountCents <= 0 are inserted as `skipped`.
 */

import crypto from "crypto";
import { getDb } from "./db";
import { metaConversionEvents } from "../drizzle/schema";
import { eq, and, gt, lt } from "drizzle-orm";

// ─── PII Hashing ─────────────────────────────────────────────────────────────

/**
 * SHA-256 hash a string after normalisation.
 * Returns hex string or null if input is empty.
 */
function sha256(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalised = value.trim().toLowerCase();
  if (!normalised) return null;
  return crypto.createHash("sha256").update(normalised).digest("hex");
}

/**
 * Normalise a phone number to digits-only WITH country code, per Meta's
 * customer-information matching spec (e.g. "14165551234", never "4165551234").
 * Meta hashes phones including the country code; hashing without it produces
 * a different digest and the phone signal silently never matches.
 * 10-digit numbers are assumed North American and prefixed with "1".
 * Returns null if the result is fewer than 7 digits.
 */
function normalisePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return null;
  // Add NANP country code to bare 10-digit numbers; keep it if already present
  const normalised = digits.length === 10 ? `1${digits}` : digits;
  return normalised;
}

export function hashUserData(guest: {
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}) {
  return {
    hashedEmail: sha256(guest.email),
    hashedPhone: sha256(normalisePhone(guest.phone)),
    hashedFirstName: sha256(guest.firstName),
    hashedLastName: sha256(guest.lastName),
  };
}

// ─── Luma Poller ─────────────────────────────────────────────────────────────

interface LumaEvent {
  id: string;
  name: string;
  start_at: string;
}

interface LumaGuest {
  api_id: string;
  user_email?: string | null;
  user_first_name?: string | null;
  user_last_name?: string | null;
  phone_number?: string | null;
  registered_at: string;
  utm_source?: string | null;
  utm_content?: string | null;
  event_ticket?: {
    amount: number;
    currency: string;
    is_captured: boolean;
  } | null;
}

export function extractMetaBrowserIds(utmContent: string | null | undefined): {
  fbc: string | null;
  fbp: string | null;
} {
  const metaIdPattern = /^fb\.\d+\.\d+\.[A-Za-z0-9._-]+$/;
  const values = new Map<string, string>();
  for (const segment of (utmContent ?? "").split("|")) {
    const separator = segment.indexOf("=");
    if (separator < 0) continue;
    const key = segment.slice(0, separator);
    const value = segment.slice(separator + 1);
    if ((key === "apy_fbc" || key === "apy_fbp") && value.length <= 255 && metaIdPattern.test(value)) {
      values.set(key, value);
    }
  }
  return {
    fbc: values.get("apy_fbc") ?? null,
    fbp: values.get("apy_fbp") ?? null,
  };
}

/** Meta rejects Purchase events with event_time older than 7 days. */
const META_EVENT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

async function fetchLumaEvents(apiKey: string): Promise<LumaEvent[]> {
  // Only fetch events starting within the last 7 days or in the future.
  // Without this window, the first production run ingests the entire event
  // history, and the sender then submits months-old purchases that Meta
  // rejects one by one — burning every retry and filling the table with
  // `failed` rows before the first real sale ever sends.
  const after = new Date(Date.now() - META_EVENT_MAX_AGE_MS).toISOString();
  const url = new URL("https://api.lu.ma/public/v1/calendar/list-events");
  url.searchParams.set("pagination_limit", "100");
  url.searchParams.set("after", after);

  const res = await fetch(url.toString(), {
    headers: { "x-luma-api-key": apiKey },
  });
  if (!res.ok) throw new Error(`Luma list-events failed: ${res.status}`);
  const data = await res.json() as { entries: Array<{ id: string; name: string; start_at: string }> };

  // Defence in depth: re-filter locally in case the API ignores `after`.
  const cutoff = Date.now() - META_EVENT_MAX_AGE_MS;
  return (data.entries ?? []).filter(e => {
    const startMs = Date.parse(e.start_at);
    return Number.isNaN(startMs) ? false : startMs >= cutoff;
  });
}

async function fetchLumaGuests(apiKey: string, eventId: string): Promise<LumaGuest[]> {
  const guests: LumaGuest[] = [];
  let cursor: string | undefined;

  do {
    const url = new URL("https://api.lu.ma/public/v1/event/get-guests");
    url.searchParams.set("event_api_id", eventId);
    url.searchParams.set("pagination_limit", "100");
    if (cursor) url.searchParams.set("pagination_cursor", cursor);

    const res = await fetch(url.toString(), {
      headers: { "x-luma-api-key": apiKey },
    });
    if (!res.ok) {
      console.error(`[MetaCAPI] Luma get-guests failed for ${eventId}: ${res.status}`);
      break;
    }
    const data = await res.json() as {
      entries: LumaGuest[];
      has_more?: boolean;
      next_cursor?: string;
    };
    guests.push(...(data.entries ?? []));
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);

  return guests;
}

/**
 * Poll all Luma events and insert new paid guest registrations as pending rows.
 * Skips free/comped tickets (amount <= 0).
 * Idempotent — duplicate lumaGuestId rows are silently ignored.
 */
export async function lumaPoller(): Promise<{ inserted: number; skipped: number; errors: number }> {
  const apiKey = process.env.LUMA_API_KEY;
  if (!apiKey) {
    console.error("[MetaCAPI] LUMA_API_KEY not set — poller skipped");
    return { inserted: 0, skipped: 0, errors: 0 };
  }

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  let events: LumaEvent[];
  try {
    events = await fetchLumaEvents(apiKey);
  } catch (err) {
    console.error("[MetaCAPI] Failed to fetch Luma events:", err);
    return { inserted: 0, skipped: 0, errors: 1 };
  }

  for (const event of events) {
    let guests: LumaGuest[];
    try {
      guests = await fetchLumaGuests(apiKey, event.id);
    } catch (err) {
      console.error(`[MetaCAPI] Failed to fetch guests for event ${event.id}:`, err);
      errors++;
      continue;
    }

    for (const guest of guests) {
      try {
        const ticket = guest.event_ticket;
        const amountCents = ticket?.amount ?? 0;
        const currency = ticket?.currency ?? "cad";
        const isCaptured = ticket?.is_captured ?? false;

        // Skip free/comped tickets or uncaptured payments
        const status = (amountCents <= 0 || !isCaptured) ? "skipped" : "pending";

        const hashes = hashUserData({
          email: guest.user_email,
          phone: guest.phone_number,
          firstName: guest.user_first_name,
          lastName: guest.user_last_name,
        });

        const dbInst = await getDb();
        if (!dbInst) { errors++; continue; }
        await dbInst.insert(metaConversionEvents).values({
          lumaGuestId: guest.api_id,
          lumaEventId: event.id,
          lumaEventName: event.name,
          amountCents,
          currency,
          lumaRegisteredAt: new Date(guest.registered_at).getTime(),
          hashedEmail: hashes.hashedEmail,
          hashedPhone: hashes.hashedPhone,
          hashedFirstName: hashes.hashedFirstName,
          hashedLastName: hashes.hashedLastName,
          // Luma's UTM content is the bridge that carries Meta's fbc/fbp
          // through the off-domain checkout. Existing rows without it remain
          // matchable by hashed email/phone.
          utmSource: guest.utm_content?.includes("apy_fb")
            ? guest.utm_content.slice(0, 255)
            : guest.utm_source?.slice(0, 255) ?? null,
          status,
        }).onDuplicateKeyUpdate({
          // On conflict, only update mutable fields — never overwrite status/hashes
          // This effectively makes the insert idempotent
          set: { lumaEventName: event.name },
        });

        if (status === "skipped") skipped++;
        else inserted++;
      } catch (err) {
        // Log but don't crash the whole poller
        console.error(`[MetaCAPI] Error inserting guest ${guest.api_id}:`, err);
        errors++;
      }
    }
  }

  console.log(`[MetaCAPI] Poller complete — inserted: ${inserted}, skipped: ${skipped}, errors: ${errors}`);
  return { inserted, skipped, errors };
}

// ─── Meta CAPI Sender ─────────────────────────────────────────────────────────

const DEFAULT_META_GRAPH_API_VERSION = "v25.0";
const MAX_ATTEMPTS = 3;
const PROCESSING_LEASE_MS = 15 * 60 * 1000;
// Rows sent before this repair may have been diverted into Meta Test Events.
// Requeueing them once is safe because the stable event_id lets Meta dedupe any
// event that had already reached the production dataset.
const PRODUCTION_REPLAY_CUTOFF = new Date("2026-09-07T05:10:00.000Z");

// Status values used in the DB
// pending    → not yet claimed by any sender run
// processing → claimed by this run (prevents double-send if two runs overlap)
// sent       → successfully sent to Meta
// failed     → exhausted MAX_ATTEMPTS retries
// skipped    → free ticket or event_time too old

export interface MetaCapiPayload {
  data: Array<{
    event_name: string;
    event_time: number;
    event_id: string;
    action_source: string;
    event_source_url: string;
    user_data: Record<string, string | null | undefined>;
    custom_data: {
      currency: string;
      value: number;
      content_name?: string;
    };
  }>;
  test_event_code?: string;
}

export function resolveMetaCapiRuntimeConfig(env: NodeJS.ProcessEnv = process.env) {
  const paused = env.META_CAPI_PAUSED === "true";
  const testMode = env.META_CAPI_TEST_MODE === "true";
  const testEventCode = testMode ? env.META_TEST_EVENT_CODE : undefined;

  return {
    paused,
    testMode,
    testEventCode,
    graphApiVersion: env.META_GRAPH_API_VERSION || DEFAULT_META_GRAPH_API_VERSION,
  };
}

function affectedRows(result: unknown): number {
  if (Array.isArray(result)) {
    return Number((result[0] as { affectedRows?: number } | undefined)?.affectedRows ?? 0);
  }
  return Number((result as { affectedRows?: number } | undefined)?.affectedRows ?? 0);
}

function eventSourceUrl(eventName: string | null): string {
  const name = (eventName ?? "").toLowerCase();
  if (name.includes("kitchener") || name.includes("waterloo")) {
    return "https://afropuppyyoga.ca/kitchener";
  }
  if (name.includes("oakville")) return "https://afropuppyyoga.ca/oakville";
  if (name.includes("hamilton")) return "https://afropuppyyoga.ca/hamilton";
  return "https://afropuppyyoga.ca/";
}

export function buildMetaPurchasePayload(
  row: {
    lumaGuestId: string;
    lumaEventId: string;
    lumaEventName: string | null;
    amountCents: number;
    currency: string;
    lumaRegisteredAt: number;
    hashedEmail: string | null;
    hashedPhone: string | null;
    hashedFirstName: string | null;
    hashedLastName: string | null;
    utmSource: string | null;
  },
  testEventCode?: string,
): MetaCapiPayload {
  const userData: Record<string, string | null | undefined> = {};
  if (row.hashedEmail) userData.em = row.hashedEmail;
  if (row.hashedPhone) userData.ph = row.hashedPhone;
  if (row.hashedFirstName) userData.fn = row.hashedFirstName;
  if (row.hashedLastName) userData.ln = row.hashedLastName;
  const browserIds = extractMetaBrowserIds(row.utmSource);
  // Meta requires fbc/fbp in their original plaintext form (never hashed).
  if (browserIds.fbc) userData.fbc = browserIds.fbc;
  if (browserIds.fbp) userData.fbp = browserIds.fbp;

  const eventId = `apy_purchase_${row.lumaGuestId}`;
  return {
    data: [
      {
        event_name: "Purchase",
        event_time: Math.floor(row.lumaRegisteredAt / 1000),
        event_id: eventId,
        action_source: "website",
        event_source_url: eventSourceUrl(row.lumaEventName),
        user_data: userData,
        custom_data: {
          currency: row.currency.toUpperCase(),
          value: row.amountCents / 100,
          content_name: row.lumaEventName ?? "AfroPuppyYoga Class",
        },
      },
    ],
    ...(testEventCode ? { test_event_code: testEventCode } : {}),
  };
}

/**
 * Send pending CAPI events to Meta. Retries up to MAX_ATTEMPTS times.
 * Marks rows `sent` on success, `failed` after exhausting retries.
 */
export async function capiSender(): Promise<{ sent: number; failed: number; skipped: number }> {
  const pixelId = process.env.META_PIXEL_ID;
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN;
  const runtime = resolveMetaCapiRuntimeConfig();

  if (runtime.paused) {
    console.log("[MetaCAPI] META_CAPI_PAUSED is 'true' — sender skipped");
    return { sent: 0, failed: 0, skipped: 0 };
  }
  if (!pixelId || !accessToken) {
    console.error("[MetaCAPI] META_PIXEL_ID or META_CAPI_ACCESS_TOKEN not set — sender skipped");
    return { sent: 0, failed: 0, skipped: 0 };
  }

  if (process.env.META_CAPI_ENABLED === "false") {
    console.warn("[MetaCAPI] Ignoring deprecated META_CAPI_ENABLED=false; use META_CAPI_PAUSED=true for an intentional kill switch");
  }
  if (process.env.META_TEST_EVENT_CODE && !runtime.testMode) {
    console.warn("[MetaCAPI] META_TEST_EVENT_CODE is configured but test mode is off; sending real production events");
  }

  // Fetch pending rows (up to 50 per run) that haven't exceeded max attempts
  const dbInst = await getDb();
  if (!dbInst) {
    console.error("[MetaCAPI] Database not available — sender skipped");
    return { sent: 0, failed: 0, skipped: 0 };
  }

  await dbInst
    .update(metaConversionEvents)
    .set({
      status: "pending",
      attempts: 0,
      lastError: "Requeued by 2026-09 production-attribution repair",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(metaConversionEvents.status, "sent"),
        gt(metaConversionEvents.lumaRegisteredAt, Date.now() - META_EVENT_MAX_AGE_MS),
        lt(metaConversionEvents.updatedAt, PRODUCTION_REPLAY_CUTOFF),
      ),
    );

  // A process crash after claiming a row used to leave it in `processing`
  // forever. Reclaim only rows whose lease is stale; active senders retain
  // their rows for the full lease window.
  await dbInst
    .update(metaConversionEvents)
    .set({
      status: "pending",
      lastError: "Recovered after stale processing lease",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(metaConversionEvents.status, "processing" as any),
        lt(metaConversionEvents.updatedAt, new Date(Date.now() - PROCESSING_LEASE_MS)),
        lt(metaConversionEvents.attempts, MAX_ATTEMPTS),
      ),
    );

  const pendingRows = await dbInst
    .select()
    .from(metaConversionEvents)
    .where(
      and(
        eq(metaConversionEvents.status, "pending"),
        lt(metaConversionEvents.attempts, MAX_ATTEMPTS)
      )
    )
    .limit(50);

  if (pendingRows.length === 0) {
    return { sent: 0, failed: 0, skipped: 0 };
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of pendingRows) {
    // Claim one row at a time and trust the UPDATE's affected-row count. The
    // previous batch claim re-fetched every `processing` row by ID, including
    // rows another overlapping worker had claimed, which could double-send.
    const claimResult = await dbInst
      .update(metaConversionEvents)
      .set({ status: "processing" as any, updatedAt: new Date() })
      .where(
        and(
          eq(metaConversionEvents.id, row.id),
          eq(metaConversionEvents.status, "pending"),
        ),
      );
    if (affectedRows(claimResult) !== 1) continue;

    const payload = buildMetaPurchasePayload(row, runtime.testEventCode);
    const userData = payload.data[0].user_data;

    // Meta rejects event_time older than 7 days. A guest can pass the event
    // window but still have registered weeks ago (early-bird ticket for an
    // upcoming class). Mark those skipped instead of burning retries.
    if (Date.now() - row.lumaRegisteredAt > META_EVENT_MAX_AGE_MS) {
      await dbInst
        .update(metaConversionEvents)
        .set({ status: "skipped", lastError: "event_time older than Meta 7-day limit", updatedAt: new Date() })
        .where(eq(metaConversionEvents.id, row.id));
      skipped++;
      continue;
    }

    // Skip if we have no identity signals at all
    if (!userData.em && !userData.ph) {
      await dbInst
        .update(metaConversionEvents)
        .set({ status: "skipped", lastError: "No email or phone matching signal", updatedAt: new Date() })
        .where(eq(metaConversionEvents.id, row.id));
      skipped++;
      continue;
    }

    const eventId = payload.data[0].event_id;

    try {
      // Security: send token in Authorization header, not as a URL query param.
      // URL query params appear in server logs, CDN logs, and browser history.
      const res = await fetch(
        `https://graph.facebook.com/${runtime.graphApiVersion}/${pixelId}/events`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
        }
      );

      const responseData = await res.json() as { events_received?: number; error?: { message: string } };

      if (!res.ok || responseData.error || (responseData.events_received ?? 0) < 1) {
        const errMsg = responseData.error?.message ?? (res.ok ? "Meta accepted zero events" : `HTTP ${res.status}`);
        console.error(`[MetaCAPI] CAPI send failed for ${row.lumaGuestId}: ${errMsg}`);
        const newAttempts = (row.attempts ?? 0) + 1;
        await dbInst
          .update(metaConversionEvents)
          .set({
            attempts: newAttempts,
            lastError: errMsg,
            status: newAttempts >= MAX_ATTEMPTS ? "failed" : "pending",
            updatedAt: new Date(),
          })
          .where(eq(metaConversionEvents.id, row.id));
        failed++;
      } else {
        await dbInst
          .update(metaConversionEvents)
          .set({
            status: "sent",
            attempts: (row.attempts ?? 0) + 1,
            metaEventId: eventId,
            sentAt: new Date(),
            lastError: null,
            updatedAt: new Date(),
          })
          .where(eq(metaConversionEvents.id, row.id));
        sent++;
        console.log(`[MetaCAPI] Sent Purchase event for guest ${row.lumaGuestId} — $${(row.amountCents / 100).toFixed(2)} ${row.currency.toUpperCase()}`);
      }
    } catch (err) {
      console.error(`[MetaCAPI] Network error for ${row.lumaGuestId}:`, err);
      const newAttempts = (row.attempts ?? 0) + 1;
      await dbInst
        .update(metaConversionEvents)
        .set({
          attempts: newAttempts,
          lastError: String(err),
          status: newAttempts >= MAX_ATTEMPTS ? "failed" : "pending",
          updatedAt: new Date(),
        })
        .where(eq(metaConversionEvents.id, row.id));
      failed++;
    }
  }

  console.log(`[MetaCAPI] Sender complete — sent: ${sent}, failed: ${failed}, skipped: ${skipped}`);
  return { sent, failed, skipped };
}

/**
 * Reconcile Luma purchases and immediately flush the resulting CAPI queue.
 * The separate sender schedule remains useful as a retry/backlog safety net.
 */
export async function syncMetaPurchases() {
  const poll = await lumaPoller();
  const send = await capiSender();
  return { poll, send };
}
