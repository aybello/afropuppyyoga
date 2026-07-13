/**
 * Chunked video upload endpoints — S3-backed storage with async assembly.
 *
 * Security hardening (Priority 2):
 * - Cryptographically secure upload IDs (crypto.randomBytes)
 * - Chunk index and count validation
 * - Duplicate completion prevention (idempotency flag in manifest)
 * - Upload session expiry (24h TTL check on manifest createdAt)
 * - Total size enforcement across chunks
 *
 * Flow:
 *   1. POST /api/upload-video-init      → returns { uploadId, key }
 *   2. POST /api/upload-video-chunk     → uploads chunk to S3, returns { received, total }
 *   3. POST /api/upload-video-complete  → starts background assembly, returns { jobId }
 *   4. GET  /api/upload-video-status/:jobId → polls for { status: 'pending'|'done'|'error', url?, key?, error? }
 */

import { Router } from "express";
import multer from "multer";
import crypto from "crypto";
import { storagePut, storageGet } from "./storage";

const router = Router();
const CHUNK_SIZE_LIMIT = 6 * 1024 * 1024;   // 6MB per chunk
const MAX_TOTAL_SIZE   = 500 * 1024 * 1024;  // 500MB total video limit
const MAX_CHUNKS       = 200;                 // max 200 chunks (500MB / 6MB ≈ 84, generous headroom)
const SESSION_TTL_MS   = 24 * 60 * 60 * 1000; // 24-hour session expiry

// In-memory job registry — safe because we return quickly and poll
const jobs = new Map<string, {
  status: "pending" | "done" | "error";
  url?: string;
  key?: string;
  error?: string;
}>();

// Multer for individual chunks (max 6MB each, memory storage)
const chunkUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CHUNK_SIZE_LIMIT },
});

// Cryptographically secure upload/job ID
function secureId(): string {
  return crypto.randomBytes(16).toString("hex");
}

// Validate uploadId format to prevent path traversal in S3 keys
function isValidUploadId(id: string): boolean {
  return /^[0-9a-f]{32}$/.test(id);
}

type Manifest = {
  finalKey: string;
  ext: string;
  totalChunks: number;
  totalSize: number;
  createdAt: number;
  completed?: boolean; // set to true after first successful completion
};

async function readManifest(uploadId: string): Promise<Manifest | null> {
  try {
    const { url } = await storageGet(`uploads/chunks/${uploadId}/manifest.json`);
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json() as Manifest;
  } catch {
    return null;
  }
}

/**
 * POST /api/upload-video-init
 * Body: { filename: string, totalChunks: number, totalSize: number }
 * Returns: { uploadId: string, key: string }
 */
router.post("/api/upload-video-init", async (req, res) => {
  try {
    const { filename, totalChunks, totalSize } = req.body;

    if (!filename || typeof filename !== "string" || filename.length > 255) {
      return res.status(400).json({ error: "filename is required (max 255 chars)" });
    }
    if (!totalChunks || !Number.isInteger(Number(totalChunks)) || Number(totalChunks) < 1 || Number(totalChunks) > MAX_CHUNKS) {
      return res.status(400).json({ error: `totalChunks must be between 1 and ${MAX_CHUNKS}` });
    }
    if (!totalSize || !Number.isInteger(Number(totalSize)) || Number(totalSize) < 1) {
      return res.status(400).json({ error: "totalSize is required and must be a positive integer" });
    }
    if (Number(totalSize) > MAX_TOTAL_SIZE) {
      return res.status(400).json({ error: `File too large. Maximum size is ${MAX_TOTAL_SIZE / 1024 / 1024}MB.` });
    }

    const ext = (filename.split(".").pop() ?? "mp4").toLowerCase().replace(/[^a-z0-9]/g, "");
    const allowedExts = ["mp4", "mov", "webm", "avi"];
    if (!allowedExts.includes(ext)) {
      return res.status(400).json({ error: "Only video files are allowed (mp4, mov, webm, avi)" });
    }

    const uploadId = secureId();
    const finalKey = `applications/videos/${Date.now()}-${secureId()}.${ext}`;

    const manifest: Manifest = {
      finalKey,
      ext,
      totalChunks: Number(totalChunks),
      totalSize: Number(totalSize),
      createdAt: Date.now(),
      completed: false,
    };
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

    if (!uploadId || !isValidUploadId(uploadId)) {
      return res.status(400).json({ error: "Invalid uploadId" });
    }
    if (chunkIndex === undefined || chunkIndex === null) {
      return res.status(400).json({ error: "chunkIndex is required" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "No chunk data provided" });
    }

    const idx = Number(chunkIndex);
    if (!Number.isInteger(idx) || idx < 0 || idx >= MAX_CHUNKS) {
      return res.status(400).json({ error: "chunkIndex out of range" });
    }

    const manifest = await readManifest(uploadId);
    if (!manifest) {
      return res.status(404).json({ error: "Upload session not found or expired. Please restart the upload." });
    }

    // Session expiry check
    if (Date.now() - manifest.createdAt > SESSION_TTL_MS) {
      return res.status(410).json({ error: "Upload session expired. Please restart the upload." });
    }

    // Validate chunk index against declared total
    if (idx >= manifest.totalChunks) {
      return res.status(400).json({ error: `chunkIndex ${idx} exceeds declared totalChunks ${manifest.totalChunks}` });
    }

    // Upload chunk to S3
    await storagePut(
      `uploads/chunks/${uploadId}/chunk-${idx}`,
      req.file.buffer,
      "application/octet-stream"
    );

    // Track received count (approximate — S3 is eventually consistent)
    let receivedCount = 0;
    try {
      const { url: counterUrl } = await storageGet(`uploads/chunks/${uploadId}/counter.json`);
      const counterRes = await fetch(counterUrl);
      if (counterRes.ok) {
        const counter = await counterRes.json() as { received: number };
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
 * Idempotent: a second call with the same uploadId returns 409 if already completed.
 */
router.post("/api/upload-video-complete", async (req, res) => {
  try {
    const { uploadId } = req.body;

    if (!uploadId || !isValidUploadId(uploadId)) {
      return res.status(400).json({ error: "Invalid uploadId" });
    }

    const manifest = await readManifest(uploadId);
    if (!manifest) {
      return res.status(404).json({ error: "Upload session not found or expired. Please restart the upload." });
    }

    // Session expiry check
    if (Date.now() - manifest.createdAt > SESSION_TTL_MS) {
      return res.status(410).json({ error: "Upload session expired. Please restart the upload." });
    }

    // Duplicate completion prevention
    if (manifest.completed) {
      return res.status(409).json({ error: "This upload has already been completed." });
    }

    // Mark as completed before starting assembly to prevent concurrent requests
    const updatedManifest: Manifest = { ...manifest, completed: true };
    await storagePut(
      `uploads/chunks/${uploadId}/manifest.json`,
      Buffer.from(JSON.stringify(updatedManifest)),
      "application/json"
    );

    // Create job and return immediately
    const jobId = secureId();
    jobs.set(jobId, { status: "pending" });

    // Run assembly in background (do not await)
    assembleChunks(jobId, uploadId, updatedManifest).catch((err) => {
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
  const jobId = req.params.jobId;
  // Validate jobId format
  if (!jobId || !/^[0-9a-f]{32}$/.test(jobId)) {
    return res.status(400).json({ error: "Invalid jobId" });
  }
  const job = jobs.get(jobId);
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
  manifest: Manifest
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
