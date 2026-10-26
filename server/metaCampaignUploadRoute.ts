import { Router } from "express";
import multer from "multer";
import crypto from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { metaAdCampaigns, metaAdCreatives } from "../drizzle/schema";
import { META_CAMPAIGN_MAX_CREATIVES } from "../shared/metaCampaigns";
import { getDb } from "./db";
import { requireApyOwner } from "./_core/requireStaff";
import { inspectCampaignMedia, safeCampaignFilename } from "./metaCampaignMedia";
import { storagePut } from "./storage";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 250 * 1024 * 1024,
    files: 1,
    fields: 3,
    fieldSize: 256,
  },
});

function safeUploadError(error: unknown): string {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") return "Videos must be 250MB or smaller.";
  return "Campaign media could not be uploaded. Please choose one supported image or video file.";
}

router.post("/api/meta-campaigns/assets", requireApyOwner, (req, res, next) => {
  upload.single("creative")(req, res, error => {
    if (error) return res.status(400).json({ error: safeUploadError(error) });
    next();
  });
}, async (req, res) => {
  try {
    res.setHeader("Cache-Control", "private, no-store");
    const campaignId = Number(req.body?.campaignId);
    const replaceCreativeId = req.body?.replaceCreativeId === undefined || req.body?.replaceCreativeId === ""
      ? null
      : Number(req.body.replaceCreativeId);
    if (!Number.isInteger(campaignId) || campaignId < 1) return res.status(400).json({ error: "A valid campaign draft is required before uploading media." });
    if (replaceCreativeId !== null && (!Number.isInteger(replaceCreativeId) || replaceCreativeId < 1)) return res.status(400).json({ error: "The creative to replace is invalid." });
    const file = (req as typeof req & { file?: Express.Multer.File }).file;
    if (!file) return res.status(400).json({ error: "Choose one image or video file." });

    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Campaign storage is temporarily unavailable. Please retry." });
    const [campaign] = await db.select().from(metaAdCampaigns).where(eq(metaAdCampaigns.id, campaignId)).limit(1);
    if (!campaign) return res.status(404).json({ error: "Campaign draft was not found. Refresh APY HQ and try again." });
    if (!["draft", "ready", "blocked", "failed"].includes(campaign.status)) {
      return res.status(409).json({ error: "Media can only be changed while the campaign is still a local draft." });
    }

    const existing = await db.select({ id: metaAdCreatives.id, contentHash: metaAdCreatives.contentHash })
      .from(metaAdCreatives).where(eq(metaAdCreatives.campaignId, campaignId)).orderBy(asc(metaAdCreatives.sortOrder));
    const replacedCreative = replaceCreativeId === null ? null : existing.find(item => item.id === replaceCreativeId);
    if (replaceCreativeId !== null && !replacedCreative) return res.status(404).json({ error: "The creative to replace was not found." });
    if (replaceCreativeId === null && existing.length >= META_CAMPAIGN_MAX_CREATIVES) return res.status(400).json({ error: `A campaign can contain up to ${META_CAMPAIGN_MAX_CREATIVES} ad variations.` });

    const inspection = await inspectCampaignMedia(file.buffer);
    if (!inspection.ok) return res.status(400).json({ error: inspection.message });
    const contentHash = crypto.createHash("sha256").update(file.buffer).digest("hex");
    if (existing.some(item => item.id !== replaceCreativeId && item.contentHash === contentHash)) {
      return res.status(409).json({ error: "Duplicate content is already selected for this campaign." });
    }

    const randomSuffix = crypto.randomBytes(12).toString("hex");
    const key = `meta-campaigns/${campaignId}/${contentHash}-${randomSuffix}.${inspection.metadata.extension}`;
    await storagePut(key, file.buffer, inspection.metadata.mimeType);
    const creativeKey = replacedCreative ? undefined : `creative-${crypto.randomUUID()}`;
    const values = {
      originalFilename: safeCampaignFilename(file.originalname),
      fileKey: key,
      contentHash,
      mediaType: inspection.metadata.kind,
      mimeType: inspection.metadata.mimeType,
      fileSizeBytes: file.size,
      width: inspection.metadata.width,
      height: inspection.metadata.height,
      durationSeconds: inspection.metadata.durationSeconds === null ? null : Math.round(inspection.metadata.durationSeconds),
      validationStatus: "ready",
      validationMessage: "Media is valid and ready.",
      deliveryStatus: "draft",
      metaMediaId: null,
      metaCreativeId: null,
      metaAdId: null,
      lastError: null,
    } as const;
    let creativeId: number;
    if (replacedCreative) {
      await db.update(metaAdCreatives).set(values).where(eq(metaAdCreatives.id, replacedCreative.id));
      creativeId = replacedCreative.id;
    } else {
      const [inserted] = await db.insert(metaAdCreatives).values({ campaignId, creativeKey: creativeKey!, sortOrder: existing.length + 1, ...values });
      creativeId = inserted.insertId;
    }
    const [creative] = await db.select().from(metaAdCreatives).where(eq(metaAdCreatives.id, creativeId)).limit(1);
    if (!creative) throw new Error("Campaign creative was not saved");
    return res.status(201).json({
      id: creative.id,
      creativeKey: creative.creativeKey,
      originalFilename: creative.originalFilename,
      mediaType: creative.mediaType,
      mimeType: creative.mimeType,
      fileSizeBytes: creative.fileSizeBytes,
      width: creative.width,
      height: creative.height,
      durationSeconds: creative.durationSeconds,
      validationStatus: creative.validationStatus,
      validationMessage: creative.validationMessage,
      previewUrl: `/manus-storage/${creative.fileKey}`,
    });
  } catch (error) {
    console.error("[MetaCampaignUpload] campaign media upload failed", error instanceof Error ? error.message : "unknown error");
    return res.status(500).json({ error: "Campaign media could not be stored. Please retry." });
  }
});

export default router;
