import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";
import { isRegisteredSpaPath, renderClientSeoHead } from "../clientSeoRenderer";
import {
  getDocumentCacheControl,
  getDocumentSurrogateCacheControl,
} from "../publicDocumentCache";

// Wouter matches case-insensitively and decodes URI path characters. Mirror the
// earlier security middleware for variant spellings that it may not recognize.
function protectInternalDocument(req: express.Request, res: express.Response): void {
  let pathname = req.originalUrl.split("?", 1)[0];
  try { pathname = decodeURI(pathname); } catch { /* Match Wouter's fallback. */ }
  pathname = pathname.toLowerCase().replace(/\/+$/, "") || "/";
  if (pathname === "/admin" || pathname.startsWith("/admin/") ||
      pathname === "/staff" || pathname.startsWith("/staff/") ||
      ["/staff-login", "/staff-access", "/submit-invoice", "/sign", "/predictor",
        "/breeder-calculator", "/breeder-availability", "/404"].includes(pathname)) {
    res.set({
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "Cache-Control": "private, no-store",
      "Surrogate-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    });
  }
}

// Server routes, redirects and static assets get first refusal before this check.
function rejectUnknownDocument(req: express.Request, res: express.Response): boolean {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  const pathname = req.originalUrl.split("?", 1)[0];
  if (isRegisteredSpaPath(pathname)) return false;
  res.vary("User-Agent");
  res.set({
    "X-Robots-Tag": "noindex, nofollow, noarchive",
    "Cache-Control": "private, no-store",
    "Surrogate-Control": "no-store",
  });
  res.status(404).type("html").send(
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>404 Not Found | AfroPuppyYoga</title><meta name="robots" content="noindex, nofollow"></head><body><h1>404 — Page Not Found</h1><p><a href="/">Return to AfroPuppyYoga</a></p></body></html>'
  );
  return true;
}

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
    if (rejectUnknownDocument(req, res)) return;
    protectInternalDocument(req, res);
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
      res.vary("User-Agent");
      res.status(200).set({ "Content-Type": "text/html" }).end(renderClientSeoHead(page, req.originalUrl.split("?", 1)[0]));
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express, staticDirectory?: string) {
  const distPath = staticDirectory ?? (
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public"));
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
      index: false,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", getDocumentCacheControl("/"));
          res.setHeader("Surrogate-Control", getDocumentSurrogateCacheControl("/"));
        }
      },
    })
  );

  // SEO crawler handling is mounted before static serving in index.ts. Express
  // strips the wildcard mount from req.path; retain the original pathname.
  app.use("*", async (req, res, next) => {
    if (rejectUnknownDocument(req, res)) return;
    protectInternalDocument(req, res);
    try {
      const pathname = req.originalUrl.split("?", 1)[0];
      const template = await fs.promises.readFile(path.resolve(distPath, "index.html"), "utf-8");
      const page = renderClientSeoHead(template, pathname);
      res.vary("User-Agent");
      // The earlier security middleware can already have imposed a stricter
      // private/no-store policy (notably for invoice intake and signing).
      if (!res.hasHeader("Cache-Control")) {
        res.setHeader("Cache-Control", getDocumentCacheControl(pathname));
      }
      res.setHeader(
        "Surrogate-Control",
        String(res.getHeader("Cache-Control")).includes("no-store")
          ? "no-store"
          : getDocumentSurrogateCacheControl(pathname)
      );
      res.type("html").send(page);
    } catch (error) {
      next(error);
    }
  });
}
