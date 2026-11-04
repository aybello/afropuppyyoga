import { z } from "zod";

export const PRIVATE_EVENT_EXPERIENCES = {
  puppy_yoga: {
    name: "Private Puppy Yoga",
    description: "Move, unwind and meet the puppies. A standard 60-minute experience with approximately 40 minutes of guided yoga and 20 minutes of puppy play.",
  },
  puppy_lounge: {
    name: "Puppy Play & Wellness Lounge",
    description: "Puppy cuddles without a guided yoga class. Supervised interaction for office socials, campuses and celebrations.",
  },
} as const;
export const PRIVATE_EVENT_SCHEDULES = {
  single: "One scheduled session",
  multiple: "Multiple sessions for separate groups",
  drop_in: "Drop-in or short rotations",
} as const;
export const PRIVATE_EVENT_VENUES = { studio: "At an APY studio / partner space", client_venue: "At your venue" } as const;
export const PRIVATE_EVENT_FORMAT_PRICE_NOTE = "Package bands apply to standard 60-minute studio puppy yoga for up to 20 guests. Lounge, multiple-session, drop-in, off-site and other custom scopes receive a quote for the full event, not an automatic per-session price.";
export const PRIVATE_EVENT_CUSTOM_SCOPE_NOTE = "Pricing depends on the experience, schedule, attendance, venue and delivery costs. Off-site travel is quoted separately. HST applies. Your final quote will state the full event price and agreed scope.";

export const privateEventPreferencesSchema = z.object({
  experience: z.enum(["puppy_yoga", "puppy_lounge"]),
  schedule: z.enum(["single", "multiple", "drop_in"]),
  venue: z.enum(["studio", "client_venue"]),
  packagePreference: z.enum(["classic", "signature", "luxury", "help_me_choose"]),
  durationMinutes: z.number().int().min(15).max(1440),
  sessionCount: z.number().int().min(2).max(100).optional(),
  guestsPerSession: z.number().int().min(1).max(2000).optional(),
  concurrentGuests: z.number().int().min(1).max(2000).optional(),
  scheduleNotes: z.string().max(2000).default(""),
  venueDetails: z.string().max(1000).default(""),
}).superRefine((value, ctx) => {
  if (value.schedule === "multiple") {
    if (value.sessionCount === undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["sessionCount"], message: "Tell us how many sessions you prefer." });
    if (value.guestsPerSession === undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["guestsPerSession"], message: "Tell us the expected guests per session." });
  }
  if (value.schedule === "drop_in" && value.concurrentGuests === undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["concurrentGuests"], message: "Tell us the approximate number participating at once." });
});
export type PrivateEventPreferences = z.infer<typeof privateEventPreferencesSchema>;

const STORED_EVENT_SCOPE_PREFIX = "APY EVENT PREFERENCES v1\n";
export function storePrivateEventScope(summary: string, clientNotes?: string): string {
  return STORED_EVENT_SCOPE_PREFIX + [summary, clientNotes ? `Client notes: ${clientNotes}` : ""].filter(Boolean).join("\n\n");
}
export function readStoredPrivateEventScope(notes?: string | null): string | undefined {
  if (!notes?.startsWith(STORED_EVENT_SCOPE_PREFIX)) return undefined;
  const scope = notes.slice(STORED_EVENT_SCOPE_PREFIX.length);
  return scope.startsWith("Preferred experience: ") && scope.includes("\nSchedule: ") && scope.includes("\nVenue choice: ") ? scope : undefined;
}

export function privateEventScopeRequiresCustomQuote(preferences?: Partial<PrivateEventPreferences>): boolean {
  // No preferences means the previous API contract; do not reinterpret historic inquiries.
  if (!preferences) return false;
  return preferences.experience !== "puppy_yoga" || preferences.schedule !== "single"
    || preferences.venue !== "studio" || preferences.durationMinutes !== 60
    || preferences.packagePreference === "help_me_choose";
}

export function validatePrivateEventAttendance(preferences: PrivateEventPreferences, totalGuests: number): string | null {
  if (preferences.schedule === "multiple" && preferences.guestsPerSession! > totalGuests) return "Guests per session cannot exceed total attendance.";
  if (preferences.schedule === "multiple" && preferences.sessionCount! * preferences.guestsPerSession! < totalGuests) return "Your session plan needs space for the total attendance. Increase sessions or guests per session.";
  if (preferences.schedule === "drop_in" && preferences.concurrentGuests! > totalGuests) return "Guests participating at once cannot exceed total attendance.";
  return null;
}

export function formatPrivateEventPreferences(preferences: PrivateEventPreferences): string {
  const lines = [
    `Preferred experience: ${PRIVATE_EVENT_EXPERIENCES[preferences.experience].name}`,
    `Schedule: ${PRIVATE_EVENT_SCHEDULES[preferences.schedule]}`,
    `Venue choice: ${PRIVATE_EVENT_VENUES[preferences.venue]}`,
    `Preferred package level: ${preferences.packagePreference === "help_me_choose" ? "Help me choose" : preferences.packagePreference.charAt(0).toUpperCase() + preferences.packagePreference.slice(1)}`,
    `${preferences.schedule === "drop_in" ? "Lounge operating time" : "Total event duration"}: ${preferences.durationMinutes} minutes`,
    ...(preferences.schedule === "multiple" ? [`Number of sessions: ${preferences.sessionCount}`, `Expected guests per session: ${preferences.guestsPerSession}`] : []),
    ...(preferences.schedule === "drop_in" ? [`Approximate guests participating at once: ${preferences.concurrentGuests}`] : []),
    ...(preferences.scheduleNotes ? [`Preferred schedule: ${preferences.scheduleNotes}`] : []),
    ...(preferences.venueDetails ? [`Venue details: ${preferences.venueDetails}`] : []),
    "Session timing, capacity, setup, room resets and puppy rest will be confirmed in the final scope.",
  ];
  return lines.join("\n");
}
