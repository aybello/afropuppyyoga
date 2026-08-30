/**
 * Creates a public Luma event page for a regular puppy yoga class (schedule slot).
 * Matches the exact format of real APY events (Aug 15 2026 style):
 *   - Name: AfroPuppyYoga |📍{Location} |🐶{Breed}
 *   - 3 time slots: 10AM, 11:30AM, 1:30PM — each with Early Bird / Bring a Friend / Group of 3 / Regular tickets
 *   - Mat Rental ticket, with no default free Standard ticket
 *   - Full APY branded description
 *   - Group Registration, cranberry tint, and the light Hypnotic pattern
 */

import {
  APY_MAT_RENTAL_TICKET,
  APY_REGULAR_CLASS_LUMA_PREVIEW,
  APY_REGULAR_CLASS_TIME_SLOTS,
  getRegularClassTicketOptions,
} from "@shared/lumaClassConfig";
import { notifyOwner } from "./_core/notification";

const LUMA_BASE = "https://public-api.luma.com/v1";
const LUMA_INVITE_MESSAGE_MAX_LENGTH = 200;

type LumaPagedResponse<T> = {
  entries?: T[];
  has_more?: boolean;
  next_cursor?: string | null;
};

type LumaInviteRecipient = {
  email: string;
  name?: string;
};

type LumaEventLookup = {
  url?: string;
  visibility?: string;
  registration_open?: boolean;
  cancelled_at?: string | null;
  is_cancelled?: boolean;
  is_sold_out?: boolean;
  sold_out?: boolean;
  status?: string;
  event?: Record<string, unknown>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const firstNonEmptyString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
};

/** Normalizes an address before recipient comparison without logging it. */
export function normalizeLumaEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLocaleLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function eventRecord(response: LumaEventLookup): Record<string, unknown> {
  return isRecord(response.event) ? response.event : response;
}

/**
 * The class creator explicitly sets public visibility and open registration.
 * When the lookup exposes state fields, any contrary state blocks outreach.
 */
export function isEligibleCreatedLumaEventForInvites(response: LumaEventLookup): boolean {
  const event = eventRecord(response);
  const visibility = firstNonEmptyString(event.visibility)?.toLocaleLowerCase();
  const status = firstNonEmptyString(event.status)?.toLocaleLowerCase();
  if (visibility && visibility !== "public") return false;
  if (event.registration_open === false) return false;
  if (event.is_cancelled === true || event.cancelled_at || event.is_sold_out === true || event.sold_out === true) return false;
  return !["cancelled", "hidden", "private", "sold_out"].includes(status ?? "");
}

function lumaContactRecord(entry: unknown): Record<string, unknown> | null {
  if (!isRecord(entry)) return null;
  return [entry.calendar_contact, entry.contact, entry].find(isRecord) ?? null;
}

function lumaGuestEmail(entry: unknown): string | null {
  if (!isRecord(entry)) return null;
  const guest = isRecord(entry.guest) ? entry.guest : null;
  const user = isRecord(entry.user) ? entry.user : null;
  const guestUser = guest && isRecord(guest.user) ? guest.user : null;
  return normalizeLumaEmail(
    firstNonEmptyString(entry.email, guest?.email, user?.email, guestUser?.email)
  );
}

function lumaContactRecipient(entry: unknown): LumaInviteRecipient | null {
  const contact = lumaContactRecord(entry);
  if (!contact) return null;
  const email = normalizeLumaEmail(contact.email);
  if (!email) return null;
  const name = firstNonEmptyString(
    contact.name,
    [firstNonEmptyString(contact.first_name), firstNonEmptyString(contact.last_name)].filter(Boolean).join(" ")
  );
  return name ? { email, name } : { email };
}

