import { createWriteStream, openAsBlob } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { pipeline } from "node:stream/promises";
import ffmpegStatic from "ffmpeg-static";
import { storageGet } from "./storage";
import type { CampaignDraftInput } from "../shared/metaCampaigns";

const META_GRAPH_ROOT = "https://graph.facebook.com";
const DEFAULT_API_VERSION = "v26.0";
const execFileAsync = promisify(execFile);

export type MetaAdsConfiguration = {
  ready: boolean;
  apiVersion: string;
  adAccountId: string | null;
  facebookPageId: string | null;
  instagramAccountId: string | null;
  targeting: Record<string, unknown> | null;
  reason: string | null;
};

type ConfiguredMetaAds = MetaAdsConfiguration & { accessToken: string; adAccountPath: string };
type MetaGraphError = { error?: { message?: string; error_user_msg?: string; code?: number; error_subcode?: number } };
export type MetaPlacement = CampaignDraftInput["placements"][number];

function torontoOffset(dateOnly: string): string {
  const date = new Date(`${dateOnly}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", timeZoneName: "longOffset" }).formatToParts(date);
  const value = parts.find(part => part.type === "timeZoneName")?.value ?? "GMT-05:00";
  const match = value.match(/^GMT([+-])(\d{2}):(\d{2})$/);
  return match ? `${match[1]}${match[2]}${match[3]}` : "-0500";
}

function metaDateTime(dateOnly: string, endOfDay = false): string {
  return `${dateOnly}T${endOfDay ? "23:59:59" : "00:00:00"}${torontoOffset(dateOnly)}`;
}

async function buildVideoThumbnail(inputPath: string): Promise<Buffer> {
  const directory = await mkdtemp(join(tmpdir(), "apy-campaign-thumbnail-"));
  const outputPath = join(directory, "thumbnail.jpg");
  try {
    await execFileAsync(ffmpegStatic ?? "ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-ss", "1", "-i", inputPath, "-frames:v", "1", "-vf", "scale='min(1200,iw)':-2", outputPath], { timeout: 30_000, maxBuffer: 512 * 1024 });
    return await readFile(outputPath);
  } catch {
    throw new MetaAdsSafeError("provider_error", "APY could not create a thumbnail for this video. No video creative was sent to Meta.");
  } finally {
    await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  }
}

function safeId(value: string | undefined): string | null {
  const cleaned = value?.trim() ?? "";
  return /^[0-9]+$/.test(cleaned) ? cleaned : null;
}

export function getMetaAdsConfiguration(env: NodeJS.ProcessEnv = process.env): MetaAdsConfiguration {
  const adAccountId = safeId(env.META_ADS_APY_AD_ACCOUNT_ID);
  const facebookPageId = safeId(env.META_ADS_APY_FACEBOOK_PAGE_ID);
  const instagramAccountId = safeId(env.META_ADS_APY_INSTAGRAM_ACCOUNT_ID);
  const accessToken = env.META_ADS_APY_ACCESS_TOKEN?.trim();
  const accountLock = env.META_ADS_APY_ACCOUNT_LOCK?.trim().toLowerCase();
  const apiVersion = /^v\d+\.\d+$/.test(env.META_ADS_API_VERSION ?? "") ? env.META_ADS_API_VERSION! : DEFAULT_API_VERSION;
  if (!adAccountId || !facebookPageId || !instagramAccountId || !accessToken || accountLock !== "afropuppyyoga") {
    return { ready: false, apiVersion, adAccountId: null, facebookPageId: null, instagramAccountId: null, targeting: null, reason: "The APY Meta Ads connection has not been configured in this deployment." };
  }
  try {
    const targeting = JSON.parse(env.META_ADS_APY_TARGETING_JSON ?? "");
    if (!targeting || typeof targeting !== "object" || Array.isArray(targeting)) throw new Error("invalid targeting");
    return { ready: true, apiVersion, adAccountId, facebookPageId, instagramAccountId, targeting, reason: null };
  } catch {
    return { ready: false, apiVersion, adAccountId: null, facebookPageId: null, instagramAccountId: null, targeting: null, reason: "The APY Meta Ads targeting profile has not been configured safely." };
  }
}

function configuredOrThrow(): ConfiguredMetaAds {
  const config = getMetaAdsConfiguration();
  const accessToken = process.env.META_ADS_APY_ACCESS_TOKEN?.trim();
  if (!config.ready || !config.adAccountId || !config.facebookPageId || !config.instagramAccountId || !accessToken) {
    throw new MetaAdsSafeError("not_configured", config.reason ?? "Meta Ads is not configured.");
  }
  return { ...config, accessToken, adAccountPath: `act_${config.adAccountId}` };
}

export class MetaAdsSafeError extends Error {
  constructor(public readonly kind: "not_configured" | "rejected" | "unknown_outcome" | "provider_error", message: string) {
    super(message);
    this.name = "MetaAdsSafeError";
  }
}

/** Builds exactly the Facebook/Instagram placement restrictions selected by the owner. */
export function buildMetaPlacementTargeting(base: Record<string, unknown>, placements: MetaPlacement[]): Record<string, unknown> {
  if (!placements.length || placements.some(item => item !== "facebook" && item !== "instagram")) {
    throw new MetaAdsSafeError("provider_error", "Choose Facebook, Instagram, or both before submitting the campaign.");
  }
  const selected = new Set(placements);
  const targeting: Record<string, unknown> = { ...base, publisher_platforms: Array.from(selected) };
  if (selected.has("facebook")) targeting.facebook_positions = ["feed"];
  else delete targeting.facebook_positions;
  if (selected.has("instagram")) targeting.instagram_positions = ["stream", "story", "reels"];
  else delete targeting.instagram_positions;
  return targeting;
}

function providerMessage(body: MetaGraphError, fallback: string): string {
  const message = body.error?.error_user_msg || body.error?.message;
  return message ? message.replace(/[\r\n]+/g, " ").slice(0, 400) : fallback;
}

async function graphRequest<T>(path: string, body: URLSearchParams): Promise<T> {
  const config = configuredOrThrow();
  body.set("access_token", config.accessToken);
  let response: Response;
  try {
    response = await fetch(`${META_GRAPH_ROOT}/${config.apiVersion}/${path.replace(/^\//, "")}`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body, signal: AbortSignal.timeout(25_000) });
  } catch {
    // No provider response means the request could have reached Meta. Never auto-retry it.
    throw new MetaAdsSafeError("unknown_outcome", "Meta did not return a response. APY stopped safely to avoid creating a duplicate campaign.");
  }
  const data = await response.json().catch(() => ({})) as T & MetaGraphError;
  if (!response.ok) throw new MetaAdsSafeError("rejected", providerMessage(data, "Meta rejected this campaign request."));
  return data;
}

async function graphGet<T>(path: string, params: URLSearchParams): Promise<T> {
  const config = configuredOrThrow();
  params.set("access_token", config.accessToken);
  let response: Response;
  try {
    response = await fetch(`${META_GRAPH_ROOT}/${config.apiVersion}/${path.replace(/^\//, "")}?${params.toString()}`, { method: "GET", signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new MetaAdsSafeError("provider_error", "APY could not verify the configured Meta account. No campaign was created.");
  }
  const data = await response.json().catch(() => ({})) as T & MetaGraphError;
  if (!response.ok) throw new MetaAdsSafeError("provider_error", providerMessage(data, "APY could not verify the configured Meta account. No campaign was created."));
  return data;
}

async function graphFileRequest<T>(path: string, field: string, file: { data?: Buffer; filePath?: string; filename: string; mimeType: string }, values: Record<string, string>): Promise<T> {
  const config = configuredOrThrow();
  const form = new FormData();
  form.set("access_token", config.accessToken);
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  const blob = file.filePath
    ? await openAsBlob(file.filePath, { type: file.mimeType })
    : new Blob([file.data!.buffer.slice(file.data!.byteOffset, file.data!.byteOffset + file.data!.byteLength) as ArrayBuffer], { type: file.mimeType });
  form.append(field, blob, file.filename);
  let response: Response;
  try {
    response = await fetch(`${META_GRAPH_ROOT}/${config.apiVersion}/${path.replace(/^\//, "")}`, { method: "POST", body: form, signal: AbortSignal.timeout(60_000) });
  } catch {
    throw new MetaAdsSafeError("unknown_outcome", "Meta did not return a response while uploading media. APY stopped safely to avoid a duplicate upload.");
  }
  const data = await response.json().catch(() => ({})) as T & MetaGraphError;
  if (!response.ok) throw new MetaAdsSafeError("rejected", providerMessage(data, "Meta rejected this creative media."));
  return data;
}

export async function inspectMetaAdsConnection(): Promise<{ status: "configured" | "not_configured"; account: Pick<MetaAdsConfiguration, "adAccountId" | "facebookPageId" | "instagramAccountId"> | null; reason: string | null }> {
  const config = getMetaAdsConfiguration();
  if (!config.ready) return { status: "not_configured", account: null, reason: config.reason };
  return { status: "configured", account: { adAccountId: config.adAccountId, facebookPageId: config.facebookPageId, instagramAccountId: config.instagramAccountId }, reason: null };
}

/** Read-only binding check: the token must access this APY account and Page must own the configured Instagram identity. */
export async function preflightMetaAdsIdentity(): Promise<void> {
  const config = configuredOrThrow();
  const account = await graphGet<{ account_id?: string }>(config.adAccountPath, new URLSearchParams({ fields: "account_id" }));
  if (account.account_id !== config.adAccountId) throw new MetaAdsSafeError("provider_error", "The configured APY ad account could not be verified. No campaign was created.");
  const page = await graphGet<{ instagram_business_account?: { id?: string } }>(config.facebookPageId!, new URLSearchParams({ fields: "instagram_business_account{id}" }));
  if (page.instagram_business_account?.id !== config.instagramAccountId) throw new MetaAdsSafeError("provider_error", "The configured APY Facebook Page and Instagram identity do not match. No campaign was created.");
}

export async function createPausedMetaCampaign(input: { name: string }): Promise<{ campaignId: string }> {
  const config = configuredOrThrow();
  const campaign = await graphRequest<{ id: string }>(`${config.adAccountPath}/campaigns`, new URLSearchParams({ name: input.name, objective: "LINK_CLICKS", status: "PAUSED", special_ad_categories: "[]" }));
  if (!campaign.id) throw new MetaAdsSafeError("unknown_outcome", "Meta returned a campaign response without an ID. APY stopped safely for reconciliation.");
  return { campaignId: campaign.id };
}

export async function createPausedMetaAdSet(input: { campaignId: string; name: string; budgetType: "daily" | "total"; budgetCents: number; startDate: string; endDate: string; placements: MetaPlacement[] }): Promise<{ adSetId: string }> {
  const config = configuredOrThrow();
  const budgetField = input.budgetType === "daily" ? "daily_budget" : "lifetime_budget";
  const endTime = metaDateTime(input.endDate, true);
  const requestedStartTime = metaDateTime(input.startDate);
  const requestedStart = new Date(requestedStartTime);
  const effectiveStartTime = requestedStart.getTime() > Date.now()
    ? requestedStartTime
    : new Date(Date.now() + 5 * 60 * 1000).toISOString();
  if (new Date(effectiveStartTime).getTime() >= new Date(endTime).getTime()) {
    throw new MetaAdsSafeError("provider_error", "The selected APY event ends too soon for Meta to start this campaign safely.");
  }
  const adsetBody = new URLSearchParams({
    name: `${input.name} | APY standard audience`, campaign_id: input.campaignId, [budgetField]: String(input.budgetCents),
    targeting: JSON.stringify(buildMetaPlacementTargeting(config.targeting!, input.placements)), status: "PAUSED",
    start_time: effectiveStartTime, end_time: endTime,
    billing_event: "IMPRESSIONS", optimization_goal: "LINK_CLICKS",
  });
  const adSet = await graphRequest<{ id: string }>(`${config.adAccountPath}/adsets`, adsetBody);
  if (!adSet.id) throw new MetaAdsSafeError("unknown_outcome", "Meta returned an ad set response without an ID. APY stopped safely for reconciliation.");
  return { adSetId: adSet.id };
}

export async function createPausedMetaCreative(input: {
  adSetId: string; name: string; asset: { fileKey: string; originalFilename: string; mediaType: "image" | "video"; mimeType: string };
  link: string; primaryText: string; headline: string; description: string | null; callToAction: "BOOK_NOW" | "LEARN_MORE";
}): Promise<{ mediaId: string; creativeId: string; adId: string }> {
  const config = configuredOrThrow();
  const { url } = await storageGet(input.asset.fileKey);
  const assetResponse = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!assetResponse.ok) throw new MetaAdsSafeError("provider_error", "APY could not read the approved creative from secure storage.");
  const directory = await mkdtemp(join(tmpdir(), "apy-campaign-media-"));
  const extension = input.asset.mimeType === "video/quicktime" ? "mov" : input.asset.mediaType === "video" ? "mp4" : input.asset.originalFilename.split(".").pop() || "bin";
  const mediaPath = join(directory, `creative.${extension}`);
  try {
    if (!assetResponse.body) throw new MetaAdsSafeError("provider_error", "APY could not stream the approved creative from secure storage.");
    await pipeline(assetResponse.body as any, createWriteStream(mediaPath, { flags: "wx" }));
    const data = input.asset.mediaType === "image" ? await readFile(mediaPath) : undefined;
  let mediaId: string;
  let objectStorySpec: Record<string, unknown>;
  if (input.asset.mediaType === "image") {
    const upload = await graphFileRequest<{ images?: Record<string, { hash?: string }> }>(`${config.adAccountPath}/adimages`, "filename", { data, filename: input.asset.originalFilename, mimeType: input.asset.mimeType }, { name: input.name });
    const image = Object.values(upload.images ?? {})[0];
    mediaId = image?.hash ?? "";
    if (!mediaId) throw new MetaAdsSafeError("unknown_outcome", "Meta returned an image response without a reference. APY stopped safely for reconciliation.");
    objectStorySpec = { page_id: config.facebookPageId, instagram_actor_id: config.instagramAccountId, link_data: { message: input.primaryText, name: input.headline, description: input.description || undefined, link: input.link, image_hash: mediaId, call_to_action: { type: input.callToAction, value: { link: input.link } } } };
  } else {
    const upload = await graphFileRequest<{ id?: string; video_id?: string }>(`${config.adAccountPath}/advideos`, "source", { filePath: mediaPath, filename: input.asset.originalFilename, mimeType: input.asset.mimeType }, { title: input.name });
    mediaId = upload.video_id ?? upload.id ?? "";
    if (!mediaId) throw new MetaAdsSafeError("unknown_outcome", "Meta returned a video response without a reference. APY stopped safely for reconciliation.");
    const thumbnail = await buildVideoThumbnail(mediaPath);
    const thumbnailUpload = await graphFileRequest<{ images?: Record<string, { hash?: string }> }>(`${config.adAccountPath}/adimages`, "filename", { data: thumbnail, filename: `${input.name}-thumbnail.jpg`, mimeType: "image/jpeg" }, { name: `${input.name}-thumbnail` });
    const thumbnailHash = Object.values(thumbnailUpload.images ?? {})[0]?.hash ?? "";
    if (!thumbnailHash) throw new MetaAdsSafeError("unknown_outcome", "Meta returned a video thumbnail response without a reference. APY stopped safely for reconciliation.");
    objectStorySpec = { page_id: config.facebookPageId, instagram_actor_id: config.instagramAccountId, video_data: { video_id: mediaId, image_hash: thumbnailHash, message: input.primaryText, title: input.headline, call_to_action: { type: input.callToAction, value: { link: input.link } } } };
  }
  const creative = await graphRequest<{ id: string }>(`${config.adAccountPath}/adcreatives`, new URLSearchParams({ name: input.name, object_story_spec: JSON.stringify(objectStorySpec) }));
  if (!creative.id) throw new MetaAdsSafeError("unknown_outcome", "Meta returned an ad creative response without an ID. APY stopped safely for reconciliation.");
  const ad = await graphRequest<{ id: string }>(`${config.adAccountPath}/ads`, new URLSearchParams({ name: input.name, adset_id: input.adSetId, creative: JSON.stringify({ creative_id: creative.id }), status: "PAUSED" }));
  if (!ad.id) throw new MetaAdsSafeError("unknown_outcome", "Meta returned an ad response without an ID. APY stopped safely for reconciliation.");
  return { mediaId, creativeId: creative.id, adId: ad.id };
  } finally {
    await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  }
}
