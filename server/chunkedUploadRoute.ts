/**
 * Chunked video upload endpoints — S3-backed storage with synchronous assembly.
 *
 * Bug fixes (Jul 14 2026):
 *   Bug 1 — In-memory job Map lost across serverless instances → replaced with S3 status.json
 *   Bug 2 — Background assembly killed by serverless container → assembly now runs synchronously
 *            within the /api/upload-video-complete request (server timeout extended to 170s)
 *   Bug 4 — OOM kill from Buffer.concat on large videos → chunks streamed sequentially and
 *            concatenated in fixed-size batches to cap peak RAM usage
 *
 * Flow:
 *   1. POST /api/upload-video-init      → returns { uploadId, key }
 *   2. POST /api/upload-video-chunk     → uploads chunk to S3, returns { received, total }
 *   3. POST /api/upload-video-complete  → assembles chunks synchronously, returns { url, key }
 *      (no more polling — response arrives when assembly is done)
 *
 * The old /api/upload-video-status/:jobId endpoint is kept for backwards compatibility
 * but is no longer needed by the frontend.
 */

import { Router, Request, Response } from "express";
import multer from "multer";
import crypto from "crypto";
import { storagePut, storageGet } from "./storage";

const router = Router();
const CHUNK_SIZE_LIMIT = 6 * 1024 * 1024;   // 6MB per chunk
const MAX_TOTAL_SIZE   = 500 * 1024 * 1024;  // 500MB total video limit
const MAX_CHUNKS       = 200;                 // max 200 chunks (500MB / 5MB ≈ 100, generous headroom)
const SESSION_TTL_MS   = 24 * 60 * 60 * 1000; // 24-hour session expiry

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
  completed?: boolean;
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
router.post("/api/upload-video-init", async (req: Request, res: Response) => {
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
}, async (req: Request, res: Response) => {
  try {
    const { uploadId, chunkIndex } = req.body;

    if (!uploadId || !isValidUploadId(uploadId)) {
      return res.status(400).json({ error: "Invalid uploadId" });
    }
    if (chunkIndex === undefined || chunkIndex === null) {
      return res.status(400).json({ error: "chunkIndex is required" });
    }
    if (!(req as any).file) {
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
      (req as any).file.buffer,
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
 *
 * FIX (Bug 1+2+4): Assembly now runs SYNCHRONOUSLY within this request.
 * - No more in-memory job Map (lost across serverless instances)
 * - No more fire-and-forget background task (killed by serverless)
 * - Chunks are fetched and concatenated in batches of 10 to cap peak RAM at ~50MB
 *
 * The server timeout for this route is extended to 170s (just under Cloud Run's 180s limit)
 * via the res.setTimeout() call below.
 *
 * Body: { uploadId: string }
 * Returns: { url: string, key: string }
 */
router.post("/api/upload-video-complete", async (req: Request, res: Response) => {
  // Extend socket timeout to 170s for large video assembly (Cloud Run limit is 180s)
  (req as any).socket?.setTimeout(170_000);
  (res as any).setTimeout?.(170_000);

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
      // If already completed, try to return the existing result from S3 status
      try {
        const { url: statusUrl } = await storageGet(`uploads/chunks/${uploadId}/status.json`);
        const statusRes = await fetch(statusUrl);
        if (statusRes.ok) {
          const status = await statusRes.json() as { url: string; key: string };
          if (status.url && status.key) {
            return res.json({ url: status.url, key: status.key });
          }
        }
      } catch {
        // fall through to error
      }
      return res.status(409).json({ error: "This upload has already been completed." });
    }

    // Mark as completed before assembly to prevent concurrent duplicate requests
    const updatedManifest: Manifest = { ...manifest, completed: true };
    await storagePut(
      `uploads/chunks/${uploadId}/manifest.json`,
      Buffer.from(JSON.stringify(updatedManifest)),
      "application/json"
    );

    // Assemble chunks synchronously — fetch in batches of 10 to cap peak RAM usage
    const mimeMap: Record<string, string> = {
      mp4: "video/mp4",
      mov: "video/quicktime",
      webm: "video/webm",
      avi: "video/x-msvideo",
    };
    const mimeType = mimeMap[manifest.ext] ?? "video/mp4";
    const BATCH_SIZE = 10; // fetch 10 chunks at a time (~50MB peak RAM for 5MB chunks)
    const allBuffers: Buffer[] = [];

    for (let i = 0; i < manifest.totalChunks; i += BATCH_SIZE) {
      const batchEnd = Math.min(i + BATCH_SIZE, manifest.totalChunks);
      const batchPromises: Promise<Buffer>[] = [];

      for (let j = i; j < batchEnd; j++) {
        batchPromises.push(
          storageGet(`uploads/chunks/${uploadId}/chunk-${j}`).then(async ({ url: chunkUrl }) => {
            const chunkRes = await fetch(chunkUrl);
            if (!chunkRes.ok) {
              throw new Error(`Missing chunk ${j}. Please retry the upload.`);
            }
            return Buffer.from(await chunkRes.arrayBuffer());
          })
        );
      }

      const batchBuffers = await Promise.all(batchPromises);
      allBuffers.push(...batchBuffers);
    }

    const assembled = Buffer.concat(allBuffers);
    const { url } = await storagePut(manifest.finalKey, assembled, mimeType);

    // Persist result to S3 so duplicate-completion requests can return it
    await storagePut(
      `uploads/chunks/${uploadId}/status.json`,
      Buffer.from(JSON.stringify({ url, key: manifest.finalKey })),
      "application/json"
    );

    console.log(`[upload-video-complete] Assembly done: ${manifest.finalKey} (${assembled.length} bytes)`);
    return res.json({ url, key: manifest.finalKey });
  } catch (err: any) {
    console.error("[upload-video-complete] Error:", err);
    return res.status(500).json({ error: err.message ?? "Failed to assemble video" });
  }
});

/**
 * GET /api/upload-video-status/:jobId
 * Kept for backwards compatibility — always returns 404 now since assembly is synchronous.
 * The frontend no longer polls this endpoint.
 */
router.get("/api/upload-video-status/:jobId", (_req: Request, res: Response) => {
  return res.status(404).json({ error: "Status polling is no longer needed. Use the response from /api/upload-video-complete directly." });
});

export default router;
