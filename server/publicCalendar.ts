import { and, asc, eq, gte, isNotNull } from "drizzle-orm";
import { puppySchedule } from "../drizzle/schema";
import { getTorontoCalendarDate } from "../shared/scheduleVisibility";
import { isStillUpcomingPublicClass } from "../shared/publicClassTiming";
import { getDb } from "./db";

const LUMA_BASE = "https://public-api.luma.com/v1";
const CACHE_TTL_MS = 60 * 1000;
const MAX_UPCOMING_CLASSES = 36;

type LumaTicketType = {
  name?: string;
  cents?: number | null;
  currency?: string | null;
  is_hidden?: boolean;
  type?: string;
};

type LumaEventState = {
  url?: string;
  visibility?: string;
  registration_open?: boolean;
  end_at?: string | null;
};

type PublicClass = {
  id: number;
  classDate: string;
  location: string;
  breed: string;
  startTime: string;
  endTime: string;
  lumaEventUrl: string;
  admissionMinCents: number | null;
};

let cachedClasses: PublicClass[] | null = null;
let cacheExpiresAt = 0;

export function isAdmissionTicket(ticket: LumaTicketType) {
  const name = ticket.name?.trim().toLowerCase() ?? "";
  const type = ticket.type?.toLowerCase();
  const currency = ticket.currency?.toLowerCase();
  return type === "paid"
    && currency === "cad"
    && ticket.is_hidden !== true
    && typeof ticket.cents === "number"
    && ticket.cents > 0
    && !(/\bmat\b.*\brental\b|\brental\b.*\bmat\b/.test(name));
}

export function lowestAdmissionCents(tickets: LumaTicketType[]) {
  const prices = tickets.filter(isAdmissionTicket).map(ticket => ticket.cents as number);
  return prices.length ? Math.min(...prices) : null;
}

async function getEventAdmissionMinCents(eventId: string, apiKey: string, fetchImpl: typeof fetch) {
  try {
    const response = await fetchImpl(`${LUMA_BASE}/events/ticket-types/list?event_id=${encodeURIComponent(eventId)}`, {
      headers: { "x-luma-api-key": apiKey },
    });
    if (!response.ok) throw new Error(`Luma ticket lookup failed (${response.status})`);
    const payload = await response.json() as { entries?: LumaTicketType[] };
    return lowestAdmissionCents(payload.entries ?? []);
  } catch (error) {
    console.error(`[Public Calendar] Could not read admission pricing for ${eventId}:`, error);
    return null;
  }
}

async function getVerifiedPublicLumaEvent(eventId: string, apiKey: string, fetchImpl: typeof fetch) {
  try {
    const response = await fetchImpl(`${LUMA_BASE}/events/get?event_id=${encodeURIComponent(eventId)}`, {
      headers: { "x-luma-api-key": apiKey },
    });
    if (!response.ok) throw new Error(`Luma event verification failed (${response.status})`);
    const event = await response.json() as LumaEventState;
    const hasEnded = !event.end_at || Number.isNaN(Date.parse(event.end_at)) || Date.parse(event.end_at) <= Date.now();
    if (event.visibility !== "public" || event.registration_open !== true || hasEnded || !event.url) return null;
    return event.url;
  } catch (error) {
    console.error(`[Public Calendar] Could not verify Luma event ${eventId}:`, error);
    return null;
  }
}

export async function getUpcomingPublicClasses(fetchImpl: typeof fetch = fetch): Promise<PublicClass[]> {
  if (cachedClasses && Date.now() < cacheExpiresAt) {
    return cachedClasses.filter(item => isStillUpcomingPublicClass(item.classDate, item.endTime));
  }

  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  const today = getTorontoCalendarDate(now);
  const schedules = await db.select({
    id: puppySchedule.id,
    classDate: puppySchedule.classDate,
    location: puppySchedule.location,
    breed: puppySchedule.breed,
    startTime: puppySchedule.startTime,
    endTime: puppySchedule.endTime,
    lumaEventId: puppySchedule.lumaEventId,
    lumaEventUrl: puppySchedule.lumaEventUrl,
  }).from(puppySchedule).where(and(
    eq(puppySchedule.scheduleStatus, "scheduled"),
    eq(puppySchedule.classType, "regular"),
    gte(puppySchedule.classDate, today),
    isNotNull(puppySchedule.lumaEventId),
    isNotNull(puppySchedule.lumaEventUrl),
  )).orderBy(asc(puppySchedule.classDate), asc(puppySchedule.startTime)).limit(MAX_UPCOMING_CLASSES);
  const activeSchedules = schedules.filter(schedule => isStillUpcomingPublicClass(schedule.classDate, schedule.endTime, now));

  const apiKey = process.env.LUMA_API_KEY;
  // A public card must always quote a verified admission price. If Luma is
  // temporarily unavailable, omit that class instead of publishing a booking
  // link with a missing or misleading price. The full Luma calendar link stays
  // available as the safe fallback.
  const candidates: Array<PublicClass | null> = await Promise.all(activeSchedules.map(async schedule => {
    if (!apiKey || !schedule.lumaEventId) return null;
    const [lumaEventUrl, admissionMinCents] = await Promise.all([
      getVerifiedPublicLumaEvent(schedule.lumaEventId, apiKey, fetchImpl),
      getEventAdmissionMinCents(schedule.lumaEventId, apiKey, fetchImpl),
    ]);
    if (!lumaEventUrl || admissionMinCents === null) return null;
    return {
      id: schedule.id,
      classDate: schedule.classDate,
      location: schedule.location,
      breed: schedule.breed,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      lumaEventUrl,
      admissionMinCents,
    } satisfies PublicClass;
  }));
  const classes = candidates.filter((candidate): candidate is PublicClass => candidate !== null);

  cachedClasses = classes;
  cacheExpiresAt = Date.now() + CACHE_TTL_MS;
  return classes;
}

export const publicCalendarTestUtils = {
  isAdmissionTicket,
  lowestAdmissionCents,
  isStillUpcomingClass: isStillUpcomingPublicClass,
  resetCache() {
    cachedClasses = null;
    cacheExpiresAt = 0;
  },
};