export function buildLumaClassInviteRecipients(
  contactEntries: unknown[],
  registeredGuestEmails: Set<string>
): LumaInviteRecipient[] {
  const recipients = new Map<string, LumaInviteRecipient>();
  for (const entry of contactEntries) {
    const recipient = lumaContactRecipient(entry);
    if (!recipient || registeredGuestEmails.has(recipient.email) || recipients.has(recipient.email)) continue;
    recipients.set(recipient.email, recipient);
  }
  return Array.from(recipients.values());
}

async function fetchAllLumaEntries<T>(apiKey: string, path: string, purpose: string): Promise<T[]> {
  const firstPageUrl = new URL(`${LUMA_BASE}${path}`);
  firstPageUrl.searchParams.set("pagination_limit", "100");
  const entries: T[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < 100; page += 1) {
    const pageUrl = new URL(firstPageUrl.toString());
    if (cursor) pageUrl.searchParams.set("pagination_cursor", cursor);
    const response = await fetch(pageUrl.toString(), {
      headers: { "x-luma-api-key": apiKey },
    });
    if (!response.ok) throw new Error(`Luma ${purpose} lookup failed (${response.status})`);

    const data = await response.json() as LumaPagedResponse<T>;
    if (Array.isArray(data.entries)) entries.push(...data.entries);
    if (!data.has_more) return entries;

    const nextCursor = typeof data.next_cursor === "string" ? data.next_cursor : "";
    if (!nextCursor || nextCursor === cursor) {
      throw new Error(`Luma ${purpose} lookup returned an invalid pagination cursor`);
    }
    cursor = nextCursor;
  }

  throw new Error(`Luma ${purpose} lookup exceeded the safe page limit`);
}

type LumaClassInviteMessageParams = Pick<LumaScheduleParams, "classDate" | "location" | "breed"> & {
  eventUrl: string;
};

/** Returns null rather than truncate a Luma URL when its message would exceed Luma's 200-character limit. */
export function buildLumaClassInviteMessage(params: LumaClassInviteMessageParams): string | null {
  const eventUrl = params.eventUrl.trim();
  const eventDate = new Date(`${params.classDate}T12:00:00Z`);
  if (!eventUrl || Number.isNaN(eventDate.getTime())) return null;

  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(eventDate);
  const location = params.location.trim() || "your area";
  const breed = params.breed.trim() && params.breed !== "TBD" ? params.breed.trim() : "our puppies";
  const suffix = ` Reserve your spot: ${eventUrl}`;
  const maxIntroLength = LUMA_INVITE_MESSAGE_MAX_LENGTH - suffix.length;
  if (maxIntroLength < 2) return null;

  const fullIntro = `Puppy yoga is coming up in ${location}! Join us ${date} with ${breed}.`;
  const intro = fullIntro.length <= maxIntroLength
    ? fullIntro
    : `${fullIntro.slice(0, maxIntroLength - 1).trimEnd()}…`;
  return `${intro}${suffix}`;
}

async function reportLumaInvitationIssue(reason: string): Promise<void> {
  console.error(`[LumaSchedule] ${reason}`);
  try {
    await notifyOwner({
      title: "Luma class invitations need review",
      content: `${reason} The class event remains available and no automatic invitation set was sent. Review the event in Luma before any manual follow-up.`,
    });
  } catch (notificationError) {
    console.warn("[LumaSchedule] Could not send the invitation-review notification:", notificationError);
  }
}

/**
 * Invites the owner-approved calendar audience only after all contacts and the
 * event's existing guests have been read successfully. One Luma request is
 * used so a failed recipient audit cannot leave a partial automatic campaign.
 */
