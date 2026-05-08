/**
 * Chunked video upload endpoints.
 *
 * Flow:
 *   1. POST /api/upload-video-init      → returns { uploadId, key }
 *   2. POST /api/upload-video-chunk     → sends one chunk (≤5MB), returns { received }
 *   3. POST /api/upload-video-complete  → assembles chunks, uploads to S3, returns { url, key }
 *
 * Chunks are stored as temp files: /tmp/chunks/<uploadId>/<chunkIndex>
 * They are cleaned up after a successful complete or after 1 hour (TTL check on init).
 */

import { Router } from "express";
import multer from "multer";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { storagePut } from "./storage";

const router = Router();
const CHUNKS_DIR = path.join(os.tmpdir(), "apy-chunks");
const CHUNK_SIZE_LIMIT = 6 * 1024 * 1024; // 6MB per chunk
const MAX_TOTAL_SIZE = 500 * 1024 * 1024; // 500MB total video limit
const CHUNK_TTL_MS = 60 * 60 * 1000; // 1 hour TTL for abandoned uploads

// Ensure chunks directory exists
if (!fs.existsSync(CHUNKS_DIR)) {
  fs.mkdirSync(CHUNKS_DIR, { recursive: true });
}

// In-memory upload registry: uploadId -> { key, ext, totalChunks, receivedChunks, createdAt }
const uploadRegistry = new Map<string, {
  key: string;
  ext: string;
  totalChunks: number;
  receivedChunks: Set<number>;
  createdAt: number;
}>();

// Clean up abandoned uploads older than TTL
function cleanupExpiredUploads() {
  const now = Date.now();
  for (const [uploadId, meta] of uploadRegistry.entries()) {
    if (now - meta.createdAt > CHUNK_TTL_MS) {
      uploadRegistry.delete(uploadId);
      const uploadDir = path.join(CHUNKS_DIR, uploadId);
      if (fs.existsSync(uploadDir)) {
        fs.rmSync(uploadDir, { recursive: true, force: true });
      }
    }
  }
}

// Multer for individual chunks (max 6MB each)
const chunkUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CHUNK_SIZE_LIMIT },
});

function generateUploadId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * POST /api/upload-video-init
 * Body: { filename: string, totalChunks: number, totalSize: number }
 * Returns: { uploadId: string, key: string }
 */
router.post("/api/upload-video-init", async (req, res) => {
  try {
    cleanupExpiredUploads();

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

    const uploadId = generateUploadId();
    const randomSuffix = Math.random().toString(36).slice(2, 10);
    const key = `applications/videos/${Date.now()}-${randomSuffix}.${ext}`;

    // Create temp directory for this upload
    const uploadDir = path.join(CHUNKS_DIR, uploadId);
    fs.mkdirSync(uploadDir, { recursive: true });

    uploadRegistry.set(uploadId, {
      key,
      ext,
      totalChunks: Number(totalChunks),
      receivedChunks: new Set(),
      createdAt: Date.now(),
    });

    return res.json({ uploadId, key });
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

    const meta = uploadRegistry.get(uploadId);
    if (!meta) {
      return res.status(404).json({ error: "Upload session not found or expired. Please restart the upload." });
    }

    const idx = Number(chunkIndex);
    const chunkPath = path.join(CHUNKS_DIR, uploadId, `chunk-${idx}`);
    fs.writeFileSync(chunkPath, req.file.buffer);
    meta.receivedChunks.add(idx);

    return res.json({ received: meta.receivedChunks.size, total: meta.totalChunks });
  } catch (err: any) {
    console.error("[upload-video-chunk] Error:", err);
    return res.status(500).json({ error: err.message ?? "Chunk upload failed" });
  }
});

/**
 * POST /api/upload-video-complete
 * Body: { uploadId: string }
 * Assembles all chunks, uploads to S3, cleans up temp files.
 * Returns: { url: string, key: string }
 */
router.post("/api/upload-video-complete", async (req, res) => {
  try {
    const { uploadId } = req.body;

    if (!uploadId) {
      return res.status(400).json({ error: "uploadId is required" });
    }

    const meta = uploadRegistry.get(uploadId);
    if (!meta) {
      return res.status(404).json({ error: "Upload session not found or expired. Please restart the upload." });
    }

    // Verify all chunks received
    for (let i = 0; i < meta.totalChunks; i++) {
      if (!meta.receivedChunks.has(i)) {
        return res.status(400).json({ error: `Missing chunk ${i}. Please retry the upload.` });
      }
    }

    // Assemble chunks into a single buffer
    const uploadDir = path.join(CHUNKS_DIR, uploadId);
    const chunks: Buffer[] = [];
    for (let i = 0; i < meta.totalChunks; i++) {
      const chunkPath = path.join(uploadDir, `chunk-${i}`);
      chunks.push(fs.readFileSync(chunkPath));
    }
    const assembled = Buffer.concat(chunks);

    // Determine MIME type from extension
    const mimeMap: Record<string, string> = {
      mp4: "video/mp4",
      mov: "video/quicktime",
      webm: "video/webm",
      avi: "video/x-msvideo",
    };
    const mimeType = mimeMap[meta.ext] ?? "video/mp4";

    // Upload to S3
    const { url } = await storagePut(meta.key, assembled, mimeType);

    // Cleanup
    uploadRegistry.delete(uploadId);
    fs.rmSync(uploadDir, { recursive: true, force: true });

    return res.json({ url, key: meta.key });
  } catch (err: any) {
    console.error("[upload-video-complete] Error:", err);
    return res.status(500).json({ error: err.message ?? "Failed to complete upload" });
  }
});

export default router;
