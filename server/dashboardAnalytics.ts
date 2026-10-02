import { getTorontoCalendarDate } from "../shared/scheduleVisibility";

const LUMA_PUBLIC_CALENDAR_URL = "https://api.lu.ma/calendar/get-items";
const CALENDAR_ID = "cal-Z474jeIbvUXskHE";
const PAGE_LIMIT = 100;
const MAX_PAGES = 20;
const CACHE_TTL_MS = 15 * 60 * 1000;
const ELIGIBLE_LUMA_STATUSES = new Set(["approved"]);
const KNOWN_LUMA_STATUSES = new Set(["approved", "cancelled", "canceled", "draft", "rejected", "pending", "archived"]);

export type LumaMoney = { cents?: number | null; currency?: string | null } | null | undefined;

export type LumaPublicCalendarEntry = {
  api_id?: string;
  event?: {
    api_id?: string;
    name?: string;
    start_at?: string;
    end_at?: string;
    url?: string;
    geo_address_info?: { city?: string | null; country?: string | null } | null;
  };
  ticket_info?: {
    is_free?: boolean;
    price?: LumaMoney;
    max_price?: LumaMoney;
  } | null;
  ticket_count?: number | null;
  guest_count?: number | null;
  status?: string | null;
};

type LumaPublicCalendarPage = {
  entries?: LumaPublicCalendarEntry[];
  has_more?: boolean;
  next_cursor?: string | null;
};

export type DashboardEvent = {
  id: string;
  name: string;
  date: string;
  month: string;
  monthLabel: string;
  location: string;
  breed: string;
  tickets: number | null;
  estimatedRevenueCents: number | null;
};

type AggregateBreakdown = {
  name: string;
  events: number;
  tickets: number | null;
  eventsWithTicketCount: number;
};

export type DashboardOverview = {
  source: {
    name: string;
    refreshedAt: string;
    revenueStatus: "estimated";
    revenueBasis: string;
    note: string;
    calendarId: string;
  };
  summary: {
    pastEvents: number;
    upcomingEvents: number;
    totalTickets: number | null;
    eventsWithTicketCount: number;
    averageTicketsPerEvent: number | null;
    estimatedRevenueCents: number | null;
    estimatedRevenueEvents: number;
  };
  monthly: Array<{
    month: string;
    monthLabel: string;
    events: number;
    tickets: number | null;
    eventsWithTicketCount: number;
    estimatedRevenueCents: number | null;
    estimatedRevenueEvents: number;
  }>;
  byLocation: AggregateBreakdown[];
  byBreed: AggregateBreakdown[];
  recentEvents: DashboardEvent[];
  upcomingEvents: Array<Pick<DashboardEvent, "id" | "name" | "date" | "location" | "breed">>;
  instagram: {
    status: "not_connected";
    message: string;
  };
};

let cachedOverview: DashboardOverview | null = null;
let cacheExpiresAt = 0;
let refreshInFlight: Promise<DashboardOverview> | null = null;

function nonNegativeIntegerOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
}

function moneyToCents(value: LumaMoney): number | null {
  if (!value || typeof value !== "object") return null;
  if (value.currency?.toLowerCase() !== "cad") return null;
  if (typeof value.cents !== "number" || !Number.isSafeInteger(value.cents) || value.cents <= 0) return null;
  return value.cents;
}

function hasMoneyValue(value: LumaMoney) {
  return value !== null && value !== undefined;
}

function unambiguousTicketPrice(ticketInfo: LumaPublicCalendarEntry["ticket_info"]) {
  const price = moneyToCents(ticketInfo?.price);
  const maxPrice = moneyToCents(ticketInfo?.max_price);
  const hasPrice = hasMoneyValue(ticketInfo?.price);
  const hasMaxPrice = hasMoneyValue(ticketInfo?.max_price);
  if (!hasPrice && !hasMaxPrice) return null;
  if (hasPrice && !hasMaxPrice) return price;
  if (hasPrice && hasMaxPrice && price !== null && maxPrice !== null && price === maxPrice) return price;
  return null;
}

function safeMultiply(left: number, right: number) {
  const result = left * right;
  return Number.isSafeInteger(result) ? result : null;
}

function isStrictRfc3339Timestamp(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/);
  if (!match) return false;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, offsetText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (hour > 23 || minute > 59 || second > 59) return false;
  if (offsetText !== "Z") {
    const [, offsetHourText, offsetMinuteText] = offsetText.match(/^[+-](\d{2}):(\d{2})$/) ?? [];
    if (Number(offsetHourText) > 23 || Number(offsetMinuteText) > 59) return false;
  }
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  const parsed = new Date(value);
  return calendarDate.getUTCFullYear() === year
    && calendarDate.getUTCMonth() === month - 1
    && calendarDate.getUTCDate() === day
    && !Number.isNaN(parsed.getTime());
}

