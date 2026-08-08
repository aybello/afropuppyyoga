import { router, staffProcedure } from "../_core/trpc";

const LUMA_BASE = "https://public-api.luma.com/v1";

interface LumaEvent {
  api_id: string;
  name: string;
  start_at: string;
  end_at: string;
  url: string;
  geo_address_json?: { city?: string; full_address?: string };
}

interface LumaGuest {
  api_id: string;
  user_name: string;
  user_email: string;
  phone_number: string | null;
  approval_status: string;
  checked_in_at: string | null;
  registered_at: string;
  event_tickets: Array<{
    amount: number;
    amount_discount: number;
    amount_tax: number;
    currency: string;
    is_captured: boolean;
    name: string;
    checked_in_at: string | null;
  }>;
}

async function fetchAllEvents(apiKey: string, afterDate?: string): Promise<LumaEvent[]> {
  const events: LumaEvent[] = [];
  let cursor: string | null = null;
  do {
    const url = new URL(`${LUMA_BASE}/calendar/list-events`);
    url.searchParams.set("pagination_limit", "100");
    if (afterDate) url.searchParams.set("after", afterDate);
    if (cursor) url.searchParams.set("pagination_cursor", cursor);
    const res = await fetch(url.toString(), { headers: { "x-luma-api-key": apiKey } });
    if (!res.ok) break;
    const data = (await res.json()) as { entries: Array<{ event: LumaEvent }>; has_more: boolean; next_cursor: string | null };
    for (const entry of data.entries) {
      if (entry.event) events.push(entry.event);
    }
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);
  return events;
}

async function fetchEventGuests(apiKey: string, eventApiId: string): Promise<LumaGuest[]> {
  const guests: LumaGuest[] = [];
  let cursor: string | null = null;
  do {
    const url = new URL(`${LUMA_BASE}/event/get-guests`);
    url.searchParams.set("event_api_id", eventApiId);
    url.searchParams.set("pagination_limit", "100");
    if (cursor) url.searchParams.set("pagination_cursor", cursor);
    const res = await fetch(url.toString(), { headers: { "x-luma-api-key": apiKey } });
    if (!res.ok) break;
    const data = (await res.json()) as { entries: LumaGuest[]; has_more: boolean; next_cursor: string | null };
    for (const g of data.entries) {
      if (!g.approval_status || g.approval_status === "approved") guests.push(g);
    }
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);
  return guests;
}

function extractLocation(event: LumaEvent): string {
  const name = event.name ?? "";
  if (name.includes("Kitchener")) return "Kitchener";
  if (name.includes("Hamilton")) return "Hamilton";
  if (name.includes("Oakville")) return "Oakville";
  const city = event.geo_address_json?.city ?? "";
  if (city) return city;
  return "Other";
}

function isPrivateEvent(event: LumaEvent): boolean {
  const name = (event.name ?? "").toLowerCase();
  return name.includes("private") || name.includes("corporate");
}

export const revenueRouter = router({
  /** Get revenue summary for a date range — fetches all events and their bookings */
  getSummary: staffProcedure
    .input(z.object({
      fromDate: z.string().optional(), // ISO date "2026-01-01"
      toDate: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const apiKey = process.env.LUMA_API_KEY;
      if (!apiKey) throw new Error("LUMA_API_KEY not set");

      const afterDate = input.fromDate ? new Date(input.fromDate).toISOString() : "2025-01-01T00:00:00Z";
      const toTs = input.toDate ? new Date(input.toDate + "T23:59:59Z").getTime() : Date.now();

      const allEvents = await fetchAllEvents(apiKey, afterDate);

      // Filter to events within range and exclude future events beyond toDate
      const events = allEvents.filter(e => {
        const ts = new Date(e.start_at).getTime();
        return ts <= toTs;
      });

      // Fetch guests for all events in parallel (batched to avoid rate limits)
      const BATCH = 5;
      const eventRevenue: Array<{
        eventId: string;
        eventName: string;
        eventUrl: string;
        startAt: string;
        location: string;
        isPrivate: boolean;
        totalGuests: number;
        checkedIn: number;
        revenueCents: number;
        ticketBreakdown: Record<string, { count: number; revenueCents: number }>;
      }> = [];

      for (let i = 0; i < events.length; i += BATCH) {
        const batch = events.slice(i, i + BATCH);
        const results = await Promise.all(batch.map(async (ev) => {
          const guests = await fetchEventGuests(apiKey, ev.api_id);
          let revenueCents = 0;
          let checkedIn = 0;
          const ticketBreakdown: Record<string, { count: number; revenueCents: number }> = {};

          for (const g of guests) {
            if (g.checked_in_at) checkedIn++;
            for (const t of (g.event_tickets ?? [])) {
              if (t.is_captured) {
                const net = t.amount - t.amount_discount;
                revenueCents += net;
                const key = t.name || "Unknown";
                if (!ticketBreakdown[key]) ticketBreakdown[key] = { count: 0, revenueCents: 0 };
                ticketBreakdown[key].count++;
                ticketBreakdown[key].revenueCents += net;
              }
            }
          }

          return {
            eventId: ev.api_id,
            eventName: ev.name,
            eventUrl: ev.url,
            startAt: ev.start_at,
            location: extractLocation(ev),
            isPrivate: isPrivateEvent(ev),
            totalGuests: guests.length,
            checkedIn,
            revenueCents,
            ticketBreakdown,
          };
        }));
        eventRevenue.push(...results);
      }

      // Aggregate stats
      const totalRevenueCents = eventRevenue.reduce((s, e) => s + e.revenueCents, 0);
      const totalGuests = eventRevenue.reduce((s, e) => s + e.totalGuests, 0);
      const totalCheckedIn = eventRevenue.reduce((s, e) => s + e.checkedIn, 0);

      // Revenue by location
      const byLocation: Record<string, number> = {};
      for (const e of eventRevenue) {
        byLocation[e.location] = (byLocation[e.location] ?? 0) + e.revenueCents;
      }

      // Revenue by month
      const byMonth: Record<string, number> = {};
      for (const e of eventRevenue) {
        const month = e.startAt.slice(0, 7); // "2026-08"
        byMonth[month] = (byMonth[month] ?? 0) + e.revenueCents;
      }

      // Revenue by ticket type (time slot performance)
      const byTicketType: Record<string, { count: number; revenueCents: number }> = {};
      for (const e of eventRevenue) {
        for (const [key, val] of Object.entries(e.ticketBreakdown)) {
          if (!byTicketType[key]) byTicketType[key] = { count: 0, revenueCents: 0 };
          byTicketType[key].count += val.count;
          byTicketType[key].revenueCents += val.revenueCents;
        }
      }

      // Public vs private split
      const publicRevenue = eventRevenue.filter(e => !e.isPrivate).reduce((s, e) => s + e.revenueCents, 0);
      const privateRevenue = eventRevenue.filter(e => e.isPrivate).reduce((s, e) => s + e.revenueCents, 0);

      return {
        totalRevenueCents,
        totalGuests,
        totalCheckedIn,
        totalEvents: eventRevenue.length,
        publicRevenueCents: publicRevenue,
        privateRevenueCents: privateRevenue,
        byLocation,
        byMonth,
        byTicketType,
        events: eventRevenue.sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime()),
      };
    }),
});
import { z } from "zod";
