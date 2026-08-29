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
  APY_REGULAR_CLASS_TICKET_OPTIONS,
  APY_REGULAR_CLASS_TIME_SLOTS,
} from "@shared/lumaClassConfig";

const LUMA_BASE = "https://public-api.luma.com/v1";

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
export function buildRegularClassTicketTypes(): LumaTicketType[] {
  const tickets: LumaTicketType[] = [
    { name: APY_MAT_RENTAL_TICKET.name, type: "paid", cents: APY_MAT_RENTAL_TICKET.cents, currency: "cad" },
  ];

  for (const slot of APY_REGULAR_CLASS_TIME_SLOTS) {
    for (const option of APY_REGULAR_CLASS_TICKET_OPTIONS) {
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

export async function createLumaEventForSchedule(params: LumaScheduleParams): Promise<{ lumaEventId: string; lumaEventUrl: string } | null> {
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
  const ticketTypes = buildRegularClassTicketTypes();

  try {
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

    // 2. Fetch the slug-based URL
    let lumaEventUrl = `https://lu.ma/${lumaEventId}`;
    try {
      const getRes = await fetch(`${LUMA_BASE}/events/get?event_id=${lumaEventId}`, {
        headers: { "x-luma-api-key": apiKey },
      });
      if (getRes.ok) {
        const eventData = (await getRes.json()) as { url?: string };
        if (eventData.url) lumaEventUrl = eventData.url;
      }
    } catch { /* fallback URL is fine */ }

    console.log(`[LumaSchedule] Created Luma event: ${lumaEventUrl} (${eventFields.name})`);
    return { lumaEventId, lumaEventUrl };
  } catch (err) {
    console.error("[LumaSchedule] Unexpected error:", err);
    return null;
  }
}
