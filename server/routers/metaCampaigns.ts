import crypto from "node:crypto";
import { and, asc, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { metaAdCampaigns, metaAdCreatives, metaAdMutationLogs, privateEventInquiries } from "../../drizzle/schema";
import { campaignDraftSchema, calculateMaximumSpendCents, META_CAMPAIGN_MAX_CREATIVES, parseTorontoDateOnly, slugifyCampaign, validateCampaignSafety } from "../../shared/metaCampaigns";
import { getTorontoCalendarDate } from "../../shared/scheduleVisibility";
import { getUpcomingPublicClasses } from "../publicCalendar";
import { createPausedMetaAdSet, createPausedMetaCampaign, createPausedMetaCreative, getMetaAdsConfiguration, inspectMetaAdsConnection, MetaAdsSafeError, preflightMetaAdsIdentity } from "../metaAds";
import { getDb } from "../db";
import { ownerProcedure, router } from "../_core/trpc";
import { campaignSubmissionBlockReason } from "../metaCampaignSubmission";

type CampaignSource = {
  type: "regular_class" | "private_event";
  id: number;
  eventName: string;
  city: string;
  date: string;
  bookingUrl: string;
  ticketPriceCents: number | null;
  seatsRemaining: number | null;
};

const sourceInput = z.object({ type: z.enum(["regular_class", "private_event"]), id: z.number().int().positive() });
const campaignIdInput = z.object({ campaignId: z.number().int().positive() });

function campaignSlug(name: string): string {
  return `${slugifyCampaign(name)}-${crypto.randomBytes(4).toString("hex")}`;
}

function earliestSafeStartDate(eventDate: string): string {
  const event = parseTorontoDateOnly(eventDate);
  if (!event) return getTorontoCalendarDate();
  event.setUTCDate(event.getUTCDate() - 30);
  const candidate = event.toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  const today = getTorontoCalendarDate();
  return candidate > today ? candidate : today;
}

async function listEligibleSources(): Promise<CampaignSource[]> {
  const regular = await getUpcomingPublicClasses().catch(() => []);
  const regularSources: CampaignSource[] = regular.map(item => ({
    type: "regular_class", id: item.id, eventName: `${item.breed} Puppy Yoga`, city: item.location, date: item.classDate,
    bookingUrl: item.lumaEventUrl, ticketPriceCents: item.admissionMinCents, seatsRemaining: null,
  }));
  const db = await getDb();
  if (!db) return regularSources;
  const today = getTorontoCalendarDate();
  const privateRows = await db.select().from(privateEventInquiries).where(and(
    inArray(privateEventInquiries.status, ["booked", "confirmed"]),
    eq(privateEventInquiries.approvalStatus, "approved"),
    isNotNull(privateEventInquiries.bookingLinkPublishedAt),
    isNotNull(privateEventInquiries.lumaEventUrl),
  )).orderBy(asc(privateEventInquiries.preferredDate));
  const privateSources = privateRows.flatMap((item): CampaignSource[] => {
    const date = item.preferredDate?.match(/^\d{4}-\d{2}-\d{2}$/)?.[0] ?? null;
    if (!date || date < today || !item.lumaEventUrl) return [];
    return [{
      type: "private_event", id: item.id, eventName: `${item.eventType} Private Event`, city: item.eventVenue || item.location,
      date, bookingUrl: item.lumaEventUrl, ticketPriceCents: item.finalPriceCents, seatsRemaining: null,
    }];
  });
  return [...regularSources, ...privateSources].sort((a, b) => a.date.localeCompare(b.date));
}

async function resolveEligibleSource(source: z.infer<typeof sourceInput>): Promise<CampaignSource> {
  const eligible = await listEligibleSources();
  const result = eligible.find(item => item.type === source.type && item.id === source.id);
  if (!result) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This APY event is no longer eligible for a new campaign. Refresh the event list and choose an upcoming published event." });
  return result;
}

async function getCampaignOrThrow(campaignId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Campaign storage is temporarily unavailable." });
  const [campaign] = await db.select().from(metaAdCampaigns).where(eq(metaAdCampaigns.id, campaignId)).limit(1);
  if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campaign was not found." });
  return { db, campaign };
}

function campaignDto(campaign: typeof metaAdCampaigns.$inferSelect, creatives: typeof metaAdCreatives.$inferSelect[]) {
  return {
    ...campaign,
    placements: campaign.placements.split(",").filter(Boolean),
    event: { type: campaign.sourceType, id: campaign.sourceId, name: campaign.eventName, city: campaign.eventCity, date: campaign.eventDate, bookingUrl: campaign.canonicalBookingUrl, ticketPriceCents: campaign.ticketPriceCents, seatsRemaining: campaign.seatsRemaining },
    creatives: creatives.map(creative => ({
      ...creative,
      previewUrl: `/manus-storage/${creative.fileKey}`,
    })),
  };
}

export const metaCampaignsRouter = router({
  configuration: ownerProcedure.query(async () => inspectMetaAdsConnection()),

  eligibleSources: ownerProcedure.query(async () => listEligibleSources()),

  list: ownerProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const campaigns = await db.select().from(metaAdCampaigns).orderBy(desc(metaAdCampaigns.createdAt));
    const ids = campaigns.map(item => item.id);
    const creativeRows = ids.length ? await db.select().from(metaAdCreatives).where(inArray(metaAdCreatives.campaignId, ids)).orderBy(asc(metaAdCreatives.sortOrder)) : [];
    return campaigns.map(campaign => campaignDto(campaign, creativeRows.filter(item => item.campaignId === campaign.id)));
  }),

  get: ownerProcedure.input(campaignIdInput).query(async ({ input }) => {
    const { db, campaign } = await getCampaignOrThrow(input.campaignId);
    const creatives = await db.select().from(metaAdCreatives).where(eq(metaAdCreatives.campaignId, campaign.id)).orderBy(asc(metaAdCreatives.sortOrder));
    const mutations = await db.select({ id: metaAdMutationLogs.id, action: metaAdMutationLogs.action, resultStatus: metaAdMutationLogs.resultStatus, safeErrorSummary: metaAdMutationLogs.safeErrorSummary, externalIds: metaAdMutationLogs.externalIds, createdAt: metaAdMutationLogs.createdAt, completedAt: metaAdMutationLogs.completedAt }).from(metaAdMutationLogs).where(eq(metaAdMutationLogs.campaignId, campaign.id)).orderBy(desc(metaAdMutationLogs.createdAt));
    return { ...campaignDto(campaign, creatives), mutations };
  }),

  /** Persists only the selected event and conservative defaults so media can be uploaded before copy is written. */
  beginDraft: ownerProcedure.input(sourceInput).mutation(async ({ input, ctx }) => {
    const source = await resolveEligibleSource(input);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Campaign storage is temporarily unavailable." });
    const startDate = earliestSafeStartDate(source.date);
    const endDate = source.date;
    const budgetCents = 2500;
    const campaignName = `APY | ${source.city} | ${source.eventName} | ${source.date}`.slice(0, 160);
    const [result] = await db.insert(metaAdCampaigns).values({
      sourceType: source.type, sourceId: source.id, eventName: source.eventName, eventCity: source.city, eventDate: source.date,
      canonicalBookingUrl: source.bookingUrl, ticketPriceCents: source.ticketPriceCents, seatsRemaining: source.seatsRemaining,
      campaignName, campaignSlug: campaignSlug(campaignName), primaryText: "", headline: "", description: null,
      callToAction: "BOOK_NOW", placements: "instagram,facebook", budgetType: "daily", budgetCents,
      maximumSpendCents: calculateMaximumSpendCents({ budgetType: "daily", budgetCents, startDate, endDate }),
      startDate, endDate, status: "draft", createdByUserId: ctx.user.id, createdByName: ctx.user.name ?? null,
    });
    return { id: result.insertId };
  }),

  createDraft: ownerProcedure.input(campaignDraftSchema).mutation(async ({ input, ctx }) => {
    const source = await resolveEligibleSource(input.source);
    const safetyError = validateCampaignSafety(input, source.date);
    if (safetyError) throw new TRPCError({ code: "BAD_REQUEST", message: safetyError });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Campaign storage is temporarily unavailable." });
    const slug = campaignSlug(input.campaignName);
    const [result] = await db.insert(metaAdCampaigns).values({
      sourceType: source.type, sourceId: source.id, eventName: source.eventName, eventCity: source.city, eventDate: source.date,
      canonicalBookingUrl: source.bookingUrl, ticketPriceCents: source.ticketPriceCents, seatsRemaining: source.seatsRemaining,
      campaignName: input.campaignName, campaignSlug: slug, primaryText: input.primaryText, headline: input.headline,
      description: input.description || null, callToAction: input.callToAction, placements: input.placements.join(","),
      budgetType: input.budgetType, budgetCents: input.budgetCents, maximumSpendCents: calculateMaximumSpendCents(input),
      startDate: input.startDate, endDate: input.endDate, status: "draft", createdByUserId: ctx.user.id, createdByName: ctx.user.name ?? null,
    });
    return { id: result.insertId, warning: null };
  }),

  updateDraft: ownerProcedure.input(campaignIdInput.merge(campaignDraftSchema.omit({ source: true }))).mutation(async ({ input }) => {
    const { db, campaign } = await getCampaignOrThrow(input.campaignId);
    if (!["draft", "ready", "failed"].includes(campaign.status) || campaign.metaCampaignId || campaign.metaAdSetId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Only a local draft without Meta objects can be edited." });
    const safetyError = validateCampaignSafety(input, campaign.eventDate);
    if (safetyError) throw new TRPCError({ code: "BAD_REQUEST", message: safetyError });
    const existingCreatives = await db.select({ id: metaAdCreatives.id }).from(metaAdCreatives).where(eq(metaAdCreatives.campaignId, campaign.id));
    await db.update(metaAdCampaigns).set({
      campaignName: input.campaignName, primaryText: input.primaryText, headline: input.headline, description: input.description || null,
      callToAction: input.callToAction, placements: input.placements.join(","), budgetType: input.budgetType, budgetCents: input.budgetCents,
      maximumSpendCents: calculateMaximumSpendCents(input), startDate: input.startDate, endDate: input.endDate,
      status: existingCreatives.length ? "ready" : "draft", lastError: null,
    }).where(eq(metaAdCampaigns.id, campaign.id));
    return { success: true, warning: null };
  }),

  deleteCreative: ownerProcedure.input(z.object({ campaignId: z.number().int().positive(), creativeId: z.number().int().positive() })).mutation(async ({ input }) => {
    const { db, campaign } = await getCampaignOrThrow(input.campaignId);
    if (!["draft", "ready", "failed"].includes(campaign.status) || campaign.metaCampaignId || campaign.metaAdSetId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Media cannot be changed after a campaign starts publishing." });
    const [creative] = await db.select().from(metaAdCreatives).where(and(eq(metaAdCreatives.id, input.creativeId), eq(metaAdCreatives.campaignId, campaign.id))).limit(1);
    if (!creative) throw new TRPCError({ code: "NOT_FOUND", message: "Creative was not found." });
    await db.delete(metaAdCreatives).where(eq(metaAdCreatives.id, creative.id));
    const remaining = await db.select().from(metaAdCreatives).where(eq(metaAdCreatives.campaignId, campaign.id)).orderBy(asc(metaAdCreatives.sortOrder));
    await Promise.all(remaining.map((item, index) => db.update(metaAdCreatives).set({ sortOrder: index + 1 }).where(eq(metaAdCreatives.id, item.id))));
    await db.update(metaAdCampaigns).set({ status: remaining.length ? "ready" : "draft" }).where(eq(metaAdCampaigns.id, campaign.id));
    return { success: true };
  }),

  duplicateAsDraft: ownerProcedure.input(campaignIdInput).mutation(async ({ input, ctx }) => {
    const { db, campaign } = await getCampaignOrThrow(input.campaignId);
    const originalCreatives = await db.select().from(metaAdCreatives).where(eq(metaAdCreatives.campaignId, campaign.id)).orderBy(asc(metaAdCreatives.sortOrder));
    const copyDraft = campaignDraftSchema.safeParse({
      source: { type: campaign.sourceType, id: campaign.sourceId }, campaignName: `${campaign.campaignName} (copy)`.slice(0, 160),
      primaryText: campaign.primaryText, headline: campaign.headline, description: campaign.description ?? "",
      callToAction: campaign.callToAction, placements: campaign.placements.split(",").filter((value): value is "facebook" | "instagram" => value === "facebook" || value === "instagram"),
      budgetType: campaign.budgetType, budgetCents: campaign.budgetCents, startDate: campaign.startDate, endDate: campaign.endDate,
    });
    const copyIsReady = originalCreatives.length > 0 && copyDraft.success && !validateCampaignSafety(copyDraft.data, campaign.eventDate);
    const [result] = await db.insert(metaAdCampaigns).values({
      sourceType: campaign.sourceType, sourceId: campaign.sourceId, eventName: campaign.eventName, eventCity: campaign.eventCity, eventDate: campaign.eventDate,
      canonicalBookingUrl: campaign.canonicalBookingUrl, ticketPriceCents: campaign.ticketPriceCents, seatsRemaining: campaign.seatsRemaining,
      campaignName: `${campaign.campaignName} (copy)`.slice(0, 160), campaignSlug: campaignSlug(`${campaign.campaignName}-copy`), primaryText: campaign.primaryText,
      headline: campaign.headline, description: campaign.description, callToAction: campaign.callToAction, placements: campaign.placements,
      budgetType: campaign.budgetType, budgetCents: campaign.budgetCents, maximumSpendCents: campaign.maximumSpendCents,
      startDate: campaign.startDate, endDate: campaign.endDate, status: copyIsReady ? "ready" : "draft", createdByUserId: ctx.user.id, createdByName: ctx.user.name ?? null,
    });
    if (originalCreatives.length) await db.insert(metaAdCreatives).values(originalCreatives.map(item => ({
      campaignId: result.insertId, creativeKey: `creative-${crypto.randomUUID()}`, originalFilename: item.originalFilename, fileKey: item.fileKey,
      contentHash: item.contentHash, mediaType: item.mediaType, mimeType: item.mimeType, fileSizeBytes: item.fileSizeBytes,
      width: item.width, height: item.height, durationSeconds: item.durationSeconds, validationStatus: "ready" as const,
      validationMessage: "Media is valid and ready.", deliveryStatus: "draft", sortOrder: item.sortOrder,
    })));
    return { id: result.insertId };
  }),

  submitToMeta: ownerProcedure.input(z.object({ campaignId: z.number().int().positive(), idempotencyKey: z.string().uuid(), confirm: z.literal(true) })).mutation(async ({ input, ctx }) => {
    const { db, campaign } = await getCampaignOrThrow(input.campaignId);
    const [previous] = await db.select().from(metaAdMutationLogs).where(eq(metaAdMutationLogs.idempotencyKey, input.idempotencyKey)).limit(1);
    if (previous) return { status: previous.resultStatus, message: previous.safeErrorSummary ?? "This submission was already recorded." };
    const submissionBlock = campaignSubmissionBlockReason(campaign);
    if (submissionBlock) throw new TRPCError({ code: "PRECONDITION_FAILED", message: submissionBlock });
    const creatives = await db.select().from(metaAdCreatives).where(eq(metaAdCreatives.campaignId, campaign.id)).orderBy(asc(metaAdCreatives.sortOrder));
    if (!creatives.length || creatives.length > META_CAMPAIGN_MAX_CREATIVES) throw new TRPCError({ code: "PRECONDITION_FAILED", message: `Add 1 to ${META_CAMPAIGN_MAX_CREATIVES} validated ad variations before submitting.` });
    const storedDraft = campaignDraftSchema.safeParse({
      source: { type: campaign.sourceType, id: campaign.sourceId }, campaignName: campaign.campaignName,
      primaryText: campaign.primaryText, headline: campaign.headline, description: campaign.description ?? "",
      callToAction: campaign.callToAction, placements: campaign.placements.split(",").filter((value): value is "facebook" | "instagram" => value === "facebook" || value === "instagram"),
      budgetType: campaign.budgetType, budgetCents: campaign.budgetCents, startDate: campaign.startDate, endDate: campaign.endDate,
    });
    if (!storedDraft.success) throw new TRPCError({ code: "PRECONDITION_FAILED", message: storedDraft.error.issues[0]?.message ?? "Complete the campaign copy, placements, budget, and dates before submitting." });
    const storedSafetyError = validateCampaignSafety(storedDraft.data, campaign.eventDate);
    if (storedSafetyError) throw new TRPCError({ code: "PRECONDITION_FAILED", message: storedSafetyError });
    const currentSource = await resolveEligibleSource({ type: campaign.sourceType, id: campaign.sourceId });
    if (currentSource.bookingUrl !== campaign.canonicalBookingUrl) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The canonical booking link has changed. Refresh the event and review a new draft before submitting." });
    if (currentSource.date !== campaign.eventDate) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The APY event date changed. Refresh the event and review a new draft before submitting." });
    const placements = campaign.placements.split(",").filter((value): value is "facebook" | "instagram" => value === "facebook" || value === "instagram");
    const safetyError = validateCampaignSafety({ budgetType: campaign.budgetType, budgetCents: campaign.budgetCents, startDate: campaign.startDate, endDate: campaign.endDate }, campaign.eventDate);
    if (safetyError) throw new TRPCError({ code: "PRECONDITION_FAILED", message: safetyError });
    const config = getMetaAdsConfiguration();
    const requestId = crypto.randomUUID();
    await db.insert(metaAdMutationLogs).values({ campaignId: campaign.id, internalRequestId: requestId, idempotencyKey: input.idempotencyKey, actorUserId: ctx.user.id, actorName: ctx.user.name ?? null, action: "create_campaign", targetAdAccountId: config.adAccountId, resultStatus: "pending" });
    if (!config.ready) {
      const message = config.reason ?? "The APY Meta Ads connection is not configured.";
      await db.update(metaAdMutationLogs).set({ resultStatus: "failed", safeErrorSummary: message, completedAt: new Date() }).where(eq(metaAdMutationLogs.internalRequestId, requestId));
      await db.update(metaAdCampaigns).set({ status: "ready", lastError: message }).where(eq(metaAdCampaigns.id, campaign.id));
      return { status: "ready" as const, message };
    }
    const claim = await db.update(metaAdCampaigns).set({
      status: "publishing", lastError: null, metaAdAccountId: config.adAccountId, metaFacebookPageId: config.facebookPageId, metaInstagramAccountId: config.instagramAccountId,
    }).where(and(eq(metaAdCampaigns.id, campaign.id), eq(metaAdCampaigns.status, "ready"), isNull(metaAdCampaigns.metaCampaignId), isNull(metaAdCampaigns.metaAdSetId)));
    if (Number((claim as unknown as Array<{ affectedRows?: number }>)[0]?.affectedRows ?? 0) !== 1) {
      const message = "Another submission already claimed this campaign. Refresh APY HQ; no second Meta campaign was created.";
      await db.update(metaAdMutationLogs).set({ resultStatus: "failed", safeErrorSummary: message, completedAt: new Date() }).where(eq(metaAdMutationLogs.internalRequestId, requestId));
      return { status: "blocked" as const, message };
    }
    let externalCampaignId: string | null = null;
    let externalAdSetId: string | null = null;
    try {
      await preflightMetaAdsIdentity();
      const campaignResult = await createPausedMetaCampaign({ name: campaign.campaignName });
      externalCampaignId = campaignResult.campaignId;
      await db.update(metaAdCampaigns).set({ metaCampaignId: externalCampaignId }).where(eq(metaAdCampaigns.id, campaign.id));
      const adSetResult = await createPausedMetaAdSet({ campaignId: externalCampaignId, name: campaign.campaignName, budgetType: campaign.budgetType, budgetCents: campaign.budgetCents, startDate: campaign.startDate, endDate: campaign.endDate, placements });
      externalAdSetId = adSetResult.adSetId;
      await db.update(metaAdCampaigns).set({ metaAdSetId: externalAdSetId }).where(eq(metaAdCampaigns.id, campaign.id));
      const successes: string[] = [];
      const failures: Array<{ creativeId: number; message: string }> = [];
      let unknownCreativeOutcome = false;
      for (const creative of creatives) {
        try {
          const link = new URL(campaign.canonicalBookingUrl);
          link.searchParams.set("utm_source", "meta"); link.searchParams.set("utm_medium", "paid_social"); link.searchParams.set("utm_campaign", campaign.campaignSlug); link.searchParams.set("utm_content", creative.creativeKey);
          const result = await createPausedMetaCreative({ adSetId: externalAdSetId, name: `${campaign.campaignName} | ${creative.creativeKey}`, asset: { fileKey: creative.fileKey, originalFilename: creative.originalFilename, mediaType: creative.mediaType, mimeType: creative.mimeType }, link: link.toString(), primaryText: campaign.primaryText, headline: campaign.headline, description: campaign.description, callToAction: campaign.callToAction });
          await db.update(metaAdCreatives).set({ validationStatus: "created", metaMediaId: result.mediaId, metaCreativeId: result.creativeId, metaAdId: result.adId, deliveryStatus: "paused", lastError: null }).where(eq(metaAdCreatives.id, creative.id));
          successes.push(creative.creativeKey);
        } catch (error) {
          const message = error instanceof MetaAdsSafeError ? error.message : "Meta could not create this ad variation.";
          await db.update(metaAdCreatives).set({ validationStatus: "failed", deliveryStatus: "failed", lastError: message }).where(eq(metaAdCreatives.id, creative.id));
          failures.push({ creativeId: creative.id, message });
          if (error instanceof MetaAdsSafeError && error.kind === "unknown_outcome") { unknownCreativeOutcome = true; break; }
        }
      }
      const partial = failures.length > 0;
      const status = unknownCreativeOutcome ? "blocked" as const : partial ? "partial" as const : "paused" as const;
      const message = unknownCreativeOutcome ? "A creative provider response was uncertain. APY stopped safely; reconciliation is required before any further action." : partial ? `${successes.length} ad variation(s) were created paused; ${failures.length} need reconciliation.` : `${successes.length} ad variation(s) were created in Meta with delivery paused.`;
      await db.update(metaAdCampaigns).set({ status, lastMetaStatus: "PAUSED", lastError: partial ? message : null, submittedAt: new Date() }).where(eq(metaAdCampaigns.id, campaign.id));
      await db.update(metaAdMutationLogs).set({ resultStatus: unknownCreativeOutcome ? "unknown" : partial ? "partial" : "succeeded", safeErrorSummary: partial ? message : null, externalIds: JSON.stringify({ campaignId: externalCampaignId, adSetId: externalAdSetId, creativeKeys: successes }), completedAt: new Date() }).where(eq(metaAdMutationLogs.internalRequestId, requestId));
      return { status, message };
    } catch (error) {
      const unknown = error instanceof MetaAdsSafeError && error.kind === "unknown_outcome";
      const message = error instanceof MetaAdsSafeError ? error.message : "Meta campaign creation failed. No automatic retry was attempted.";
      const requiresReconciliation = unknown || Boolean(externalCampaignId || externalAdSetId);
      await db.update(metaAdCampaigns).set({ status: requiresReconciliation ? "blocked" : "ready", lastError: message }).where(eq(metaAdCampaigns.id, campaign.id));
      await db.update(metaAdMutationLogs).set({ resultStatus: requiresReconciliation ? "unknown" : "failed", safeErrorSummary: message, externalIds: externalCampaignId ? JSON.stringify({ campaignId: externalCampaignId, adSetId: externalAdSetId }) : null, completedAt: new Date() }).where(eq(metaAdMutationLogs.internalRequestId, requestId));
      return { status: requiresReconciliation ? "blocked" as const : "ready" as const, message };
    }
  }),
});
