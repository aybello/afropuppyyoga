/**
 * Creates a public Luma event page for a regular puppy yoga class (schedule slot).
 * Matches the exact format of real APY events (Aug 15 2026 style):
 *   - Name: AfroPuppyYoga |📍{Location} |🐶{Breed}
 *   - 3 time slots: 10AM, 11:30AM, 1:30PM — each with Early Bird / Bring a Friend / Group of 3 / Regular tickets
 *   - Mat Rental ticket
 *   - Full APY branded description
 *   - No tint color / no theme (matches real events)
 */

const LUMA_BASE = "https://public-api.luma.com/v1";

// APY cover image (placeholder — swap in puppy photo after creation)
const APY_COVER = "https://images.lumacdn.com/event-covers/oi/e96e9bff-d920-423c-9d67-55dd8b8041a9.jpg";

const LOCATION_MAP: Record<string, { googlePlaceId: string }> = {
  kitchener: { googlePlaceId: "ChIJH-amGez0K4gRjJwKZT5ifpU" },
  hamilton:  { googlePlaceId: "ChIJj19OTp-YLIgRv4e9qQwDoq8" },
  oakville:  { googlePlaceId: "ChIJofNPAT9DK4gRAhVcvaHDk7Y" },
};

// Standard time slots for regular Saturday/Sunday classes (Toronto time, UTC-4 in summer)
// 10:00 AM ET = 14:00 UTC, 11:30 AM ET = 15:30 UTC, 1:30 PM ET = 17:30 UTC
const TIME_SLOTS = [
  { label: "10AM",    startOffsetH: 10, startOffsetM: 0,  endOffsetH: 11, endOffsetM: 0  },
  { label: "11:30AM", startOffsetH: 11, startOffsetM: 30, endOffsetH: 12, endOffsetM: 30 },
  { label: "1:30PM",  startOffsetH: 13, startOffsetM: 30, endOffsetH: 14, endOffsetM: 30 },
];

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

async function createTicketType(apiKey: string, eventId: string, ticket: {
  name: string;
  cents: number;
  maxCapacity: number | null;
  validEndAt?: string;
  validStartAt?: string;
}) {
  const body: Record<string, unknown> = {
    event_id: eventId,
    name: ticket.name,
    type: "paid",
    cents: ticket.cents,
    currency: "cad",
  };
  if (ticket.maxCapacity !== null) body.max_capacity = ticket.maxCapacity;
  if (ticket.validEndAt) body.valid_end_at = ticket.validEndAt;
  if (ticket.validStartAt) body.valid_start_at = ticket.validStartAt;

  const res = await fetch(`${LUMA_BASE}/events/ticket-types/create`, {
    method: "POST",
    headers: { "x-luma-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    console.warn(`[LumaSchedule] Ticket creation failed for "${ticket.name}": ${err}`);
  }
}

export async function createLumaEventForSchedule(params: {
  classDate: string;      // "2026-08-15"
  location: string;       // "Kitchener" | "Hamilton" | "Oakville"
  breed: string;
  startTime: string;      // "09:00" — used for event start (overall window)
  endTime: string;        // "15:00" — used for event end (overall window)
  classType: "regular" | "private";
}): Promise<{ lumaEventId: string; lumaEventUrl: string } | null> {
  const apiKey = process.env.LUMA_API_KEY;
  if (!apiKey) {
    console.warn("[LumaSchedule] LUMA_API_KEY not set — skipping");
    return null;
  }

  const locKey = params.location.toLowerCase().trim();
  const loc = LOCATION_MAP[locKey];
  if (!loc) {
    console.warn(`[LumaSchedule] Unknown location "${params.location}" — skipping`);
    return null;
  }

  const breed = params.breed && params.breed !== "TBD" ? params.breed : "Puppies";
  const eventName = `AfroPuppyYoga |📍${params.location} |🐶${breed}`;

  // Overall event window: first slot start → last slot end (in Toronto summer time UTC-4)
  const firstSlot = TIME_SLOTS[0];
  const lastSlot = TIME_SLOTS[TIME_SLOTS.length - 1];
  const pad = (n: number) => String(n).padStart(2, "0");
  const startAt = `${params.classDate}T${pad(firstSlot.startOffsetH)}:${pad(firstSlot.startOffsetM)}:00-04:00`;
  const endAt   = `${params.classDate}T${pad(lastSlot.endOffsetH)}:${pad(lastSlot.endOffsetM)}:00-04:00`;

  try {
    // 1. Create the event
    const createRes = await fetch(`${LUMA_BASE}/events/create`, {
      method: "POST",
      headers: { "x-luma-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: eventName,
        start_at: startAt,
        end_at: endAt,
        timezone: "America/Toronto",
        visibility: "public",
        geo_address_json: { type: "google", place_id: loc.googlePlaceId },
        phone_number_requirement: "required",
        name_requirement: "first-last",
        description_md: APY_DESCRIPTION,
        cover_url: APY_COVER,
        registration_questions: [
          {
            id: "waiver",
            label: "I acknowledge and accept AfroPuppyYoga's waiver and terms of service. Participants must be 18+ years of age.",
            required: true,
            question_type: "agree-check",
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

    // 2. Remove the default free "Standard" ticket Luma auto-creates
    try {
      const listRes = await fetch(`${LUMA_BASE}/events/ticket-types/list?event_id=${lumaEventId}`, {
        headers: { "x-luma-api-key": apiKey },
      });
      if (listRes.ok) {
        const { entries } = (await listRes.json()) as { entries: Array<{ id: string; type: string; name: string }> };
        for (const t of entries) {
          if (t.type === "free" && t.name === "Standard") {
            await fetch(`${LUMA_BASE}/events/ticket-types/delete`, {
              method: "POST",
              headers: { "x-luma-api-key": apiKey, "Content-Type": "application/json" },
              body: JSON.stringify({ event_ticket_type_id: t.id }),
            });
          }
        }
      }
    } catch { /* non-critical */ }

    // 3. Create ticket types — Mat Rental + 3 time slots × 4 ticket types each
    // Mat Rental (unlimited)
    await createTicketType(apiKey, lumaEventId, { name: "Mat Rental 🧘‍♀️", cents: 250, maxCapacity: null });

    // Per time slot: Early Bird, Bring a Friend, Group of 3, Regular
    for (const slot of TIME_SLOTS) {
      await createTicketType(apiKey, lumaEventId, { name: `${slot.label} Early Bird 🐣❤️`, cents: 5000, maxCapacity: 5 });
      await createTicketType(apiKey, lumaEventId, { name: `${slot.label} Bring a Friend 👯‍♀️`, cents: 9600, maxCapacity: 4 });
      await createTicketType(apiKey, lumaEventId, { name: `${slot.label} Group of 3 👯‍♀️`, cents: 13800, maxCapacity: 1 });
      await createTicketType(apiKey, lumaEventId, { name: `${slot.label} Regular`, cents: 5200, maxCapacity: 4 });
    }

    // 4. Fetch the slug-based URL
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

    console.log(`[LumaSchedule] Created Luma event: ${lumaEventUrl} (${eventName})`);
    return { lumaEventId, lumaEventUrl };
  } catch (err) {
    console.error("[LumaSchedule] Unexpected error:", err);
    return null;
  }
}
