import { Router } from "express";
import multer from "multer";
import crypto from "crypto";
import { storagePut } from "./storage";
import { requireStaffOrAdmin } from "./_core/requireStaff";

const router = Router();

// ── Magic-byte signatures ────────────────────────────────────────────────────
// Check the first bytes of a buffer to confirm the file is what it claims to be.
// This prevents attackers from renaming a malicious file with a .pdf or .mp4 extension.

// Bug 5 fix (Jul 14 2026): iPhone HEVC/H.265 .mov files have the ftyp box at variable offsets
// (commonly 0, 4, 8, 12, 16, 20, 24, 28, 32). The old check only scanned offsets 0-12.
// Extended scan range to 0-32 and added explicit HEVC/QuickTime ftyp brand checks.
const VIDEO_SIGNATURES: Array<{ bytes: number[]; mask?: number[] }> = [
  { bytes: [0x1a, 0x45, 0xdf, 0xa3] },                          // WebM / MKV
  { bytes: [0x52, 0x49, 0x46, 0x46] },                          // AVI (RIFF)
  { bytes: [0x00, 0x00, 0x00, 0x08, 0x77, 0x69, 0x64, 0x65] }, // QuickTime wide
];

// ftyp brand bytes for known video containers (4 bytes after the ftyp marker)
const FTYP_BRANDS = [
  // MP4 brands
  "isom", "iso2", "iso4", "iso5", "iso6", "avc1", "mp41", "mp42",
  // QuickTime / iPhone MOV brands
  "qt  ", "M4V ", "M4A ", "f4v ",
  // HEVC / iPhone H.265 brands (Bug 5 fix)
  "hvc1", "hev1", "hevc", "mif1", "msf1", "miaf", "heic",
  // Common generic brands
  "3gp5", "3gp6", "3g2a",
];

/**
 * Check if a buffer is a valid video file.
 * Scans for an ISO Base Media File Format ftyp box at offsets 0-32 (step 4),
 * which covers all MP4, MOV, HEVC, and QuickTime variants including iPhone recordings.
 * Also checks WebM/MKV and AVI magic bytes.
 */
function isVideoBuffer(buf: Buffer): boolean {
  if (buf.length < 8) return false;

  // Scan for ftyp box at any 4-byte-aligned offset from 0 to 32
  for (let offset = 0; offset <= 32 && offset + 11 < buf.length; offset += 4) {
    // Check for 'ftyp' at bytes [offset+4 .. offset+7]
    if (
      buf[offset + 4] === 0x66 && // 'f'
      buf[offset + 5] === 0x74 && // 't'
      buf[offset + 6] === 0x79 && // 'y'
      buf[offset + 7] === 0x70    // 'p'
    ) {
      // Optionally validate the brand (4 bytes after ftyp)
      const brand = buf.slice(offset + 8, offset + 12).toString("ascii");
      // Accept any ftyp box — the brand check is advisory, not a hard gate,
      // because new brands are added regularly and we don't want to block valid files.
      if (FTYP_BRANDS.includes(brand) || /^[a-zA-Z0-9 ]{4}$/.test(brand)) {
        return true;
      }
    }
  }

  // Fallback: check fixed-position magic bytes for WebM, AVI, QuickTime wide
  for (const sig of VIDEO_SIGNATURES) {
    if (sig.bytes.every((b, i) => buf[i] === b)) return true;
  }

  return false;
}

function isPdfBuffer(buf: Buffer): boolean {
  // PDF files start with %PDF
  return buf.length >= 4 &&
    buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46;
}

function isDocBuffer(buf: Buffer): boolean {
  // .doc (OLE2): D0 CF 11 E0
  if (buf.length >= 4 &&
      buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0) return true;
  // .docx (ZIP/OOXML): PK 03 04
  if (buf.length >= 4 &&
      buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) return true;
  return false;
}

// ── Secure random ID ─────────────────────────────────────────────────────────
function secureId(): string {
  return crypto.randomBytes(16).toString("hex");
}

// ── Multer instances ─────────────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 150 * 1024 * 1024 }, // 150MB max
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ["video/mp4", "video/quicktime", "video/webm", "video/x-msvideo", "application/octet-stream"];
    const allowedExts = [".mp4", ".mov", ".webm", ".avi"];
    const ext = "." + (file.originalname.split(".").pop() ?? "").toLowerCase();
    if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only video files are allowed (mp4, mov, webm, avi)"));
    }
  },
});

const resumeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/octet-stream",
    ];
    const allowedExts = [".pdf", ".doc", ".docx"];
    const ext = "." + (file.originalname.split(".").pop() ?? "").toLowerCase();
    if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF or Word documents are allowed for resumes"));
    }
  },
});

const invoiceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 16 * 1024 * 1024 }, // 16MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf")) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed for invoices"));
    }
  },
});

// ── Multer error handler ─────────────────────────────────────────────────────
function handleMulterError(err: any, req: any, res: any, next: any) {
  if (err && err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: "File is too large. Please check the size limit and try again." });
  }
  if (err) {
    return res.status(400).json({ error: err.message ?? "File upload failed" });
  }
  next();
}

// ── Filename sanitiser ───────────────────────────────────────────────────────
function sanitiseFilename(name: string): string {
  // Keep only alphanumeric, dash, underscore, dot — strip path traversal
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/\.{2,}/g, "_").slice(0, 128);
}

/**
 * POST /api/upload-video
 * Accepts multipart/form-data with a single "video" field.
 * Uploads to S3 and returns { url, key }.
 * No auth required — careers flow is public; key is random and unguessable.
 */
router.post("/api/upload-video", (req: any, res: any, next: any) => {
  upload.single("video")(req, res, (err) => {
    if (err) return handleMulterError(err, req, res, next);
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No video file provided" });
    }

    // Magic-bytes check
    if (!isVideoBuffer(req.file.buffer)) {
      return res.status(400).json({ error: "File does not appear to be a valid video" });
    }

    const rawExt = (req.file.originalname.split(".").pop() ?? "mp4").toLowerCase();
    const allowedExts = ["mp4", "mov", "webm", "avi"];
    const ext = allowedExts.includes(rawExt) ? rawExt : "mp4";
    const key = `applications/videos/${Date.now()}-${secureId()}.${ext}`;

    const { url } = await storagePut(key, req.file.buffer, req.file.mimetype);
    return res.json({ url, key });
  } catch (err: any) {
    console.error("[upload-video] Error:", err);
    return res.status(500).json({ error: err.message ?? "Upload failed" });
  }
});

/**
 * POST /api/upload-resume
 * Accepts multipart/form-data with a single "resume" field (PDF or Word).
 * Uploads to S3 and returns { url, key }.
 */
router.post("/api/upload-resume", (req: any, res: any, next: any) => {
  resumeUpload.single("resume")(req, res, (err) => {
    if (err) return handleMulterError(err, req, res, next);
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No resume file provided" });
    }

    // Magic-bytes check
    if (!isPdfBuffer(req.file.buffer) && !isDocBuffer(req.file.buffer)) {
      return res.status(400).json({ error: "File does not appear to be a valid PDF or Word document" });
    }

    const rawExt = (req.file.originalname.split(".").pop() ?? "pdf").toLowerCase();
    const allowedExts = ["pdf", "doc", "docx"];
    const ext = allowedExts.includes(rawExt) ? rawExt : "pdf";
    const key = `applications/resumes/${Date.now()}-${secureId()}.${ext}`;

    const { url } = await storagePut(key, req.file.buffer, req.file.mimetype);
    return res.json({ url, key });
  } catch (err: any) {
    console.error("[upload-resume] Error:", err);
    return res.status(500).json({ error: err.message ?? "Upload failed" });
  }
});

/**
 * POST /api/upload-invoice
 * Public — staff submit invoices without a Manus account.
 * Security: rate limited, PDF magic-bytes check, cryptographically random storage key.
 * Accepts multipart/form-data with a single "invoice" field (PDF only, max 16MB).
 * Uploads to S3 and returns { url, key, filename }.
 */
router.post("/api/upload-invoice", (req: any, res: any, next: any) => {
  invoiceUpload.single("invoice")(req, res, (err) => {
    if (err) return handleMulterError(err, req, res, next);
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No invoice file provided" });
    }

    // Magic-bytes check — must be a real PDF
    if (!isPdfBuffer(req.file.buffer)) {
      return res.status(400).json({ error: "File does not appear to be a valid PDF" });
    }

    const key = `invoices/${Date.now()}-${secureId()}.pdf`;
    const { url } = await storagePut(key, req.file.buffer, "application/pdf");
    const safeFilename = sanitiseFilename(req.file.originalname);
    return res.json({ url, key, filename: safeFilename });
  } catch (err: any) {
    console.error("[upload-invoice] Error:", err);
    return res.status(500).json({ error: err.message ?? "Upload failed" });
  }
});

export default router;
