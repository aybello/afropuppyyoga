import type { Express, RequestHandler } from "express";
import { requireStaffOrAdmin } from "./requireStaff";

// Set before any middleware that can respond, including authentication and parsers.
export const pdfProxyCacheHeaders: RequestHandler = (_req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Surrogate-Control", "no-store");
  res.setHeader("CDN-Cache-Control", "no-store");
  next();
};

export function registerPdfProxy(app: Express) {
  app.get("/api/pdf-proxy", requireStaffOrAdmin, async (req, res) => {
    const url = req.query.url;
    if (typeof url !== "string" || !url.startsWith("https://d2xsxph8kpxj0f.cloudfront.net/")) {
      return res.status(400).send("Invalid URL");
    }
    try {
      const response = await fetch(url);
      if (!response.ok) return res.status(response.status).send("Failed to fetch PDF");
      const buffer = await response.arrayBuffer();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.send(Buffer.from(buffer));
    } catch (e) {
      res.status(500).send("Proxy error");
    }
  });
}
