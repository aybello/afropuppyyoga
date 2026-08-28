/**
 * Chunked video upload endpoints — storage-backed, resumable uploads.
 *
 * Bug fixes (Jul 14 2026):
 *   Bug 1 — In-memory job Map lost across serverless instances → replaced with S3 status.json
 *   Bug 2 — Background assembly killed by serverless container → assembly now runs synchronously
 *            within the /api/upload-video-complete request (server timeout extended to 170s)
 *   Bug 4 — OOM kill from Buffer.concat on large videos → chunks are now assembled
 *            sequentially on ephemeral disk, then streamed to final storage
 *
 * Flow:
 *   1. POST /api/upload-video-init      → returns { uploadId, key }
 *   2. POST /api/upload-video-chunk     → uploads chunk to S3, returns { received, total }
 *   3. POST /api/upload-video-complete  → assembles chunks synchronously, returns { url, key }
 *      (no more polling — response arrives when assembly is done)
 *
 * The status endpoint remains available for completion-response recovery.
 */

import { Router, Request, Response } from "express";
import multer from "multer";
import crypto from "crypto";
import { mkdtemp, open, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { storagePut, storageGet, storagePutFile } from "./storage";
import { isVideoBuffer } from "./videoUploadValidation";
import {
  VIDEO_UPLOAD_LIMITS,
  expectedChunkSize,
  isConsistentUploadShape,
} from "./videoUploadConfig";

export { VIDEO_UPLOAD_LIMITS, expectedChunkSize, isConsistentUploadShape } from "./videoUploadConfig";

const router = Router();
const CHUNK_SIZE_LIMIT = VIDEO_UPLOAD_LIMITS.chunkSizeBytes;
const MAX_TOTAL_SIZE = VIDEO_UPLOAD_LIMITS.maxTotalBytes;
const MAX_CHUNKS = VIDEO_UPLOAD_LIMITS.maxChunks;
const SESSION_TTL_MS = VIDEO_UPLOAD_LIMITS.sessionTtlMs;
const MAX_CONCURRENT_ASSEMBLIES = VIDEO_UPLOAD_LIMITS.maxConcurrentAssembliesPerInstance;

// Store each incoming chunk on ephemeral disk. With several applicants uploading
// concurrently, memoryStorage would retain 5MB per active request before the
// storage proxy upload even begins.
const chunkUpload = multer({
  dest: tmpdir(),
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
  chunkSize: number;
  createdAt: number;
  completed?: boolean;
};

type UploadResult = { url: string; key: string };

// De-duplicate completion retries that land on the same server instance.
const inFlightCompletions = new Map<string, Promise<UploadResult>>();
let activeAssemblyCount = 0;

async function readManifest(uploadId: string): Promise<Manifest | null> {
  try {
    const { url } = await storageGet(`uploads/chunks/${uploadId}/manifest.json`);
    const res = await fetch(url);
    if (!res.ok) return null;
    const manifest = await res.json() as Manifest;
    // Uploads initiated by a cached pre-deployment browser bundle used 5MB
    // chunks but did not persist chunkSize in the manifest.
    manifest.chunkSize ??= VIDEO_UPLOAD_LIMITS.browserChunkSizeBytes;
    if (!isConsistentUploadShape(manifest.totalSize, manifest.totalChunks, manifest.chunkSize)) {
      return null;
    }
    return manifest;
  } catch {
    return null;
  }
}

async function readUploadResult(uploadId: string): Promise<UploadResult | null> {
  try {
    const { url } = await storageGet(`uploads/chunks/${uploadId}/status.json`);
    const response = await fetch(url);
    if (!response.ok) return null;
    const result = await response.json() as UploadResult;
    return result.url && result.key ? result : null;
  } catch {
    return null;
  }
}

async function readVideoHeader(filePath: string): Promise<Buffer> {
  const fileHandle = await open(filePath, "r");
  try {
    const header = Buffer.alloc(64);
    const { bytesRead } = await fileHandle.read(header, 0, header.length, 0);
    return header.subarray(0, bytesRead);
  } finally {
    await fileHandle.close();
  }
}

async function assembleUpload(uploadId: string, manifest: Manifest): Promise<UploadResult> {
  const mimeMap: Record<string, string> = {
    mp4: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
    avi: "video/x-msvideo",
  };
  const mimeType = mimeMap[manifest.ext] ?? "video/mp4";
  const tempDirectory = await mkdtemp(join(tmpdir(), "apy-video-"));
  const tempFile = join(tempDirectory, "applicant-video");
  const fileHandle = await open(tempFile, "wx");
  let assembledBytes = 0;

  try {
    for (let index = 0; index < manifest.totalChunks; index++) {
      const { url: chunkUrl } = await storageGet(`uploads/chunks/${uploadId}/chunk-${index}`);
      const chunkResponse = await fetch(chunkUrl);
      if (!chunkResponse.ok) {
        throw new Error(`Missing video part ${index + 1}. Please retry the upload.`);
      }

      const chunk = Buffer.from(await chunkResponse.arrayBuffer());
      const requiredSize = expectedChunkSize(manifest, index);
      if (chunk.length !== requiredSize) {
        throw new Error(`Video part ${index + 1} is incomplete. Please retry the upload.`);
      }
      if (index === 0 && !isVideoBuffer(chunk)) {
        throw new Error("File does not appear to be a valid video");
      }

      let written = 0;
      while (written < chunk.length) {
        const result = await fileHandle.write(chunk, written, chunk.length - written);
        if (result.bytesWritten < 1) throw new Error("Could not assemble the uploaded video");
        written += result.bytesWritten;
      }
      assembledBytes += chunk.length;
    }

    if (assembledBytes !== manifest.totalSize) {
      throw new Error("Uploaded video size does not match the original file. Please retry.");
    }

    await fileHandle.sync();
    await fileHandle.close();

    const { url } = await storagePutFile(manifest.finalKey, tempFile, mimeType);
    const result = { url, key: manifest.finalKey };

    // Write the reusable result before completed=true. A completion retry can
    // therefore recover even if the final manifest write is interrupted.
    await storagePut(
      `uploads/chunks/${uploadId}/status.json`,
      Buffer.from(JSON.stringify(result)),
      "application/json"
    );
    await storagePut(
      `uploads/chunks/${uploadId}/manifest.json`,
      Buffer.from(JSON.stringify({ ...manifest, completed: true })),
      "application/json"
    );

    console.log(`[upload-video-complete] Assembly done: ${manifest.finalKey} (${assembledBytes} bytes)`);
    return result;
  } finally {
    await fileHandle.close().catch(() => undefined);
    await rm(tempDirectory, { recursive: true, force: true }).catch((error) => {
      console.error("[upload-video-complete] Failed to clean temporary upload file:", error);
    });
  }
}

/**
 * POST /api/upload-video-init
 * Body: { filename: string, totalChunks: number, totalSize: number, chunkSize: number }
 * Returns: { uploadId: string, key: string }
 */
router.post("/api/upload-video-init", async (req: Request, res: Response) => {
  try {
    const { filename, totalChunks, totalSize, chunkSize } = req.body;
    const parsedTotalChunks = Number(totalChunks);
    const parsedTotalSize = Number(totalSize);
    // Keep compatibility with a cached copy of the previous browser bundle.
    const parsedChunkSize = chunkSize === undefined
      ? VIDEO_UPLOAD_LIMITS.browserChunkSizeBytes
      : Number(chunkSize);

    if (!filename || typeof filename !== "string" || filename.length > 255) {
      return res.status(400).json({ error: "filename is required (max 255 chars)" });
    }
    if (!isConsistentUploadShape(parsedTotalSize, parsedTotalChunks, parsedChunkSize)) {
      return res.status(400).json({
        error: `Upload details are invalid. Videos may be up to ${MAX_TOTAL_SIZE / 1024 / 1024}MB in chunks no larger than ${CHUNK_SIZE_LIMIT / 1024 / 1024}MB.`,
      });
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
      totalChunks: parsedTotalChunks,
      totalSize: parsedTotalSize,
      chunkSize: parsedChunkSize,
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
  const uploadedChunk = (req as Request & { file?: Express.Multer.File }).file;
  try {
    const { uploadId, chunkIndex } = req.body;

    if (!uploadId || !isValidUploadId(uploadId)) {
      return res.status(400).json({ error: "Invalid uploadId" });
    }
    if (chunkIndex === undefined || chunkIndex === null) {
      return res.status(400).json({ error: "chunkIndex is required" });
    }
    if (!uploadedChunk) {
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
    if (manifest.completed) {
      return res.status(409).json({ error: "This upload has already been completed." });
    }

    // Validate chunk index against declared total
    if (idx >= manifest.totalChunks) {
      return res.status(400).json({ error: `chunkIndex ${idx} exceeds declared totalChunks ${manifest.totalChunks}` });
    }

    const requiredSize = expectedChunkSize(manifest, idx);
    if (uploadedChunk.size !== requiredSize) {
      return res.status(400).json({
        error: `Video part ${idx + 1} has the wrong size. Please retry that part.`,
      });
    }

    // The first chunk contains the container header. Validating it here rejects
    // renamed executables before they consume an entire upload session.
    if (idx === 0 && !isVideoBuffer(await readVideoHeader(uploadedChunk.path))) {
      return res.status(400).json({ error: "File does not appear to be a valid video" });
    }

    // Upload chunk to S3
    await storagePutFile(
      `uploads/chunks/${uploadId}/chunk-${idx}`,
      uploadedChunk.path,
      "application/octet-stream"
    );

    // Duplicate chunk retries are safe: the same session/index key is replaced.
    return res.json({ received: idx + 1, total: manifest.totalChunks });
  } catch (err: any) {
    console.error("[upload-video-chunk] Error:", err);
    return res.status(500).json({ error: err.message ?? "Chunk upload failed" });
  } finally {
    if (uploadedChunk?.path) {
      await rm(uploadedChunk.path, { force: true }).catch((error) => {
        console.error("[upload-video-chunk] Failed to clean temporary chunk:", error);
      });
    }
  }
});

/**
 * POST /api/upload-video-complete
 *
 * Assembly runs SYNCHRONOUSLY within this request.
 * - No more in-memory job Map (lost across serverless instances)
 * - No more fire-and-forget background task (killed by serverless)
 * - Chunks are written to a temporary file one at a time, keeping RAM bounded
 * - Exact chunk and final byte counts are checked before the final upload
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

    const savedResult = await readUploadResult(uploadId);
    if (savedResult) return res.json(savedResult);

    const manifest = await readManifest(uploadId);
    if (!manifest) {
      return res.status(404).json({ error: "Upload session not found or expired. Please restart the upload." });
    }

    // Session expiry check
    if (Date.now() - manifest.createdAt > SESSION_TTL_MS) {
      return res.status(410).json({ error: "Upload session expired. Please restart the upload." });
    }

    const existingCompletion = inFlightCompletions.get(uploadId);
    if (existingCompletion) return res.json(await existingCompletion);

    if (activeAssemblyCount >= MAX_CONCURRENT_ASSEMBLIES) {
      res.setHeader("Retry-After", "15");
      return res.status(503).json({
        error: "Several videos are being processed right now. Your upload is safe; processing will retry automatically.",
      });
    }

    activeAssemblyCount += 1;
    const completion = assembleUpload(uploadId, manifest);
    inFlightCompletions.set(uploadId, completion);
    try {
      return res.json(await completion);
    } finally {
      activeAssemblyCount -= 1;
      inFlightCompletions.delete(uploadId);
    }
  } catch (err: any) {
    console.error("[upload-video-complete] Error:", err);
    return res.status(500).json({ error: err.message ?? "Failed to assemble video" });
  }
});

/**
 * GET /api/upload-video-status/:uploadId
 * Lightweight recovery endpoint for clients that lose the completion response.
 */
router.get("/api/upload-video-status/:uploadId", async (req: Request, res: Response) => {
  const { uploadId } = req.params;
  if (!isValidUploadId(uploadId)) return res.status(400).json({ error: "Invalid uploadId" });

  const result = await readUploadResult(uploadId);
  if (result) return res.json({ status: "completed", ...result });
  if (inFlightCompletions.has(uploadId)) return res.json({ status: "processing" });

  const manifest = await readManifest(uploadId);
  if (!manifest) return res.status(404).json({ error: "Upload session not found or expired" });
  return res.json({ status: "pending" });
});

export default router;