async function inviteCalendarContactsToCreatedClass(
  apiKey: string,
  eventId: string,
  eventUrl: string,
  params: LumaScheduleParams
): Promise<void> {
  const message = buildLumaClassInviteMessage({ ...params, eventUrl });
  if (!message) {
    await reportLumaInvitationIssue("Automatic invitations were skipped because the verified Luma event link could not fit safely in Luma's invite-message limit.");
    return;
  }

  try {
    const [contactEntries, guestEntries] = await Promise.all([
      fetchAllLumaEntries<unknown>(apiKey, "/calendars/contacts/list", "calendar-contact"),
      fetchAllLumaEntries<unknown>(apiKey, `/events/guests/list?event_id=${encodeURIComponent(eventId)}`, "event-guest"),
    ]);
    const registeredGuestEmails = new Set(
      guestEntries.map(lumaGuestEmail).filter((email): email is string => Boolean(email))
    );
    const recipients = buildLumaClassInviteRecipients(contactEntries, registeredGuestEmails);
    if (recipients.length === 0) {
      console.log("[LumaSchedule] No eligible calendar contacts to invite to the newly created class.");
      return;
    }

    const sendResponse = await fetch(`${LUMA_BASE}/events/guests/send-invites`, {
      method: "POST",
      headers: { "x-luma-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ event_id: eventId, guests: recipients, message }),
    });
    if (!sendResponse.ok) throw new Error(`Luma invite delivery failed (${sendResponse.status})`);
    console.log(`[LumaSchedule] Submitted ${recipients.length} automatic class invitations.`);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown invite error";
    await reportLumaInvitationIssue(`Automatic invitations were not sent after the new class was created: ${detail}`);
  }
}

// APY cover image (placeholder — swap in puppy photo after creation)
const APY_COVER = "https://images.lumacdn.com/event-covers/oi/e96e9bff-d920-423c-9d67-55dd8b8041a9.jpg";

const LOCATION_MAP: Record<string, { googlePlaceId: string }> = {
  kitchener: { googlePlaceId: "ChIJH-amGez0K4gRjJwKZT5ifpU" },
  hamilton:  { googlePlaceId: "ChIJj19OTp-YLIgRv4e9qQwDoq8" },
  oakville:  { googlePlaceId: "ChIJofNPAT9DK4gRAhVcvaHDk7Y" },
};

export type LumaScheduleParams = {
  classDate: string;
  location: string;
  breed: string;
  startTime: string;
  endTime: string;
  classType: "regular" | "private";
};

export type LumaCalendarEvent = {
  api_id: string;
  name: string;
  start_at: string;
  url?: string;
};

/**
 * Turn a Toronto wall-clock time into ISO 8601 while respecting EST/EDT.
 * Class times are daytime hours, so they never fall inside the DST transition gap.
 */
export function torontoDateTimeIso(classDate: string, time: string) {
  // Resolve the offset at local midday for the calendar date. A UTC probe at
  // midnight can still fall before a same-day DST transition in Toronto and
  // produce the prior offset for an afternoon APY class.
  const probe = new Date(`${classDate}T12:00:00Z`);
  if (Number.isNaN(probe.getTime())) throw new Error("Invalid class date or time");
  const zone = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    timeZoneName: "longOffset",
  }).formatToParts(probe).find(part => part.type === "timeZoneName")?.value;
  const offset = zone?.replace("GMT", "");
  if (!offset || !/^[+-]\d{2}:\d{2}$/.test(offset)) throw new Error("Could not determine the Toronto timezone offset");
  return `${classDate}T${time}:00${offset}`;
}

function regularEventFields(params: LumaScheduleParams) {
  const loc = LOCATION_MAP[params.location.toLowerCase().trim()];
  if (!loc) throw new Error(`Unknown APY location: ${params.location}`);
  const breed = params.breed && params.breed !== "TBD" ? params.breed : "Puppies";
  const firstSlot = APY_REGULAR_CLASS_TIME_SLOTS[0];
  const lastSlot = APY_REGULAR_CLASS_TIME_SLOTS[APY_REGULAR_CLASS_TIME_SLOTS.length - 1];
  const pad = (value: number) => String(value).padStart(2, "0");
  return {
    name: `AfroPuppyYoga |📍${params.location} |🐶${breed}`,
    start_at: torontoDateTimeIso(params.classDate, `${pad(firstSlot.startHour)}:${pad(firstSlot.startMinute)}`),
    end_at: torontoDateTimeIso(params.classDate, `${pad(lastSlot.endHour)}:${pad(lastSlot.endMinute)}`),
    timezone: "America/Toronto",
    geo_address_json: { type: "google", place_id: loc.googlePlaceId },
  };
}