function eventLocation(name: string, city?: string | null) {
  const provided = city?.trim();
  if (provided) return provided;
  const match = name.match(/📍\s*([A-Za-z][A-Za-z\s-]*?)(?:\s*[|🐶🧘]|$)/);
  return match?.[1]?.trim() || "Other";
}

function eventBreed(name: string) {
  const explicit = name.match(/🐶\s*([A-Za-z][A-Za-z\s-]*?)(?:\s*[|📍🧘]|$)/);
  if (explicit?.[1]) return explicit[1].trim();
  const parts = name.split("|");
  if (parts.length > 1) {
    const candidate = parts.at(-1)?.replace(/[^\w\s-]/g, "").trim();
    if (candidate && candidate.length > 2 && candidate.length < 60) return candidate;
  }
  return "Mixed Breeds";
}

function eventDate(startAt?: string) {
  if (!startAt) return null;
  const parsed = new Date(startAt);
  if (Number.isNaN(parsed.getTime())) return null;
  return getTorontoCalendarDate(parsed);
}

function monthLabel(date: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", month: "short", year: "numeric" }).format(new Date(`${date}T12:00:00Z`));
}

function rollingMonthKeys(today: string, count = 12) {
  const [year, month] = today.slice(0, 7).split("-").map(Number);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month - count + index, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

function isDashboardClass(name: string) {
  const normalized = name.toLowerCase();
  return !["gift card", "private", "book a", "corporate"].some(excluded => normalized.includes(excluded));
}

function hasEligibleStatus(status?: string | null) {
  return typeof status === "string" && ELIGIBLE_LUMA_STATUSES.has(status.trim().toLowerCase());
}

function assertValidCalendarEntry(entry: unknown, label: string): asserts entry is LumaPublicCalendarEntry {
  if (!entry || typeof entry !== "object") throw new Error(`Luma public calendar returned an invalid ${label}`);
  const candidate = entry as LumaPublicCalendarEntry;
  const event = candidate.event;
  if (
    !event || typeof event !== "object" || typeof event.api_id !== "string" || !event.api_id.trim()
    || typeof event.name !== "string" || !event.name.trim()
    || typeof event.start_at !== "string" || !isStrictRfc3339Timestamp(event.start_at)
  ) {
    throw new Error(`Luma public calendar returned an incomplete ${label}`);
  }
  const status = candidate.status?.trim().toLowerCase();
  if (!status || !KNOWN_LUMA_STATUSES.has(status)) {
    throw new Error(`Luma public calendar returned an unrecognized status for ${label}`);
  }
  if (candidate.ticket_count !== null && candidate.ticket_count !== undefined && (!Number.isSafeInteger(candidate.ticket_count) || candidate.ticket_count < 0)) {
    throw new Error(`Luma public calendar returned an invalid ticket count for ${label}`);
  }
  if (candidate.ticket_info !== null && candidate.ticket_info !== undefined) {
    if (typeof candidate.ticket_info !== "object") throw new Error(`Luma public calendar returned invalid ticket information for ${label}`);
    for (const money of [candidate.ticket_info.price, candidate.ticket_info.max_price]) {
      if (!hasMoneyValue(money)) continue;
      if (!money || typeof money !== "object" || !Number.isSafeInteger(money.cents) || (money.cents ?? 0) <= 0 || typeof money.currency !== "string" || !money.currency.trim()) {
        throw new Error(`Luma public calendar returned invalid ticket pricing for ${label}`);
      }
    }
  }
}

function assertValidCalendarPage(payload: unknown, period: "past" | "future"): asserts payload is LumaPublicCalendarPage & { entries: LumaPublicCalendarEntry[]; has_more: boolean } {
  if (!payload || typeof payload !== "object") throw new Error(`Luma public calendar returned an invalid ${period} page`);
  const page = payload as LumaPublicCalendarPage;
  if (!Array.isArray(page.entries) || typeof page.has_more !== "boolean") {
    throw new Error(`Luma public calendar returned an incomplete ${period} page`);
  }
  if (page.has_more && (typeof page.next_cursor !== "string" || !page.next_cursor.trim())) {
    throw new Error(`Luma public calendar pagination is incomplete for ${period} events`);
  }
  page.entries.forEach((entry, index) => assertValidCalendarEntry(entry, `${period} event ${index + 1}`));
}

function asDashboardEvent(entry: LumaPublicCalendarEntry): DashboardEvent | null {
  const event = entry.event ?? {};
  const id = event.api_id ?? entry.api_id ?? "";
  const name = event.name?.trim() ?? "";
  const date = eventDate(event.start_at);
  if (!id || !name || !date || !isDashboardClass(name) || !hasEligibleStatus(entry.status)) return null;

  const tickets = nonNegativeIntegerOrNull(entry.ticket_count);
  const hasListedPrice = hasMoneyValue(entry.ticket_info?.price) || hasMoneyValue(entry.ticket_info?.max_price);
  // A price range or additional ticket tier does not reveal the actual mix of
  // purchased tickets. Estimate only when Luma exposes one explicit CAD price.
  const priceCents = unambiguousTicketPrice(entry.ticket_info);
  const isConfirmedFree = entry.ticket_info?.is_free === true && !hasListedPrice;
  const hasContradictoryFreePricing = entry.ticket_info?.is_free === true && hasListedPrice;

  return {
    id,
    name,
    date,
    month: date.slice(0, 7),
    monthLabel: monthLabel(date),
    location: eventLocation(name, event.geo_address_info?.city),
    breed: eventBreed(name),
    tickets,
    // This remains an estimate: it applies public ticket information to an
    // aggregate count. A confirmed free event is a zero-value estimate; a paid
    // event without a usable price stays unknown rather than being guessed.
    estimatedRevenueCents: tickets === null || hasContradictoryFreePricing ? null : isConfirmedFree ? 0 : priceCents === null ? null : safeMultiply(priceCents, tickets),
  };
}

async function fetchPeriod(period: "past" | "future", fetchImpl: typeof fetch) {
  const entries: LumaPublicCalendarEntry[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const url = new URL(LUMA_PUBLIC_CALENDAR_URL);
    url.searchParams.set("calendar_api_id", CALENDAR_ID);
    url.searchParams.set("period", period);
    url.searchParams.set("pagination_limit", String(PAGE_LIMIT));
    if (cursor) url.searchParams.set("pagination_cursor", cursor);

    const response = await fetchImpl(url, {
      headers: { Accept: "application/json", "User-Agent": "AfroPuppyYoga-Dashboard/1.0" },
    });
    if (!response.ok) throw new Error(`Luma public calendar request failed (${response.status})`);

    const payload: unknown = await response.json();
    assertValidCalendarPage(payload, period);
    entries.push(...payload.entries);
    if (!payload.has_more) return entries;
    if (!payload.next_cursor || payload.next_cursor === cursor) throw new Error("Luma public calendar pagination stopped unexpectedly");
    cursor = payload.next_cursor;
  }

  throw new Error("Luma public calendar exceeded the dashboard page safety limit");
}

function allKnown(values: Array<number | null>) {
  return values.length > 0 && values.every((value): value is number => value !== null);
}

function sumWhenComplete(values: Array<number | null>) {
  if (!allKnown(values)) return null;
  let total = 0;
  for (const value of values) {
    const next = total + (value ?? 0);
    if (!Number.isSafeInteger(next)) return null;
    total = next;
  }
  return total;
}

function buildBreakdownItem(name: string) {
  return { name, events: 0, ticketValues: [] as Array<number | null> };
}

function finalizeBreakdown(item: ReturnType<typeof buildBreakdownItem>): AggregateBreakdown {
  return {
    name: item.name,
    events: item.events,
    tickets: sumWhenComplete(item.ticketValues),
    eventsWithTicketCount: item.ticketValues.filter((value): value is number => value !== null).length,
  };
}

export function buildDashboardOverview(entries: LumaPublicCalendarEntry[], refreshedAt = new Date().toISOString()): DashboardOverview {
  const today = getTorontoCalendarDate();
  const seen = new Set<string>();
  entries.forEach((entry, index) => assertValidCalendarEntry(entry, `event ${index + 1}`));
  const events = entries
    .map(asDashboardEvent)
    .filter((event): event is DashboardEvent => event !== null)
    .filter(event => {
      if (seen.has(event.id)) return false;
      seen.add(event.id);
      return true;
    });

  const pastEvents = events.filter(event => event.date < today).sort((a, b) => b.date.localeCompare(a.date));
  const upcomingEvents = events.filter(event => event.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const ticketValues = pastEvents.map(event => event.tickets);
  const totalTickets = sumWhenComplete(ticketValues);
  const revenueValues = pastEvents.map(event => event.estimatedRevenueCents);
  const totalRevenue = sumWhenComplete(revenueValues);

  const monthly = new Map<string, { month: string; monthLabel: string; events: number; ticketValues: Array<number | null>; revenueValues: Array<number | null> }>();
  const locations = new Map<string, ReturnType<typeof buildBreakdownItem>>();
  const breeds = new Map<string, ReturnType<typeof buildBreakdownItem>>();

  for (const event of pastEvents) {
    const month = monthly.get(event.month) ?? { month: event.month, monthLabel: event.monthLabel, events: 0, ticketValues: [], revenueValues: [] };
    month.events += 1;
    month.ticketValues.push(event.tickets);
    month.revenueValues.push(event.estimatedRevenueCents);
    monthly.set(event.month, month);

    const location = locations.get(event.location) ?? buildBreakdownItem(event.location);
    location.events += 1;
    location.ticketValues.push(event.tickets);
    locations.set(event.location, location);

    const breed = breeds.get(event.breed) ?? buildBreakdownItem(event.breed);
    breed.events += 1;
    breed.ticketValues.push(event.tickets);
    breeds.set(event.breed, breed);
  }

  return {
    source: {
      name: "Luma public calendar API",
      refreshedAt,
      revenueStatus: "estimated",
      revenueBasis: "Aggregate ticket counts multiplied by the currently visible public ticket price, or zero for confirmed free events.",
      note: "Not Stripe-confirmed sales. Totals are withheld when any eligible past class is missing a ticket count or usable public price. Taxes, discounts, refunds, bundles, comped tickets, and historical price changes can make available estimates differ from actual revenue.",
      calendarId: CALENDAR_ID,
    },
    summary: {
      pastEvents: pastEvents.length,
      upcomingEvents: upcomingEvents.length,
      totalTickets,
      eventsWithTicketCount: ticketValues.filter((value): value is number => value !== null).length,
      averageTicketsPerEvent: totalTickets === null || pastEvents.length === 0 ? null : Math.round((totalTickets / pastEvents.length) * 10) / 10,
      estimatedRevenueCents: totalRevenue,
      estimatedRevenueEvents: revenueValues.filter((value): value is number => value !== null).length,
    },
    monthly: rollingMonthKeys(today).map(month => {
      const row = monthly.get(month);
      if (!row) {
        return {
          month,
          monthLabel: monthLabel(`${month}-01`),
          events: 0,
          tickets: 0,
          eventsWithTicketCount: 0,
          estimatedRevenueCents: 0,
          estimatedRevenueEvents: 0,
        };
      }
      return {
        month: row.month,
        monthLabel: row.monthLabel,
        events: row.events,
        tickets: sumWhenComplete(row.ticketValues),
        eventsWithTicketCount: row.ticketValues.filter((value): value is number => value !== null).length,
        estimatedRevenueCents: sumWhenComplete(row.revenueValues),
        estimatedRevenueEvents: row.revenueValues.filter((value): value is number => value !== null).length,
      };
    }),
    byLocation: Array.from(locations.values()).map(finalizeBreakdown).sort((a, b) => (b.tickets ?? -1) - (a.tickets ?? -1) || b.events - a.events),
    byBreed: Array.from(breeds.values()).map(finalizeBreakdown).sort((a, b) => (b.tickets ?? -1) - (a.tickets ?? -1) || b.events - a.events),
    recentEvents: pastEvents.slice(0, 30),
    upcomingEvents: upcomingEvents.slice(0, 8).map(({ id, name, date, location, breed }) => ({ id, name, date, location, breed })),
    instagram: {
      status: "not_connected",
      message: "No verified Instagram performance refresh is connected. This dashboard intentionally does not show stale social metrics.",
    },
  };
}

export async function getDashboardOverview(fetchImpl: typeof fetch = fetch, now = Date.now()): Promise<DashboardOverview> {
  if (cachedOverview && now < cacheExpiresAt) return cachedOverview;
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = Promise.all([fetchPeriod("past", fetchImpl), fetchPeriod("future", fetchImpl)])
    .then(([past, future]) => {
      const overview = buildDashboardOverview([...past, ...future]);
      cachedOverview = overview;
      cacheExpiresAt = now + CACHE_TTL_MS;
      return overview;
    })
    .finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export const dashboardAnalyticsTestUtils = {
  asDashboardEvent,
  buildDashboardOverview,
  resetCache() {
    cachedOverview = null;
    cacheExpiresAt = 0;
    refreshInFlight = null;
  },
};
