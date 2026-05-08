/**
 * Chunked video upload endpoints — S3-backed storage with async assembly.
 *
 * Each chunk is uploaded directly to S3 as a temporary object.
 * On complete, assembly runs in the background and the client polls for the result.
 * This avoids request timeout issues on Cloud Run for large files.
 *
 * Flow:
 *   1. POST /api/upload-video-init      → returns { uploadId, key }
 *   2. POST /api/upload-video-chunk     → uploads chunk to S3, returns { received, total }
 *   3. POST /api/upload-video-complete  → starts background assembly, returns { jobId }
 *   4. GET  /api/upload-video-status/:jobId → polls for { status: 'pending'|'done'|'error', url?, key?, error? }
 */

import { Router } from "express";
import multer from "multer";
import { storagePut, storageGet } from "./storage";

const router = Router();
const CHUNK_SIZE_LIMIT = 6 * 1024 * 1024; // 6MB per chunk
const MAX_TOTAL_SIZE = 500 * 1024 * 1024; // 500MB total video limit

// In-memory job registry — safe because we return quickly and poll
const jobs = new Map<string, { status: "pending" | "done" | "error"; url?: string; key?: string; error?: string }>();

// Multer for individual chunks (max 6MB each, memory storage)
const chunkUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CHUNK_SIZE_LIMIT },
});

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * POST /api/upload-video-init
 * Body: { filename: string, totalChunks: number, totalSize: number }
 * Returns: { uploadId: string, key: string }
 */
router.post("/api/upload-video-init", async (req, res) => {
  try {
    const { filename, totalChunks, totalSize } = req.body;

    if (!filename || !totalChunks || !totalSize) {
      return res.status(400).json({ error: "filename, totalChunks, and totalSize are required" });
    }

    if (totalSize > MAX_TOTAL_SIZE) {
      return res.status(400).json({ error: `File too large. Maximum size is ${MAX_TOTAL_SIZE / 1024 / 1024}MB.` });
    }

    const ext = (filename.split(".").pop() ?? "mp4").toLowerCase();
    const allowedExts = ["mp4", "mov", "webm", "avi"];
    if (!allowedExts.includes(ext)) {
      return res.status(400).json({ error: "Only video files are allowed (mp4, mov, webm, avi)" });
    }

    const uploadId = generateId();
    const randomSuffix = Math.random().toString(36).slice(2, 10);
    const finalKey = `applications/videos/${Date.now()}-${randomSuffix}.${ext}`;

    // Store manifest in S3 so any container instance can read it
    const manifest = { finalKey, ext, totalChunks: Number(totalChunks), createdAt: Date.now() };
    await storagePut(
      `uploads/chunks/${uploadId}/manifest.json`,
      Buffer.from(JSON.stringify(manifest)),
      "application/json"
    );

    return res.json({ uploadId, key: finalKey });
  } catch (err: any) {
    console.error("[upload-video-init] Error:", err);
    return res.status(500).json({ error: err.message ?? "Failed to initiate upload" });
  }
});

/**
 * POST /api/upload-video-chunk
 * Form fields: uploadId, chunkIndex (0-based)
 * Form file: chunk
 * Returns: { received: number, total: number }
 */