function torontoCalendarDate(isoDateTime: string) {
  const timestamp = new Date(isoDateTime);
  if (Number.isNaN(timestamp.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(timestamp);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value;
  const year = value("year");
  const month = value("month");
  const day = value("day");
  return year && month && day ? `${year}-${month}-${day}` : null;
}

/**
 * A public APY class is one calendar event per studio per date, containing all
 * of that date's APY ticket slots. Breed and individual class slot can change
 * without creating another event, so they are intentionally not part of the
 * duplicate key.
 */
export function findExistingLumaScheduleEvent(
  events: LumaCalendarEvent[],
  params: Pick<LumaScheduleParams, "classDate" | "location" | "classType">
): { lumaEventId: string; lumaEventUrl: string } | null {
  if (params.classType !== "regular") return null;
  const normalizedLocation = params.location.trim().toLocaleLowerCase();
  const canonicalPrefix = `afropuppyyoga |📍${normalizedLocation} |🐶`;
  const match = events.find(event => (
    torontoCalendarDate(event.start_at) === params.classDate &&
    event.name.trim().toLocaleLowerCase().replace(/\s+/g, " ").startsWith(canonicalPrefix)
  ));
  if (!match) return null;
  return {
    lumaEventId: match.api_id,
    lumaEventUrl: match.url?.trim() || `https://lu.ma/${match.api_id}`,
  };
}

async function findExistingLumaEventForSchedule(
  apiKey: string,
  params: LumaScheduleParams
) {
  const after = torontoDateTimeIso(params.classDate, "00:00");
  const response = await fetch(
    `${LUMA_BASE}/calendar/list-events?pagination_limit=100&after=${encodeURIComponent(after)}`,
    { headers: { "x-luma-api-key": apiKey } }
  );
  if (!response.ok) {
    throw new Error(`Luma calendar duplicate check failed (${response.status})`);
  }
  const data = await response.json() as { entries?: Array<{ event?: LumaCalendarEvent }> };
  const events = (data.entries ?? []).flatMap(entry => entry.event ? [entry.event] : []);
  return findExistingLumaScheduleEvent(events, params);
}

export async function setLumaRegistrationOpen(eventId: string, registrationOpen: boolean) {
  const apiKey = process.env.LUMA_API_KEY;
  if (!apiKey) throw new Error("LUMA_API_KEY is not set");
  const response = await fetch(`${LUMA_BASE}/events/update`, {
    method: "POST",
    headers: { "x-luma-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ event_id: eventId, registration_open: registrationOpen, suppress_notifications: true }),
  });
  if (!response.ok) throw new Error(`Luma registration update failed (${response.status})`);
}

/** Permanently remove a newly-created event that APY HQ could not save.
 * This is only for compensation before a link has been shared or guests exist. */
export async function cancelUnpublishedLumaEvent(eventId: string) {
  const apiKey = process.env.LUMA_API_KEY;
  if (!apiKey) throw new Error("LUMA_API_KEY is not set");
  const requestRes = await fetch(`${LUMA_BASE}/events/cancel/request`, {
    method: "POST",
    headers: { "x-luma-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ event_id: eventId }),
  });
  if (!requestRes.ok) throw new Error(`Luma cleanup request failed (${requestRes.status})`);
  const requestData = await requestRes.json() as { cancellation_token?: string; token?: string };
  const cancellationToken = requestData.cancellation_token || requestData.token;
  if (!cancellationToken) throw new Error("Luma cleanup request returned no cancellation token");
  const cancelRes = await fetch(`${LUMA_BASE}/events/cancel`, {
    method: "POST",
    headers: { "x-luma-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ event_id: eventId, cancellation_token: cancellationToken, should_refund: false }),
  });
  if (!cancelRes.ok) throw new Error(`Luma cleanup failed (${cancelRes.status})`);
}

export async function updateLumaEventForSchedule(eventId: string, params: LumaScheduleParams) {
  if (params.classType !== "regular") throw new Error("A public APY Luma class cannot be converted into a private event. Cancel the public event first.");
  const apiKey = process.env.LUMA_API_KEY;
  if (!apiKey) throw new Error("LUMA_API_KEY is not set");
  const response = await fetch(`${LUMA_BASE}/events/update`, {
    method: "POST",
    headers: { "x-luma-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ event_id: eventId, ...regularEventFields(params), suppress_notifications: true }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Luma event update failed (${response.status}): ${detail.slice(0, 300)}`);
  }
}

export const REGULAR_CLASS_LUMA_EVENT_DEFAULTS = {
  can_register_for_multiple_tickets: APY_REGULAR_CLASS_LUMA_PREVIEW.groupRegistration,
  tint_color: APY_REGULAR_CLASS_LUMA_PREVIEW.tintColor,
  // Luma's documented Hypnotic theme is the requested light pattern. The API
  // does not expose a separate hypnotic-light enum or dark-mode flag.
  theme: "hypnotic",
} as const;

type LumaTicketType = {
  name: string;
  type: "paid";
  cents: number;
  currency: "cad";
  max_capacity?: number;
};

/**
 * Passing ticket types directly to Luma event creation replaces its automatic
 * free Standard ticket, so newly scheduled breeder classes only show APY's
 * actual purchasable options.
 */
export function buildRegularClassTicketTypes(location?: string): LumaTicketType[] {
  const tickets: LumaTicketType[] = [
    { name: APY_MAT_RENTAL_TICKET.name, type: "paid", cents: APY_MAT_RENTAL_TICKET.cents, currency: "cad" },
  ];

  for (const slot of APY_REGULAR_CLASS_TIME_SLOTS) {
    for (const option of getRegularClassTicketOptions(location)) {
      tickets.push({
        name: `${slot.label} ${option.suffix}`,
        type: "paid",
        cents: option.cents,
        currency: "cad",
        max_capacity: option.maxCapacity,
      });
    }
  }

  return tickets;
}

const APY_DESCRIPTION = `Start your weekend with a little more movement… and a lot more puppy love.

**AfroPuppyYoga** is a feel-good wellness experience where yoga, music, and the joyful presence of puppies come together. Whether you're a first-timer or returning for another session, every class is designed to help you reset, breathe deeper, and leave smiling.

**Each session includes:**
✨ A 40-minute beginner-friendly yoga class
✨ Puppies roaming freely throughout to interact and cuddle with you
✨ A group photo + 20 minutes of puppy playtime after yoga
✨ Light refreshments available post-session
✨ Mats available for rent

🧳 **What to Bring:**
✔️ Digital or printed booking confirmation
✔️ Water bottle
✔️ Comfortable clothing
✔️ A smile and all the good energy 🐶💛

📞 **Contact Us**
Phone: **+1 (289) 788-1885**
Email: **[afropuppyyoga@gmail.com](mailto:afropuppyyoga@gmail.com)**
Website: **[afropuppyyoga.ca](http://afropuppyyoga.ca)**
**Instagram:** **[@afropuppyyoga](https://www.instagram.com/afropuppyyoga/)**

No yoga experience needed — just bring yourself and your love for puppies. **Spots are limited and go fast, so book early to save yours!**

**Disclaimer:**
We do our best to ensure that the puppies advertised for each class are the ones you'll meet in person. However, please note that puppies are sometimes subject to change due to unforeseen circumstances. If any changes occur, we will provide an update to all registered guests as soon as possible.

Thanks for your understanding and continued support 🐶🧘🏽‍♀️💛`;

export async function createLumaEventForSchedule(params: LumaScheduleParams): Promise<{ lumaEventId: string; lumaEventUrl: string; created: boolean } | null> {
  // Private bookings have their own approval/booking workflow. Never expose
  // them as a public regular-class event with public ticket types.
  if (params.classType !== "regular") return null;
  const apiKey = process.env.LUMA_API_KEY;
  if (!apiKey) {
    console.warn("[LumaSchedule] LUMA_API_KEY not set — skipping");
    return null;
  }

  let eventFields: ReturnType<typeof regularEventFields>;
  try {
    eventFields = regularEventFields(params);
  } catch (error) {
    console.warn(`[LumaSchedule] ${error instanceof Error ? error.message : "Invalid event settings"} — skipping`);
    return null;
  }
  const ticketTypes = buildRegularClassTicketTypes(params.location);

  try {
    // Always query Luma before creating a public page. The database collision
    // check only covers APY HQ rows and cannot see a class added directly in
    // Luma, so it cannot safely prevent calendar duplicates on its own.
    const existing = await findExistingLumaEventForSchedule(apiKey, params);
    if (existing) {
      console.log(`[LumaSchedule] Reusing existing Luma event: ${existing.lumaEventUrl} (${eventFields.name})`);
      return { ...existing, created: false };
    }

    // 1. Create the event
    const createRes = await fetch(`${LUMA_BASE}/events/create`, {
      method: "POST",
      headers: { "x-luma-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        ...eventFields,
        visibility: "public",
        phone_number_requirement: "required",
        name_requirement: "first-last",
        ...REGULAR_CLASS_LUMA_EVENT_DEFAULTS,
        // Providing paid ticket types at creation prevents Luma from adding its
        // automatic free Standard ticket before APY's tickets are configured.
        ticket_types: ticketTypes,
        description_md: APY_DESCRIPTION,
        cover_url: APY_COVER,
        registration_questions: [
          {
            id: "jry47jna",
            label: "How did you hear about us?",
            required: true,
            question_type: "multi-select",
            options: ["Instagram", "Facebook", "Poster", "Word of Mouth"],
          },
          {
            id: "kbrpflwx",
            label: "We\u2019re thinking of creating a cute APY keepsake. Which one would you love more?",
            required: true,
            question_type: "dropdown",
            options: [
              "A puppy yoga coloring book",
              "A jigsaw puzzle with our cutest puppies",
              "I\u2019d actually love both \ud83d\ude2d",
              "Not for me, but sounds cute!",
            ],
          },
          {
            id: "1oy5wt8g",
            label: "Terms and Conditions",
            required: true,
            question_type: "terms",
            terms: {
              content_type: "text",
              content_md: `**AfroPuppyYoga \u2014 Participant Agreement, Waiver & Booking Policy**\n\nBy registering for an AfroPuppyYoga session, you confirm that you have read, understood, and agreed to the following terms.\n\n***\n\n**1\\. Voluntary Participation**\n\nI understand that participation in AfroPuppyYoga involves physical activity, interaction with live puppies, and the use of shared space. I am participating voluntarily and entirely at my own risk.\n\n**2\\. Health & Physical Fitness**\n\nI confirm that I am physically able to participate in light movement or yoga. I understand that modifications are available for all experience levels. I accept full responsibility for my own health and well-being throughout the session.\n\n**3\\. Animal Interaction**\n\nI understand that while our puppies are friendly, well-socialized, and supervised by trained handlers, they are still animals and may behave unpredictably. I agree to treat them with care and respect, and to follow all instructions from the puppy handlers at all times. I waive any and all claims related to minor scratches, puppy accidents, or allergic reactions.\n\n**4\\. Liability Release**\n\nI release AfroPuppyYoga, its instructors, staff, volunteers, puppy handlers, and venue partners from all liability for any injuries, damages, or losses that may occur before, during, or after the session, to the fullest extent permitted by law.\n\n**5\\. Media Release**\n\nI consent to being photographed or filmed during the event and grant AfroPuppyYoga permission to use these materials for promotional and marketing purposes across any platform. If I wish to opt out, I will notify a staff member before the session begins.\n\n***\n\n**6\\. Cancellation & Refund Policy**\n\nWe never want to cancel a class. When we must, it is always due to circumstances outside our control \u2014 puppy availability, instructor emergencies, safety concerns, or venue issues.\n\nBecause of the nature of our business, we are not able to issue cash refunds at this time. All bookings are subject to the following credit policy:\n\n*   **APY-initiated cancellations:** You will automatically receive a full class credit delivered as a coupon code. The code never expires and may be transferred to another person.\n*   **Customer cancellations (more than 24 hours before class):** You will receive a full class credit as a coupon code with no expiry. Email [afropuppyyoga@gmail.com](mailto:afropuppyyoga@gmail.com) with your booking confirmation to receive your code.\n*   **Customer cancellations (within 24 hours) and no-shows:** Credits are not issued. Exceptions may be made for documented emergencies at AfroPuppyYoga\u2019s discretion.\n*   **Ticket transfers:** Tickets and credit codes are transferable to another person. Please notify us before class begins at [afropuppyyoga@gmail.com](mailto:afropuppyyoga@gmail.com).\n\nNo cash refunds are issued under any circumstances, including when AfroPuppyYoga cancels a class.\n\nWe are deeply grateful for your kindness and support. It truly means everything to us. \ud83d\udc3e\n\n***\n\n_By proceeding with registration or signing below, you confirm that you have read and agreed to all of the above._`,
              collect_signature: true,
            },
          },
        ],
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.text();
      console.error(`[LumaSchedule] Create event failed: ${createRes.status} ${err}`);
      return null;
    }

    const createData = (await createRes.json()) as { id: string };
    const lumaEventId = createData.id;

    // 2. Fetch the slug-based URL and independently verify that the created
    // event has not become private, cancelled, hidden, closed, or sold out
    // before any automatic invitations are considered.
    let lumaEventUrl = `https://lu.ma/${lumaEventId}`;
    let invitationEligibilityVerified = false;
    try {
      const getRes = await fetch(`${LUMA_BASE}/events/get?event_id=${lumaEventId}`, {
        headers: { "x-luma-api-key": apiKey },
      });
      if (!getRes.ok) throw new Error(`Luma event verification failed (${getRes.status})`);
      const eventData = (await getRes.json()) as LumaEventLookup;
      const event = eventRecord(eventData);
      const verifiedUrl = firstNonEmptyString(event.url, eventData.url);
      if (verifiedUrl) lumaEventUrl = verifiedUrl;
      invitationEligibilityVerified = isEligibleCreatedLumaEventForInvites(eventData);
      if (!invitationEligibilityVerified) {
        console.warn("[LumaSchedule] New Luma event is not publicly eligible for automatic invitations; no invitations submitted.");
      }
    } catch (verificationError) {
      const detail = verificationError instanceof Error ? verificationError.message : "unknown event-verification error";
      await reportLumaInvitationIssue(`Automatic invitations were skipped because the new Luma event could not be verified: ${detail}`);
    }

    console.log(`[LumaSchedule] Created Luma event: ${lumaEventUrl} (${eventFields.name})`);
    if (invitationEligibilityVerified) {
      await inviteCalendarContactsToCreatedClass(apiKey, lumaEventId, lumaEventUrl, params);
    }
    return { lumaEventId, lumaEventUrl, created: true };
  } catch (err) {
    console.error("[LumaSchedule] Unexpected error:", err);
    return null;
  }
}
