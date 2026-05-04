import { Router } from "express";
import multer from "multer";
import { storagePut } from "./storage";

const router = Router();

// Use memory storage — we stream to S3 immediately
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 150 * 1024 * 1024 }, // 150MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ["video/mp4", "video/quicktime", "video/webm", "video/x-msvideo"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only video files are allowed (mp4, mov, webm, avi)"));
    }
  },
});

/**
 * POST /api/upload-video
 * Accepts multipart/form-data with a single "video" field.
 * Uploads to S3 and returns { url, key }.
 * No auth required — the key is random and unguessable.
 */
router.post("/api/upload-video", upload.single("video"), async (req, res) => {
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

export default router;