router.post("/api/upload-video-chunk", (req: any, res: any, next: any) => {
  chunkUpload.single("chunk")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message ?? "Chunk upload failed" });
    }
    next();
  });
}, async (req, res) => {
  try {
    const { uploadId, chunkIndex } = req.body;

    if (!uploadId || chunkIndex === undefined) {
      return res.status(400).json({ error: "uploadId and chunkIndex are required" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No chunk data provided" });
    }

    const idx = Number(chunkIndex);

    // Read manifest from S3 to get totalChunks
    let manifest: { finalKey: string; ext: string; totalChunks: number; createdAt: number };
    try {
      const { url: manifestUrl } = await storageGet(`uploads/chunks/${uploadId}/manifest.json`);
      const manifestRes = await fetch(manifestUrl);
      if (!manifestRes.ok) throw new Error("Manifest not found");
      manifest = await manifestRes.json();
    } catch {
      return res.status(404).json({ error: "Upload session not found or expired. Please restart the upload." });
    }

    // Upload chunk to S3
    await storagePut(
      `uploads/chunks/${uploadId}/chunk-${idx}`,
      req.file.buffer,
      "application/octet-stream"
    );

    // Track received count
    let receivedCount = 0;
    try {
      const { url: counterUrl } = await storageGet(`uploads/chunks/${uploadId}/counter.json`);
      const counterRes = await fetch(counterUrl);
      if (counterRes.ok) {
        const counter = await counterRes.json();
        receivedCount = counter.received ?? 0;
      }
    } catch {
      receivedCount = 0;
    }
    receivedCount = Math.max(receivedCount, idx + 1);

    await storagePut(
      `uploads/chunks/${uploadId}/counter.json`,
      Buffer.from(JSON.stringify({ received: receivedCount })),
      "application/json"
    );

    return res.json({ received: receivedCount, total: manifest.totalChunks });
  } catch (err: any) {
    console.error("[upload-video-chunk] Error:", err);
    return res.status(500).json({ error: err.message ?? "Chunk upload failed" });
  }
});

/**
 * POST /api/upload-video-complete
 * Body: { uploadId: string }
 * Starts background assembly and returns immediately with { jobId }.
 * Client polls GET /api/upload-video-status/:jobId for the result.
 */
router.post("/api/upload-video-complete", async (req, res) => {
  try {
    const { uploadId } = req.body;

    if (!uploadId) {
      return res.status(400).json({ error: "uploadId is required" });
    }

    // Verify manifest exists before starting job
    let manifest: { finalKey: string; ext: string; totalChunks: number; createdAt: number };
    try {
      const { url: manifestUrl } = await storageGet(`uploads/chunks/${uploadId}/manifest.json`);
      const manifestRes = await fetch(manifestUrl);
      if (!manifestRes.ok) throw new Error("Manifest not found");
      manifest = await manifestRes.json();
    } catch {
      return res.status(404).json({ error: "Upload session not found or expired. Please restart the upload." });
    }

    // Create job and return immediately
    const jobId = generateId();
    jobs.set(jobId, { status: "pending" });

    // Run assembly in background (do not await)
    assembleChunks(jobId, uploadId, manifest).catch((err) => {
      console.error("[upload-video-complete] Background assembly error:", err);
      jobs.set(jobId, { status: "error", error: err.message ?? "Assembly failed" });
    });

    return res.json({ jobId });
  } catch (err: any) {
    console.error("[upload-video-complete] Error:", err);
    return res.status(500).json({ error: err.message ?? "Failed to start upload completion" });
  }
});

/**
 * GET /api/upload-video-status/:jobId
 * Returns: { status: 'pending'|'done'|'error', url?, key?, error? }
 */
router.get("/api/upload-video-status/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }
  return res.json(job);
});

/**
 * Background assembly: fetches all chunks from S3, concatenates, uploads final file.
 */
async function assembleChunks(
  jobId: string,
  uploadId: string,
  manifest: { finalKey: string; ext: string; totalChunks: number; createdAt: number }
) {
  const mimeMap: Record<string, string> = {
    mp4: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
    avi: "video/x-msvideo",
  };
  const mimeType = mimeMap[manifest.ext] ?? "video/mp4";

  const chunkBuffers: Buffer[] = [];
  for (let i = 0; i < manifest.totalChunks; i++) {
    const { url: chunkUrl } = await storageGet(`uploads/chunks/${uploadId}/chunk-${i}`);
    const chunkRes = await fetch(chunkUrl);
    if (!chunkRes.ok) {
      throw new Error(`Missing chunk ${i}. Please retry the upload.`);
    }
    const arrayBuffer = await chunkRes.arrayBuffer();
    chunkBuffers.push(Buffer.from(arrayBuffer));
  }

  const assembled = Buffer.concat(chunkBuffers);
  const { url } = await storagePut(manifest.finalKey, assembled, mimeType);

  jobs.set(jobId, { status: "done", url, key: manifest.finalKey });
  console.log(`[upload-video-complete] Job ${jobId} done: ${url}`);
}

export default router;
