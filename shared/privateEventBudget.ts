import { privateEventPreferencesSchema, validatePrivateEventAttendance, type PrivateEventPreferences } from "./privateEventExperience";
import { PRIVATE_EVENT_PACKAGE_BANDS, type PrivateEventPackageType } from "./privateEventPricing";

/** Owner-approved test rules. Planning only: never use these values to charge or bypass quote approval. */
export const PRIVATE_EVENT_BUDGET_VERSION = "planning-v1-2026-11-20";
export type PrivateEventBudget = {
  kind: "estimate" | "manual" | "incomplete";
  min: number | null;
  max: number | null;
  lines: Array<{ label: string; min: number; max: number }>;
  notes: string[];
  exclusions: string[];
  reason?: string;
  hstMinCents: number | null;
  hstMaxCents: number | null;
  totalMinCents: number | null;
  totalMaxCents: number | null;
  coreOnly: boolean;
};
export const formatBudgetMoney = (value: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: Number.isInteger(value) ? 0 : 2 }).format(value);
export const privateEventBudgetRange = (min: number, max: number) => `${formatBudgetMoney(min)}–${formatBudgetMoney(max)}`;

export function estimatePrivateEventBudget(input: {
  guests: number;
  packageType: PrivateEventPackageType;
  eventPreferences: PrivateEventPreferences;
}): PrivateEventBudget {
  const empty = (kind: "manual" | "incomplete", reason: string): PrivateEventBudget => ({
    kind, reason, min: null, max: null, lines: [], notes: [], exclusions: [],
    hstMinCents: null, hstMaxCents: null, totalMinCents: null, totalMaxCents: null, coreOnly: false,
  });
  if (!Number.isSafeInteger(input.guests) || input.guests < 1 || input.guests > 2000) return empty("incomplete", "Enter total expected attendance from 1 to 2,000 to see budget guidance.");
  const parsed = privateEventPreferencesSchema.safeParse(input.eventPreferences);
  if (!parsed.success) return empty("incomplete", "Complete the duration and any session or simultaneous-attendance fields to see your estimate.");
  const p = parsed.data;
  const attendanceError = validatePrivateEventAttendance(p, input.guests);
  if (attendanceError) return empty("incomplete", attendanceError);
  if (!Object.prototype.hasOwnProperty.call(PRIVATE_EVENT_PACKAGE_BANDS, input.packageType)
      || (p.packagePreference !== "help_me_choose" && p.packagePreference !== input.packageType)) return empty("incomplete", "Choose a matching package preference.");
  const manual = (reason: string) => empty("manual", reason);
  const lines: PrivateEventBudget["lines"] = [];
  const notes = ["Planning range in CAD, not a final quote or availability confirmation. APY must approve the full event scope and price.", "Puppy-team capacity, staffing, venue availability and rest breaks are confirmed after review."];
  const exclusions: string[] = [];
  const standardStudio = p.experience === "puppy_yoga" && p.schedule === "single" && p.venue === "studio" && p.durationMinutes === 60 && input.guests <= 20;
  const coreOnly = !standardStudio || p.packagePreference === "help_me_choose";
  const add = (label: string, min: number, max: number) => lines.push({ label, min, max });
  if (p.schedule === "single") {
    if (input.guests > 20) return manual("More than 20 guests need a reviewed session plan. Choose separate sessions, or ask us to plan your event.");
    if (p.durationMinutes < 60 || p.durationMinutes > 180 || (p.durationMinutes - 60) % 30 !== 0) return manual("Single-event estimates cover 60 to 180 minutes in 30-minute steps. Other timings need a tailored quote.");
    if (standardStudio && p.packagePreference !== "help_me_choose") {
      const band = PRIVATE_EVENT_PACKAGE_BANDS[p.packagePreference];
      add(`${band.name}: one 60-minute studio yoga session`, band.min, band.max);
    } else if (p.experience === "puppy_yoga") add("Core puppy yoga: first 60 minutes", 1500, 1750);
    else add("Core puppy lounge: first 60 minutes, no guided yoga", 1250, 1500);
    const extensions = (p.durationMinutes - 60) / 30;
    if (extensions) add(`${extensions} × 30-minute supervised-interaction extension`, extensions * 250, extensions * 375);
    if (extensions) notes.push("Extensions are supervised puppy interaction, not additional guided yoga. The event window includes any required puppy rest.");
  } else if (p.schedule === "multiple") {
    const sessions = p.sessionCount!;
    if (sessions > 3 || p.guestsPerSession! > 20 || input.guests > 60) return manual("Automatic estimates cover up to three sessions with up to 20 guests per session. Larger plans need a tailored quote.");
    if (p.durationMinutes <= sessions * 60) return manual("Allow more than 60 minutes per session across the full event window so there is time for room resets and puppy rest. We will confirm the schedule.");
    if (p.durationMinutes > sessions * 60 + 60) return manual("This event has a longer gap or operating window. We need to confirm staffing and puppy-team time before estimating it.");
    const yoga = p.experience === "puppy_yoga";
    add(yoga ? "Core puppy yoga: first 60-minute session" : "Core puppy lounge: first 60-minute session", yoga ? 1500 : 1250, yoga ? 1750 : 1500);
    add(`${sessions - 1} additional 60-minute ${yoga ? "yoga" : "lounge"} session${sessions > 2 ? "s" : ""}`, (sessions - 1) * (yoga ? 1000 : 750), (sessions - 1) * (yoga ? 1250 : 1000));
    notes.push("Assumes the same venue and puppy team throughout. Timing must allow room resets and puppy rest; the proposed schedule is not confirmed.");
  } else {
    if (p.experience !== "puppy_lounge") return manual("Short guided-yoga rotations need a tailored schedule and quote. Select Puppy Play & Wellness Lounge for drop-in budget guidance without yoga.");
    if (input.guests > 60 || p.concurrentGuests! > 20) return manual("Drop-in estimates cover up to 60 total visitors with no more than 20 participating at once. Higher attendance needs a reviewed plan.");
    if (![120, 180].includes(p.durationMinutes)) return manual("Drop-in estimates cover a two- or three-hour operating window. Other timings need a tailored quote.");
    add("Core drop-in lounge: two-hour operating window", 2000, 2500);
    if (p.durationMinutes === 180) add("One additional lounge operating hour", 500, 750);
    notes.push("No guided yoga is included. Operating time includes managed rotations and any required puppy rest, not continuous interaction with the same puppies.");
  }
  if (p.venue === "client_venue") exclusions.push("A small off-site delivery/travel fee is confirmed separately and is not included in this estimate.");
  if (coreOnly) {
    if (["signature", "luxury"].includes(p.packagePreference)) exclusions.push(`${p.packagePreference === "signature" ? "Signature" : "Luxury"} is your preference. This is a core-format budget only; premium photography, styling and other upgrades are not priced or included here.`);
    if (p.packagePreference === "help_me_choose") exclusions.push("This is a core-format budget while we help you choose. No Classic, Signature or Luxury package has been selected.");
    exclusions.push("Photography, branding, catering and other requested extras are quoted separately; they are not included in this core-format budget.");
  }
  const min = lines.reduce((sum, line) => sum + line.min, 0);
  const max = lines.reduce((sum, line) => sum + line.max, 0);
  // Integer CAD inputs give exact cents here; HST is 13% for this Ontario service.
  const hstMinCents = min * 13;
  const hstMaxCents = max * 13;
  return { kind: "estimate", min, max, lines, notes, exclusions, hstMinCents, hstMaxCents,
    totalMinCents: min * 100 + hstMinCents, totalMaxCents: max * 100 + hstMaxCents, coreOnly };
}

/** Server-recomputed descriptive record. Not a commercial estimate or payable amount. */
export function formatPrivateEventBudgetSummary(budget: PrivateEventBudget): string {
  if (budget.kind !== "estimate") return `Planning budget: needs review. ${budget.reason ?? "Please complete event details."}`;
  return [
    `Planning budget (${PRIVATE_EVENT_BUDGET_VERSION}): ${privateEventBudgetRange(budget.min!, budget.max!)} CAD before HST${budget.coreOnly ? " (core format only)" : ""}.`,
    ...budget.lines.map(line => `${line.label}: ${privateEventBudgetRange(line.min, line.max)}.`),
    `HST (13%): ${privateEventBudgetRange(budget.hstMinCents! / 100, budget.hstMaxCents! / 100)}.`,
    `Budget including HST, excluding unpriced items: ${privateEventBudgetRange(budget.totalMinCents! / 100, budget.totalMaxCents! / 100)} CAD.`,
    ...budget.exclusions, ...budget.notes,
  ].join("\n");
}
