import { Router } from "express";
import multer from "multer";
import { storagePut } from "./storage";

const router = Router();

// Use memory storage — we stream to S3 immediately
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

// ── Multer error handler middleware ─────────────────────────────────────────
function handleMulterError(err: any, req: any, res: any, next: any) {
  if (err && err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: "File is too large. Please check the size limit and try again." });
  }
  if (err) {
    return res.status(400).json({ error: err.message ?? "File upload failed" });
  }
  next();
}

/**
 * POST /api/upload-video
 * Accepts multipart/form-data with a single "video" field.
 * Uploads to S3 and returns { url, key }.
 * No auth required — the key is random and unguessable.
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

    const ext = req.file.originalname.split(".").pop() ?? "mp4";
    const randomSuffix = Math.random().toString(36).slice(2, 10);
    const key = `applications/videos/${Date.now()}-${randomSuffix}.${ext}`;

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

    const ext = req.file.originalname.split(".").pop() ?? "pdf";
    const randomSuffix = Math.random().toString(36).slice(2, 10);
    const key = `applications/resumes/${Date.now()}-${randomSuffix}.${ext}`;

    const { url } = await storagePut(key, req.file.buffer, req.file.mimetype);

    return res.json({ url, key });
  } catch (err: any) {
    console.error("[upload-resume] Error:", err);
    return res.status(500).json({ error: err.message ?? "Upload failed" });
  }
});

/**
 * POST /api/upload-invoice
 * Accepts multipart/form-data with a single "invoice" field (PDF only, max 16MB).
 * Uploads to S3 and returns { url, key, filename }.
 * Used by InvoiceSubmit page instead of base64-over-tRPC to avoid body-size limits on the platform.
 */
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
    const randomSuffix = Math.random().toString(36).slice(2, 10);
    const key = `invoices/${Date.now()}-${randomSuffix}.pdf`;
    const { url } = await storagePut(key, req.file.buffer, "application/pdf");
    return res.json({ url, key, filename: req.file.originalname });
  } catch (err: any) {
    console.error("[upload-invoice] Error:", err);
    return res.status(500).json({ error: err.message ?? "Upload failed" });
  }
});

export default router;
