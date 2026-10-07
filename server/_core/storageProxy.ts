import type { Express } from "express";
import { ENV } from "./env";
import { sdk } from "./sdk";
import { resolveApyAccess } from "../apyAccess";

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    // Public submission never grants public access to saved invoice documents.
    const normalizedKey = key.replace(/^\/+/, "");
    if (normalizedKey.startsWith("invoices/")) {
      res.set("Cache-Control", "private, no-store");
      try {
        const user = await sdk.authenticateRequest(req);
        const access = await resolveApyAccess(user);
        if (access.level !== "owner") return void res.status(403).send("Owner access required");
      } catch {
        return void res.status(401).send("Authentication required");
      }
    }

    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }

    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/",
      );
      forgeUrl.searchParams.set("path", key);

      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
      });

      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }

      const { url } = (await forgeResp.json()) as { url: string };
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }

      // Fetch the actual image bytes and stream them to the client
      // This avoids the browser having to follow expiring signed URL redirects
      const imageResp = await fetch(url);
      if (!imageResp.ok) {
        console.error(`[StorageProxy] image fetch error: ${imageResp.status}`);
        res.status(502).send("Failed to fetch image from storage");
        return;
      }

      const contentType = imageResp.headers.get("content-type") || "application/octet-stream";
      const contentLength = imageResp.headers.get("content-length");
      res.set("Content-Type", contentType);
      res.set("Cache-Control", normalizedKey.startsWith("invoices/") ? "private, no-store" : "public, max-age=86400");
      if (contentLength) res.set("Content-Length", contentLength);

      if (imageResp.body) {
        const { Readable } = await import("stream");
        const nodeStream = Readable.fromWeb(imageResp.body as any);
        nodeStream.pipe(res);
      } else {
        const buffer = Buffer.from(await imageResp.arrayBuffer());
        res.send(buffer);
      }
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}
