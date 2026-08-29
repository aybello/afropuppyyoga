const LUMA_BASE = "https://public-api.luma.com/v1";
const PAGE_LIMIT = 100;
const MAX_PAGES = 100;

type LumaPage<T> = {
  entries?: T[];
  has_more?: boolean;
  next_cursor?: string | null;
};

type LumaEvent = {
  id: string;
  name?: string;
  start_at?: string;
  url?: string;
};

type EventTicket = {
  name?: string;
  is_captured?: boolean;
  checked_in_at?: string | null;
};

type LumaGuest = {
  approval_status?: string;
  event_tickets?: EventTicket[];
};

export type LumaAttendance = {
  totalEvents: number;
  totalRegistrations: number;
  totalGuests: number;
  totalCheckedIn: number;
  attendanceRate: number;
  eventAttendance: Array<{
    name: string;
    date: string;
    registrations: number;
    guests: number;
    checkedIn: number;
    url: string;
  }>;
};

function ticketSeats(name = ""): number {
  const normalized = name.toLowerCase();
  if (normalized.includes("mat rental")) return 0;
  if (normalized.includes("bring a friend")) return 2;
  if (normalized.includes("group of 3")) return 3;
  return 1;
}

async function fetchPage<T>(url: URL, apiKey: string, fetchImpl: typeof fetch): Promise<LumaPage<T>> {
  const response = await fetchImpl(url.toString(), { headers: { "x-luma-api-key": apiKey } });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Luma request failed (${response.status}): ${body}`);
  }
  return await response.json() as LumaPage<T>;
}

async function fetchAllPages<T>(
  path: string,
  params: Record<string, string>,
  apiKey: string,
  fetchImpl: typeof fetch,
): Promise<T[]> {
  const entries: T[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(`${LUMA_BASE}${path}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    url.searchParams.set("pagination_limit", String(PAGE_LIMIT));
    if (cursor) url.searchParams.set("pagination_cursor", cursor);

    const result = await fetchPage<T>(url, apiKey, fetchImpl);
    entries.push(...(result.entries ?? []));
    if (!result.has_more) return entries;
    if (!result.next_cursor || result.next_cursor === cursor) {
      throw new Error("Luma pagination stopped before all records were returned.");
    }
    cursor = result.next_cursor;
  }

  throw new Error(`Luma response exceeded the ${MAX_PAGES}-page safety limit.`);
}

function countGuest(guest: LumaGuest) {
  if (guest.approval_status && guest.approval_status !== "approved") return { seats: 0, checkedIn: 0 };
  const tickets = (guest.event_tickets ?? []).filter(ticket => ticket.is_captured !== false);
  if (tickets.length === 0) return { seats: 1, checkedIn: 0 };
  return tickets.reduce(
    (totals, ticket) => {
      const seats = ticketSeats(ticket.name);
      totals.seats += seats;
      if (ticket.checked_in_at) totals.checkedIn += seats;
      return totals;
    },
    { seats: 0, checkedIn: 0 },
  );
}

export async function getLumaAttendance(
  apiKey: string,
  after: string,
  fetchImpl: typeof fetch = fetch,
): Promise<LumaAttendance> {
  const events = await fetchAllPages<LumaEvent>(
    "/calendars/events/list",
    { after, access: "manage" },
    apiKey,
    fetchImpl,
  );

  const rows: LumaAttendance["eventAttendance"] = [];
  const batchSize = 4;
  for (let i = 0; i < events.length; i += batchSize) {
    const batch = events.slice(i, i + batchSize);
    rows.push(...await Promise.all(batch.map(async event => {
      const guests = await fetchAllPages<LumaGuest>(
        "/events/guests/list",
        { event_id: event.id, approval_status: "approved" },
        apiKey,
        fetchImpl,
      );
      const counts = guests.reduce(
        (total, guest) => {
          const guestCounts = countGuest(guest);
          total.guests += guestCounts.seats;
          total.checkedIn += guestCounts.checkedIn;
          return total;
        },
        { guests: 0, checkedIn: 0 },
      );
      return {
        name: event.name || "Untitled",
        date: event.start_at?.split("T")[0] || "Unknown",
        registrations: guests.length,
        guests: counts.guests,
        checkedIn: counts.checkedIn,
        url: event.url || "",
      };
    })));
  }

  const totalRegistrations = rows.reduce((sum, row) => sum + row.registrations, 0);
  const totalGuests = rows.reduce((sum, row) => sum + row.guests, 0);
  const totalCheckedIn = rows.reduce((sum, row) => sum + row.checkedIn, 0);
  return {
    totalEvents: events.length,
    totalRegistrations,
    totalGuests,
    totalCheckedIn,
    attendanceRate: totalGuests > 0 ? totalCheckedIn / totalGuests : 0,
    eventAttendance: rows.sort((a, b) => b.date.localeCompare(a.date)),
  };
}

export const lumaTestUtils = { ticketSeats, countGuest };
