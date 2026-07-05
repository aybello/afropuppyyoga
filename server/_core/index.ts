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
import { createProxyMiddleware } from "http-proxy-middleware";
import rateLimit from "express-rate-limit";
import { storageGet } from "../storage";

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

// Rate limiters
const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many submissions. Please try again in 15 minutes." },
  skip: () => process.env.NODE_ENV === "development",
});

const chatbotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many messages. Please try again in 15 minutes." },
  skip: () => process.env.NODE_ENV === "development",
});


async function startServer() {
  const app = express();
  const server = createServer(app);
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

  // Video upload endpoint (multipart, bypasses JSON body limit)
  app.use(uploadRouter);
  // Chunked video upload endpoints (for large files that exceed hosting body size limit)
  app.use(chunkedUploadRouter);

  // Apply form rate limiter to tRPC public mutations
  // We target specific procedure paths to avoid limiting admin/auth calls
  app.use("/api/trpc/careers.submitApplication", formLimiter);
  app.use("/api/trpc/privateEvents.submitInquiry", formLimiter);
  app.use("/api/trpc/birthday.submit", formLimiter);
  app.use("/api/trpc/partnership.submit", formLimiter);
  app.use("/api/trpc/invoices.submit", formLimiter);
  app.use("/api/trpc/chatbot.chat", chatbotLimiter);

  // Video proxy — for Range requests (browser seeking), proxy the bytes with correct Content-Type.
  // For full-file requests (new tab), redirect directly to CloudFront which has CORS + accept-ranges.
  // This avoids the platform response-body-size limit that kills full 40MB streams.
  // GET /api/video-url?key=<storageKey>
  // Generates a fresh presigned URL for a video stored in Manus storage.
  // Used by the admin dashboard to play applicant videos that may have expired URLs.
  app.get("/api/video-url", async (req, res) => {
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

  // GET /api/video-proxy?url=<presignedUrl>
  // Proxies range requests for video seeking with correct Content-Type headers.
  // For full-file requests, redirects directly to the presigned URL.
  app.get("/api/video-proxy", async (req, res) => {
    const url = req.query.url as string;
    if (!url || !url.startsWith("https://")) {
      return res.status(400).json({ error: "Invalid URL" });
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

  // PDF proxy — serves CDN PDFs with CORS headers so PDF.js can render them
  app.get("/api/pdf-proxy", async (req, res) => {
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

  // Luma API proxy — forwards /api/luma/* to https://api.lu.ma with API key injected
  const LUMA_API_KEY = process.env.LUMA_API_KEY || "";
  app.use(
    "/api/luma",
    createProxyMiddleware({
      target: "https://api.lu.ma",
      changeOrigin: true,
      pathRewrite: { "^/api/luma": "" },
      on: {
        proxyReq: (proxyReq) => {
          proxyReq.setHeader("x-luma-api-key", LUMA_API_KEY);
          // Remove any forwarded host headers that could confuse Luma
          proxyReq.removeHeader("x-forwarded-host");
        },
      },
    })
  );

  // Keep-alive ping endpoint — called by scheduled heartbeat every 5 min to prevent cold starts
  app.get("/api/ping", (_req, res) => {
    res.json({ ok: true, ts: Date.now() });
  });
  app.post("/api/scheduled/ping", (_req, res) => {
    res.json({ ok: true, ts: Date.now() });
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
