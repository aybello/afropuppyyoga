import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { seoRenderMiddleware } from "../seoRenderer";
import uploadRouter from "../uploadRoute";
import chunkedUploadRouter from "../chunkedUploadRoute";
import rateLimit from "express-rate-limit";
import { storageGet } from "../storage";
import { lumaPoller, capiSender } from "../metaCapi";
import { requireStaffOrAdmin } from "./requireStaff";
import crypto from "crypto";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

// Chatbot rate limiter (kept — prevents AI cost abuse)
const chatbotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many messages. Please try again in 15 minutes." },
  skip: () => process.env.NODE_ENV === "development",
});

// Phase 1: Rate limiter for Luma proxy
const lumaProxyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many Luma proxy requests. Please try again later." },
  skip: () => process.env.NODE_ENV === "development",
});


async function startServer() {
  const app = express();
  const server = createServer(app);
  // Trust the platform's reverse proxy so rate limiting uses the real client IP, not the load balancer IP.
  // Without this, all users in production share one IP and hit the rate limit together.
  app.set("trust proxy", 1);
  // Redirect manus.space domains to the canonical custom domain
  app.use((req, res, next) => {
    const host = req.headers.host || "";
    if (host.includes(".manus.space") || host.includes(".manus.computer")) {
      const targetUrl = `https://afropuppyyoga.ca${req.originalUrl}`;
      return res.redirect(301, targetUrl);
    }
    next();
  });

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // Upload routes (no rate limiting — traffic volume doesn't warrant it yet)

  // Video upload endpoint (multipart, bypasses JSON body limit)
  app.use(uploadRouter);
  // Chunked video upload endpoints (for large files that exceed hosting body size limit)
  app.use(chunkedUploadRouter);

  // Chatbot rate limiter only — prevents AI cost abuse
  app.use("/api/trpc/chatbot.chat", chatbotLimiter);

  // Phase 2: Protect applicant media routes — only staff/admin can access these
  // These endpoints are only called from ApplicationsDashboard (admin/staff only)
  app.get("/api/video-url", requireStaffOrAdmin, async (req, res) => {
    const key = req.query.key as string;
    if (!key || key.includes("..") || !key.startsWith("applications/")) {
      return res.status(400).json({ error: "Invalid key" });
    }
    try {
      const { url } = await storageGet(key);
      return res.json({ url });
    } catch (e) {
      return res.status(500).json({ error: "Failed to generate video URL" });
    }
  });

  // Phase 2: Protect video proxy — only staff/admin can proxy applicant videos
  // Approved CDN hostname for applicant media (S3-backed CloudFront distribution)
  const APPROVED_CDN_HOST = "d2xsxph8kpxj0f.cloudfront.net";

  app.get("/api/video-proxy", requireStaffOrAdmin, async (req, res) => {
    const url = req.query.url as string;
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).json({ error: "Invalid URL" });
    }
    if (parsedUrl.hostname !== APPROVED_CDN_HOST) {
      return res.status(400).json({ error: "URL not from approved CDN" });
    }
    try {
      const rangeHeader = req.headers.range;

      // If no Range header: redirect browser directly to the presigned URL.
      if (!rangeHeader) {
        return res.redirect(302, url);
      }

      // Range request: proxy with correct Content-Type so browser can seek correctly.
      const response = await fetch(url, { headers: { Range: rangeHeader } });
      if (!response.ok) return res.status(response.status).send("Failed to fetch video");
      if (!response.body) return res.status(500).send("No response body");

      const urlLower = url.toLowerCase().split("?")[0];
      const isWebm = urlLower.endsWith(".webm");
      const contentType = isWebm ? "video/webm" : "video/mp4";

      const contentRange = response.headers.get("content-range");
      const contentLength = response.headers.get("content-length");

      res.status(206);
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", "inline");
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "no-store");
      if (contentRange) res.setHeader("Content-Range", contentRange);
      if (contentLength) res.setHeader("Content-Length", contentLength);

      const { Readable } = await import("stream");
      const nodeStream = Readable.fromWeb(response.body as any);
      nodeStream.pipe(res);
      nodeStream.on("error", () => res.end());
    } catch (e) {
      res.status(500).json({ error: "Proxy error" });
    }
  });

  // Phase 2: Protect PDF proxy — only staff/admin can access applicant PDFs
  app.get("/api/pdf-proxy", requireStaffOrAdmin, async (req, res) => {
    const url = req.query.url as string;
    if (!url || !url.startsWith("https://d2xsxph8kpxj0f.cloudfront.net/")) {
      return res.status(400).send("Invalid URL");
    }
    try {
      const response = await fetch(url);
      if (!response.ok) return res.status(response.status).send("Failed to fetch PDF");
      const buffer = await response.arrayBuffer();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.send(Buffer.from(buffer));
    } catch (e) {
      res.status(500).send("Proxy error");
    }
  });

  // /api/luma proxy REMOVED (2026-07-13).
  // Even with a path allowlist, /public/v1/event/get-guests returns attendee
  // names, emails, and phone numbers to unauthenticated callers. The endpoint
  // has zero callers in the codebase — all server-side Luma access goes through
  // server/metaCapi.ts, server-to-server, with the key never reachable from
  // the public internet. Tombstone returns 410 so any unknown external caller
  // fails loudly instead of falling through to the SPA.
  // DO NOT re-add this proxy. See server/lumaProxyRemoved.test.ts.
  app.use("/api/luma", (_req, res) => {
    res.status(410).json({ error: "Gone. This endpoint has been removed." });
  });

  // Keep-alive ping endpoint — called by scheduled heartbeat every 5 min to prevent cold starts
  app.get("/api/ping", (_req, res) => {
    res.json({ ok: true, ts: Date.now() });
  });
  app.post("/api/scheduled/ping", (_req, res) => {
    res.json({ ok: true, ts: Date.now() });
  });

  // ─── Meta CAPI Scheduled Jobs ─────────────────────────────────────────────
  // The Manus platform gateway restricts /api/scheduled/* to cron callers only
  // (it injects x-manus-cron-task-uid on every trigger). We validate that header
  // is present as a defence-in-depth check. If SCHEDULED_JOB_SECRET is also set,
  // we do a timing-safe comparison against x-scheduled-secret for extra hardening.
  const requireCronAuth = (req: express.Request, res: express.Response): boolean => {
    // Platform injects this header on every cron trigger — absent means not a cron call
    const taskUid = req.get("x-manus-cron-task-uid");
    if (!taskUid) {
      // Also accept calls with a valid SCHEDULED_JOB_SECRET (for local dev / manual triggers)
      const secret = process.env.SCHEDULED_JOB_SECRET;
      if (secret) {
        const provided = req.get("x-scheduled-secret") ?? "";
        const a = Buffer.from(provided);
        const b = Buffer.from(secret);
        if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
      }
      res.status(401).json({ ok: false, error: "Unauthorized" });
      return false;
    }
    return true;
  };

  // POST /api/scheduled/luma-poll — called by heartbeat every 10 min
  // Polls recent/upcoming Luma events and inserts new paid registrations as pending rows.
  app.post("/api/scheduled/luma-poll", async (req, res) => {
    if (!requireCronAuth(req, res)) return;
    try {
      const result = await lumaPoller();
      res.json({ ok: true, ...result });
    } catch (err) {
      console.error("[MetaCAPI] Luma poller error:", err);
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  // POST /api/scheduled/meta-capi-send — called by heartbeat every 10 min (offset 5 min)
  // Picks up pending rows and sends them to Meta CAPI.
  app.post("/api/scheduled/meta-capi-send", async (req, res) => {
    if (!requireCronAuth(req, res)) return;
    try {
      const result = await capiSender();
      res.json({ ok: true, ...result });
    } catch (err) {
      console.error("[MetaCAPI] CAPI sender error:", err);
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
