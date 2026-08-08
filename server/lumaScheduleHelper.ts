/**
 * Creates a public Luma event page for a regular puppy yoga class (schedule slot).
 * Returns { lumaEventId, lumaEventUrl } on success, or null on failure (non-fatal).
 */

const LUMA_BASE = "https://public-api.luma.com/v1";
const APY_TINT_COLOR = "#9B2335";

// APY public cover image (same as private events)
const APY_COVER = "https://images.lumacdn.com/event-covers/up/fc92575f-4105-4406-a89b-14105f70e638.jpg";

const LOCATION_MAP: Record<string, { fullAddress: string; googlePlaceId: string }> = {
  kitchener: {
    fullAddress: "329 King St E, Kitchener, ON N2G 2L2, Canada",
    googlePlaceId: "ChIJH-amGez0K4gRjJwKZT5ifpU",
  },
  hamilton: {
    fullAddress: "2751 Barton St E, Hamilton, ON L8E 2J8, Canada",
    googlePlaceId: "ChIJj19OTp-YLIgRv4e9qQwDoq8",
  },
  oakville: {
    fullAddress: "1670 North Service Rd E unit 108, Oakville, ON L6H 7G3, Canada",
    googlePlaceId: "ChIJofNPAT9DK4gRAhVcvaHDk7Y",
  },
};

function formatDisplayDate(isoDate: string): string {
  // "2026-08-15" → "Saturday, August 15"
  const d = new Date(isoDate + "T12:00:00");
  return d.toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" });
}

function to12h(time24: string): string {
  // "09:00" → "9:00 AM"
  const [hStr, mStr] = time24.split(":");
  let h = parseInt(hStr, 10);
  const m = mStr ?? "00";
  const period = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${period}`;
}

function buildDescription(params: {
  location: string;
  breed: string;
  classDate: string;
  startTime: string;
  endTime: string;
}): string {
  const dateStr = formatDisplayDate(params.classDate);
  const start = to12h(params.startTime);
  const end = to12h(params.endTime);
  const breed = params.breed && params.breed !== "TBD" ? params.breed : "adorable puppies";

  return `Join us for a fun and relaxing AfroPuppyYoga class in ${params.location} on **${dateStr}** from **${start} to ${end}**!

Roll out your mat, strike a pose, and let ${breed} puppies melt your stress away — all to the sounds of Afrobeats.

**What's included:**
🐶 A one-hour puppy yoga experience
🧘 Beginner-friendly guided yoga instruction
🐾 ${breed} puppies and dedicated puppy handlers
💛 Supervised puppy interaction and playtime
🧘 Yoga mats provided
🎶 Curated Afrobeats playlist
🧼 Venue, setup and cleanup

Spots are limited — secure yours today!

*The puppy breed and final venue details will be confirmed closer to the event based on availability.*`;
}

export async function createLumaEventForSchedule(params: {
  classDate: string;      // "2026-08-15"
  location: string;       // "Kitchener" | "Hamilton" | "Oakville"
  breed: string;
  startTime: string;      // "09:00"
  endTime: string;        // "15:00"
  classType: "regular" | "private";
}): Promise<{ lumaEventId: string; lumaEventUrl: string } | null> {
  const apiKey = process.env.LUMA_API_KEY;
  if (!apiKey) {
    console.warn("[LumaSchedule] LUMA_API_KEY not set — skipping Luma event creation");
    return null;
  }

  const locKey = params.location.toLowerCase().trim();
  const loc = LOCATION_MAP[locKey];
  if (!loc) {
    console.warn(`[LumaSchedule] Unknown location "${params.location}" — skipping`);
    return null;
  }

  // Build ISO 8601 start/end in Toronto timezone
  const [startH, startM] = params.startTime.split(":").map(Number);
  const [endH, endM] = params.endTime.split(":").map(Number);
  const startAt = `${params.classDate}T${String(startH).padStart(2,"0")}:${String(startM).padStart(2,"0")}:00-04:00`;
  const endAt   = `${params.classDate}T${String(endH).padStart(2,"0")}:${String(endM).padStart(2,"0")}:00-04:00`;

  const displayDate = formatDisplayDate(params.classDate);
  const eventName = `AfroPuppyYoga — ${params.location} | ${displayDate}`;

  const description = buildDescription({
    location: params.location,
    breed: params.breed,
    classDate: params.classDate,
    startTime: params.startTime,
    endTime: params.endTime,
  });

  try {
    // 1. Create the event (public, listed)
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
        description_md: description,
        cover_url: APY_COVER,
        tint_color: APY_TINT_COLOR,
        theme: "hypnotic",
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

    // 2. Fetch the actual slug-based URL
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

    console.log(`[LumaSchedule] Created Luma event: ${lumaEventUrl}`);
    return { lumaEventId, lumaEventUrl };
  } catch (err) {
    console.error("[LumaSchedule] Unexpected error:", err);
    return null;
  }
}
