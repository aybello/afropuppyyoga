import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import uploadRouter from "../uploadRoute";
import chunkedUploadRouter from "../chunkedUploadRoute";
import { createProxyMiddleware } from "http-proxy-middleware";

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

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Video upload endpoint (multipart, bypasses JSON body limit)
  app.use(uploadRouter);
  // Chunked video upload endpoints (for large files that exceed hosting body size limit)
  app.use(chunkedUploadRouter);
  // Video proxy — re-serves CDN videos with inline Content-Disposition so browsers play instead of download
  // Needed for MOV files which CloudFront serves as video/quicktime (triggers download in most browsers)
  app.get("/api/video-proxy", async (req, res) => {
    const url = req.query.url as string;
    if (!url || !url.startsWith("https://d2xsxph8kpxj0f.cloudfront.net/")) {
      return res.status(400).json({ error: "Invalid URL" });
    }
    try {
      // Support range requests for video seeking
      const rangeHeader = req.headers.range;
      const fetchHeaders: Record<string, string> = {};
      if (rangeHeader) fetchHeaders["Range"] = rangeHeader;

      const response = await fetch(url, { headers: fetchHeaders });
      if (!response.ok) return res.status(response.status).send("Failed to fetch video");

      // Detect file extension to pick the right MIME type
      const urlPath = new URL(url).pathname.toLowerCase();
      const isMov = urlPath.endsWith(".mov");
      const isWebm = urlPath.endsWith(".webm");
      const contentType = isWebm ? "video/webm" : isMov ? "video/mp4" : "video/mp4";

      // Forward range response status (206 Partial Content) if applicable
      const status = response.status === 206 ? 206 : 200;
      const contentRange = response.headers.get("content-range");
      const contentLength = response.headers.get("content-length");

      res.status(status);
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", "inline");
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "public, max-age=3600");
      if (contentRange) res.setHeader("Content-Range", contentRange);
      if (contentLength) res.setHeader("Content-Length", contentLength);

      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
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
