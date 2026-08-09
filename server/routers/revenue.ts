import { z } from "zod";
import { router, staffProcedure } from "../_core/trpc";

const LUMA_BASE = "https://public-api.luma.com/v1";
const APY_LAUNCH_DATE = "2024-08-22T00:00:00.000Z";
const REQUEST_BATCH_SIZE = 4;

interface LumaEvent {
  api_id: string;
  name: string;
  start_at: string;
  end_at?: string;
  url: string;
  visibility?: string;
  geo_address_json?: { city?: string; full_address?: string };
}

interface LumaTicket {
  amount?: number;
  amount_discount?: number;
  amount_tax?: number;
  currency?: string;
  is_captured?: boolean;
  name?: string;
  checked_in_at?: string | null;
}

interface LumaGuest {
  api_id: string;
  user_name?: string;
  user_email?: string;
  approval_status?: string;
  checked_in_at?: string | null;
  registered_at?: string;
  event_tickets?: LumaTicket[];
}

interface PaginatedResponse<T> {
  entries: T[];
  has_more: boolean;
  next_cursor: string | null;
}

async function lumaGet<T>(url: URL, apiKey: string, context: string): Promise<T> {
  const res = await fetch(url.toString(), {
    headers: { "x-luma-api-key": apiKey },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Luma ${context} failed (${res.status})${body ? `: ${body.slice(0, 180)}` : ""}`,
    );
  }

  return (await res.json()) as T;
}

async function fetchAllEvents(apiKey: string, afterDate: string): Promise<LumaEvent[]> {
  const events: LumaEvent[] = [];
  let cursor: string | null = null;

  do {
    const url = new URL(`${LUMA_BASE}/calendar/list-events`);
    url.searchParams.set("pagination_limit", "100");
    url.searchParams.set("after", afterDate);
    if (cursor) url.searchParams.set("pagination_cursor", cursor);

    const data = await lumaGet<PaginatedResponse<{ event: LumaEvent }>>(
      url,
      apiKey,
      "event list",
    );

    for (const entry of data.entries ?? []) {
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

    const data = await lumaGet<PaginatedResponse<LumaGuest>>(
      url,
      apiKey,
      `guest list for ${eventApiId}`,
    );

    for (const guest of data.entries ?? []) {
      if (!guest.approval_status || guest.approval_status === "approved") {
        guests.push(guest);
      }
    }

    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);

  return guests;
}

function normalizeCity(value?: string): string | null {
  if (!value) return null;
  const city = value.trim();
  if (!city) return null;

  const known = ["Kitchener", "Hamilton", "Oakville", "Waterloo", "Cambridge", "Milton", "Mississauga"];
  const match = known.find(k => city.toLowerCase().includes(k.toLowerCase()));
  return match ?? city;
}

function extractLocation(event: LumaEvent): string {
  const mappedCity = normalizeCity(event.geo_address_json?.city);
  if (mappedCity) return mappedCity;

  const haystack = `${event.name ?? ""} ${event.geo_address_json?.full_address ?? ""}`;
  for (const city of ["Kitchener", "Hamilton", "Oakville", "Waterloo", "Cambridge", "Milton", "Mississauga"]) {
    if (haystack.toLowerCase().includes(city.toLowerCase())) return city;
  }

  return "Other";
}

function classifyEvent(event: LumaEvent): "public" | "private" | "unknown" {
  const name = (event.name ?? "").toLowerCase();

  if (event.visibility === "private") return "private";
  if (/\b(private|corporate|team event|staff event|employee event)\b/.test(name)) return "private";
  if (/afropuppyyoga|puppy yoga/.test(name)) return "public";

  return "unknown";
}

function extractClassSlot(ticketName?: string): string | null {
  if (!ticketName) return null;
  const match = ticketName.match(/\b(\d{1,2}(?::\d{2})?\s?(?:AM|PM))\b/i);
  if (!match) return null;
  return match[1].replace(/\s+/g, "").toUpperCase();
}

function safeMoney(value?: number): number {
  return Number.isFinite(value) ? Math.max(0, Number(value)) : 0;
}

export const revenueRouter = router({
  getSummary: staffProcedure
    .input(
      z.object({
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const apiKey = process.env.LUMA_API_KEY;
      if (!apiKey) throw new Error("LUMA_API_KEY not set");

      const afterDate = input.fromDate
        ? new Date(`${input.fromDate}T00:00:00.000Z`).toISOString()
        : APY_LAUNCH_DATE;
      const toTs = input.toDate
        ? new Date(`${input.toDate}T23:59:59.999Z`).getTime()
        : Date.now();

      const allEvents = await fetchAllEvents(apiKey, afterDate);
      const events = allEvents.filter(event => {
        const ts = new Date(event.start_at).getTime();
        return Number.isFinite(ts) && ts <= toTs;
      });

      const eventRows: Array<{
        eventId: string;
        eventName: string;
        eventUrl: string;
        startAt: string;
        location: string;
        eventType: "public" | "private" | "unknown";
        totalGuests: number;
        checkedInGuests: number;
        capturedTickets: number;
        classSessions: number;
        ticketSalesCents: number;
        discountCents: number;
        taxCents: number;
        customerPaidCents: number;
        ticketBreakdown: Record<string, {
          count: number;
          ticketSalesCents: number;
          discountCents: number;
          taxCents: number;
        }>;
        classBreakdown: Record<string, {
          tickets: number;
          ticketSalesCents: number;
        }>;
      }> = [];

      for (let i = 0; i < events.length; i += REQUEST_BATCH_SIZE) {
        const batch = events.slice(i, i + REQUEST_BATCH_SIZE);
        const results = await Promise.all(
          batch.map(async event => {
            const guests = await fetchEventGuests(apiKey, event.api_id);
            let checkedInGuests = 0;
            let capturedTickets = 0;
            let ticketSalesCents = 0;
            let discountCents = 0;
            let taxCents = 0;

            const ticketBreakdown: Record<string, {
              count: number;
              ticketSalesCents: number;
              discountCents: number;
              taxCents: number;
            }> = {};
            const classBreakdown: Record<string, { tickets: number; ticketSalesCents: number }> = {};
            const classSlots = new Set<string>();

            for (const guest of guests) {
              const tickets = guest.event_tickets ?? [];
              if (tickets.some(ticket => Boolean(ticket.checked_in_at)) || Boolean(guest.checked_in_at)) {
                checkedInGuests += 1;
              }

              for (const ticket of tickets) {
                if (!ticket.is_captured) continue;

                const gross = safeMoney(ticket.amount);
                const discount = safeMoney(ticket.amount_discount);
                const tax = safeMoney(ticket.amount_tax);
                const sale = Math.max(0, gross - discount);
                const name = ticket.name?.trim() || "Unknown";

                capturedTickets += 1;
                ticketSalesCents += sale;
                discountCents += discount;
                taxCents += tax;

                if (!ticketBreakdown[name]) {
                  ticketBreakdown[name] = { count: 0, ticketSalesCents: 0, discountCents: 0, taxCents: 0 };
                }
                ticketBreakdown[name].count += 1;
                ticketBreakdown[name].ticketSalesCents += sale;
                ticketBreakdown[name].discountCents += discount;
                ticketBreakdown[name].taxCents += tax;

                const slot = extractClassSlot(name);
                if (slot) {
                  classSlots.add(slot);
                  if (!classBreakdown[slot]) classBreakdown[slot] = { tickets: 0, ticketSalesCents: 0 };
                  classBreakdown[slot].tickets += 1;
                  classBreakdown[slot].ticketSalesCents += sale;
                }
              }
            }

            return {
              eventId: event.api_id,
              eventName: event.name,
              eventUrl: event.url,
              startAt: event.start_at,
              location: extractLocation(event),
              eventType: classifyEvent(event),
              totalGuests: guests.length,
              checkedInGuests,
              capturedTickets,
              classSessions: classSlots.size,
              ticketSalesCents,
              discountCents,
              taxCents,
              customerPaidCents: ticketSalesCents + taxCents,
              ticketBreakdown,
              classBreakdown,
            };
          }),
        );
        eventRows.push(...results);
      }

      const totalTicketSalesCents = eventRows.reduce((sum, row) => sum + row.ticketSalesCents, 0);
      const totalDiscountCents = eventRows.reduce((sum, row) => sum + row.discountCents, 0);
      const totalTaxCents = eventRows.reduce((sum, row) => sum + row.taxCents, 0);
      const totalCustomerPaidCents = eventRows.reduce((sum, row) => sum + row.customerPaidCents, 0);
      const totalGuests = eventRows.reduce((sum, row) => sum + row.totalGuests, 0);
      const totalCheckedIn = eventRows.reduce((sum, row) => sum + row.checkedInGuests, 0);
      const totalCapturedTickets = eventRows.reduce((sum, row) => sum + row.capturedTickets, 0);
      const totalClassSessions = eventRows.reduce((sum, row) => sum + row.classSessions, 0);

      const byLocation: Record<string, number> = {};
      const byMonth: Record<string, number> = {};
      const byEventType: Record<string, number> = { public: 0, private: 0, unknown: 0 };
      const byTicketType: Record<string, { count: number; ticketSalesCents: number }> = {};
      const byClassSlot: Record<string, { tickets: number; ticketSalesCents: number }> = {};

      for (const row of eventRows) {
        byLocation[row.location] = (byLocation[row.location] ?? 0) + row.ticketSalesCents;
        const month = row.startAt.slice(0, 7);
        byMonth[month] = (byMonth[month] ?? 0) + row.ticketSalesCents;
        byEventType[row.eventType] = (byEventType[row.eventType] ?? 0) + row.ticketSalesCents;

        for (const [name, value] of Object.entries(row.ticketBreakdown)) {
          if (!byTicketType[name]) byTicketType[name] = { count: 0, ticketSalesCents: 0 };
          byTicketType[name].count += value.count;
          byTicketType[name].ticketSalesCents += value.ticketSalesCents;
        }

        for (const [slot, value] of Object.entries(row.classBreakdown)) {
          if (!byClassSlot[slot]) byClassSlot[slot] = { tickets: 0, ticketSalesCents: 0 };
          byClassSlot[slot].tickets += value.tickets;
          byClassSlot[slot].ticketSalesCents += value.ticketSalesCents;
        }
      }

      return {
        generatedAt: new Date().toISOString(),
        range: { fromDate: afterDate.slice(0, 10), toDate: new Date(toTs).toISOString().slice(0, 10) },
        totalTicketSalesCents,
        totalDiscountCents,
        totalTaxCents,
        totalCustomerPaidCents,
        totalGuests,
        totalCheckedIn,
        totalCapturedTickets,
        totalEvents: eventRows.length,
        totalClassSessions,
        avgTicketCents: totalCapturedTickets > 0 ? Math.round(totalTicketSalesCents / totalCapturedTickets) : 0,
        avgPerEventCents: eventRows.length > 0 ? Math.round(totalTicketSalesCents / eventRows.length) : 0,
        avgPerClassCents: totalClassSessions > 0 ? Math.round(totalTicketSalesCents / totalClassSessions) : null,
        attendanceRate: totalGuests > 0 ? totalCheckedIn / totalGuests : 0,
        byLocation,
        byMonth,
        byEventType,
        byTicketType,
        byClassSlot,
        events: eventRows.sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime()),
        dataQuality: {
          source: "Luma event + guest ticket API",
          refundsIncluded: false,
          processingFeesIncluded: false,
          payoutNetIncluded: false,
          eventTypeMethod: "Luma visibility plus event-name classification",
          classCountMethod: "Distinct time slots parsed from captured ticket names",
          warning: "Captured ticket sales are operational sales analytics, not accounting net revenue. Refunds, Stripe/Luma fees and payout net are not exposed by the guest-ticket data used here.",
        },
      };
    }),
});
