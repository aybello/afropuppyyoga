import { z } from "zod";

export const META_CAMPAIGN_MAX_CREATIVES = 10;
export const META_CAMPAIGN_MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const META_CAMPAIGN_MAX_VIDEO_BYTES = 250 * 1024 * 1024;
export const META_CAMPAIGN_MIN_VIDEO_SECONDS = 3;
export const META_CAMPAIGN_MAX_VIDEO_SECONDS = 60;
export const META_CAMPAIGN_MIN_DIMENSION = 600;
export const META_CAMPAIGN_MIN_ASPECT_RATIO = 4 / 5;
export const META_CAMPAIGN_MAX_ASPECT_RATIO = 1.91;
export const META_CAMPAIGN_INTEGER_LIMIT_CENTS = 2_000_000_000;
export const META_CAMPAIGN_DEFAULT_MAX_DURATION_DAYS = 31;
export const META_CAMPAIGN_DEFAULT_MAX_TOTAL_SPEND_CENTS = 500_000;
export const META_CAMPAIGN_DEFAULT_MAX_DAILY_BUDGET_CENTS = 50_000;

export const campaignSourceSchema = z.object({
  type: z.enum(["regular_class", "private_event"]),
  id: z.number().int().positive(),
});

export const campaignPlacementSchema = z.array(z.enum(["facebook", "instagram"]))
  .min(1, "Choose Facebook, Instagram, or both.")
  .max(2)
  .refine(values => new Set(values).size === values.length, "Placements cannot repeat.");

export const campaignDraftSchema = z.object({
  source: campaignSourceSchema,
  campaignName: z.string().trim().min(4, "Enter a campaign name.").max(160),
  primaryText: z.string().trim().min(1, "Enter the primary ad text.").max(2200),
  headline: z.string().trim().min(1, "Enter a headline.").max(255),
  description: z.string().trim().max(255).optional().or(z.literal("")),
  callToAction: z.enum(["BOOK_NOW", "LEARN_MORE"]),
  placements: campaignPlacementSchema,
  budgetType: z.enum(["daily", "total"]),
  budgetCents: z.number().int().min(500, "The minimum budget is CA$5.00.").max(META_CAMPAIGN_INTEGER_LIMIT_CENTS, "The budget is too large."),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid start date."),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid end date."),
});

export type CampaignDraftInput = z.infer<typeof campaignDraftSchema>;

export function parseTorontoDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00-04:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function calculateMaximumSpendCents(input: Pick<CampaignDraftInput, "budgetType" | "budgetCents" | "startDate" | "endDate">): number {
  if (input.budgetType === "total") return input.budgetCents;
  const start = parseTorontoDateOnly(input.startDate);
  const end = parseTorontoDateOnly(input.endDate);
  if (!start || !end || end < start) return input.budgetCents;
  const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  return input.budgetCents * days;
}

export function validateCampaignDates(input: Pick<CampaignDraftInput, "startDate" | "endDate">, today = new Date()): string | null {
  const start = parseTorontoDateOnly(input.startDate);
  const end = parseTorontoDateOnly(input.endDate);
  if (!start || !end) return "Choose valid campaign dates.";
  const todayDate = new Date(today.toLocaleDateString("en-CA", { timeZone: "America/Toronto" }) + "T12:00:00-04:00");
  if (start < todayDate) return "Campaigns cannot start in the past.";
  if (end < start) return "The end date must be on or after the start date.";
  return null;
}

export type CampaignSafetyLimits = {
  maxDurationDays: number;
  maxTotalSpendCents: number;
  maxDailyBudgetCents: number;
};

export const DEFAULT_CAMPAIGN_SAFETY_LIMITS: CampaignSafetyLimits = {
  maxDurationDays: META_CAMPAIGN_DEFAULT_MAX_DURATION_DAYS,
  maxTotalSpendCents: META_CAMPAIGN_DEFAULT_MAX_TOTAL_SPEND_CENTS,
  maxDailyBudgetCents: META_CAMPAIGN_DEFAULT_MAX_DAILY_BUDGET_CENTS,
};

/** Applies hard server-side limits and requires the campaign to finish no later than its selected APY event. */
export function validateCampaignSafety(
  input: Pick<CampaignDraftInput, "budgetType" | "budgetCents" | "startDate" | "endDate">,
  eventDate: string,
  limits: CampaignSafetyLimits = DEFAULT_CAMPAIGN_SAFETY_LIMITS,
  today = new Date(),
): string | null {
  const dateError = validateCampaignDates(input, today);
  if (dateError) return dateError;
  const start = parseTorontoDateOnly(input.startDate)!;
  const end = parseTorontoDateOnly(input.endDate)!;
  const event = parseTorontoDateOnly(eventDate);
  if (!event) return "The selected APY event date is invalid. Refresh the event before publishing.";
  if (end > event) return "The campaign must end on or before the selected APY event date.";
  const durationDays = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (durationDays > limits.maxDurationDays) return `Campaigns are limited to ${limits.maxDurationDays} days.`;
  if (input.budgetType === "daily" && input.budgetCents > limits.maxDailyBudgetCents) return "The daily budget exceeds the configured APY safety limit.";
  const maximumSpend = calculateMaximumSpendCents(input);
  if (!Number.isSafeInteger(maximumSpend) || maximumSpend > META_CAMPAIGN_INTEGER_LIMIT_CENTS) return "The planned maximum spend is too large.";
  if (maximumSpend > limits.maxTotalSpendCents) return "The planned maximum spend exceeds the configured APY safety limit.";
  return null;
}

export function slugifyCampaign(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "apy-campaign";
}

export function appendCampaignAttribution(rawUrl: string, campaignSlug: string, creativeSlug?: string): string {
  const destination = new URL(rawUrl);
  destination.searchParams.set("utm_source", "meta");
  destination.searchParams.set("utm_medium", "paid_social");
  destination.searchParams.set("utm_campaign", campaignSlug.slice(0, 255));
  if (creativeSlug) destination.searchParams.set("utm_content", creativeSlug.slice(0, 255));
  return destination.toString();
}

export function isMetaPlacementAspectRatio(width: number, height: number): boolean {
  if (width < META_CAMPAIGN_MIN_DIMENSION || height < META_CAMPAIGN_MIN_DIMENSION) return false;
  const ratio = width / height;
  return ratio >= META_CAMPAIGN_MIN_ASPECT_RATIO && ratio <= META_CAMPAIGN_MAX_ASPECT_RATIO;
}
