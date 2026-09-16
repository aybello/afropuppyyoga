export type PrivateEventQuoteDraftInput = {
  customerName: string;
  organization?: string | null;
  eventType: string;
  guests: number;
  packageType: string;
  eventDate: string;
  startTime: string;
  sessionSchedule?: Array<{ startTime: string; endTime: string }>;
  venue: string;
  basePriceCents: number;
  hstCents: number;
  pricingType: "plus_hst" | "all_in";
  eventUrl: string;
  puppyBreed?: string | null;
};

export type PrivateEventQuoteDraft = {
  subject: string;
  body: string;
};

const STUDIO_VENUES: Record<string, string> = {
  kitchener: "our Kitchener studio, 329 King Street East, Kitchener, ON",
  hamilton: "our Hamilton studio, 2751 Barton Street East, Hamilton, ON",
  oakville: "our Oakville studio, 1670 North Service Road East, Oakville, ON",
};

const PACKAGE_NAMES: Record<string, string> = {
  classic: "Classic Experience",
  signature: "Signature Experience",
  luxury: "Luxury Experience",
};

function formatDate(date: string): string {
  if (!date) return "the agreed date";
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));
}

function formatTime(time: string): string {
  const [hourString, minuteString] = time.split(":");
  const hour = Number(hourString);
  const minute = Number(minuteString || 0);
  if (!Number.isFinite(hour)) return "the agreed time";
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function formatVenue(venue: string): string {
  const normalized = venue.trim().toLowerCase();
  return STUDIO_VENUES[normalized] || venue;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || "there";
}

export function buildPrivateEventQuoteDraft(input: PrivateEventQuoteDraftInput): PrivateEventQuoteDraft {
  const packageName = PACKAGE_NAMES[input.packageType] || "Private Experience";
  const totalCents = input.basePriceCents + input.hstCents;
  const priceLine = input.pricingType === "plus_hst"
    ? `${formatMoney(input.basePriceCents)} + HST (${formatMoney(input.hstCents)}) = ${formatMoney(totalCents)}`
    : `${formatMoney(totalCents)} CAD, HST included`;
  const groupName = input.organization?.trim()
    ? `${input.organization.trim()} team`
    : "your group";
  const experienceName = input.eventType.toLowerCase().includes("corporate")
    ? "private AfroPuppyYoga corporate wellness experience"
    : "private AfroPuppyYoga experience";
  const dateText = formatDate(input.eventDate);
  const timeText = formatTime(input.startTime);
  const sessionSchedule = input.sessionSchedule?.length
    ? input.sessionSchedule
    : [{ startTime: input.startTime, endTime: input.startTime }];
  const sessionTiming = sessionSchedule.length > 1
    ? `Your booking includes ${sessionSchedule.length} private sessions on ${dateText}:\n${sessionSchedule.map((session, index) => `• Session ${index + 1}: ${formatTime(session.startTime)}–${formatTime(session.endTime)}`).join("\n")}\n\nThere will be a 30-minute break between sessions.`
    : `We have prepared a private booking page for ${dateText} at ${timeText}.`;
  const sessionExperience = sessionSchedule.length > 1
    ? `🐶 ${sessionSchedule.length} private puppy yoga sessions, including both booked time slots`
    : "🐶 A private one-hour puppy yoga experience";
  const venueText = formatVenue(input.venue);
  const breedLine = input.puppyBreed?.trim()
    ? `🐾 ${input.puppyBreed.trim()} puppies and dedicated puppy handlers`
    : "🐾 Puppies and dedicated puppy handlers";
  const subjectPrefix = input.organization?.trim() ? `${input.organization.trim()} | ` : "";

  return {
    subject: `${subjectPrefix}Private AfroPuppyYoga Experience | ${dateText} 🐶`,
    body: `Hi ${firstName(input.customerName)},\n\nThank you for reaching out! We would love to host ${groupName} for a ${experienceName}.\n\n${sessionTiming} The event would take place at ${venueText}.\n\nThe ${packageName} for up to ${input.guests} guests includes:\n\n${sessionExperience}\n🧘 Beginner-friendly guided yoga instruction\n${breedLine}\n💛 Supervised puppy interaction and playtime\n🧘 Yoga mats for participants\n🎶 Curated music\n🧼 Venue, setup and cleanup\n\nYour private combined quote:\n${priceLine}\n\nYou can secure both booked sessions with this one private booking link:\n\n${input.eventUrl}\n\nThe booking will be confirmed once payment has been completed. The puppy breed will be confirmed closer to the event based on availability.\n\nWarmly,\nThe AfroPuppyYoga Team`,
  };
}
