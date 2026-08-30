import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";
import { seoRenderMiddleware } from "../seoRenderer";
import {
  getDocumentCacheControl,
  getDocumentSurrogateCacheControl,
} from "../publicDocumentCache";

export async function setupVite(app: Express, server: Server) {
  const resolvedViteConfig = typeof viteConfig === "function"
    ? await viteConfig({ command: "serve", mode: "development", isSsrBuild: false, isPreview: false })
    : viteConfig;
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...resolvedViteConfig,
    configFile: false,
    server: { ...resolvedViteConfig.server, ...serverOptions },
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      const template = await fs.promises.readFile(clientTemplate, "utf-8");
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  // Serve static assets with long-lived cache headers
  // /assets/* files have content-hash in filename — safe to cache for 1 year
  app.use(
    "/assets",
    express.static(path.join(distPath, "assets"), {
      maxAge: "1y",
      immutable: true,
      setHeaders: (res) => {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      },
    })
  );

  // Serve other static files (robots.txt, sitemap, favicon) with short cache
  app.use(
    express.static(distPath, {
      maxAge: "1h",
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", getDocumentCacheControl("/"));
          res.setHeader("Surrogate-Control", getDocumentSurrogateCacheControl("/"));
        }
      },
    })
  );

  // fall through to index.html — but serve SEO HTML to crawlers first
  app.use("*", (req, res, next) => {
    // Let the SEO renderer intercept crawler requests
    seoRenderMiddleware(req, res, () => {
      res.setHeader("Cache-Control", getDocumentCacheControl(req.path));
      res.setHeader(
        "Surrogate-Control",
        getDocumentSurrogateCacheControl(req.path)
      );
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  });
}
