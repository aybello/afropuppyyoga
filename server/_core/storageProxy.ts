import type { Express, RequestHandler } from "express";
import { ENV } from "./env";
import { sdk } from "./sdk";
import { resolveApyAccess } from "../apyAccess";

// Mount before redirects and parsers as well as wildcard decoding and auth.
export const storageProxyCacheHeaders: RequestHandler = (_req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Surrogate-Control", "no-store");
  res.setHeader("CDN-Cache-Control", "no-store");
  next();
};

export function registerStorageProxy(app: Express) {
  // Defense in depth for apps registering the proxy independently; production
  // also mounts this before redirects and parsers in index.ts.
  app.use("/manus-storage", storageProxyCacheHeaders);

  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    if (key.includes("\\") || key.includes("%") || /[\x00-\x1f\x7f]/.test(key) || key.split("/").some(part => part === "." || part === "..")) {
      res.status(400).send("Invalid storage key");
      return;
    }
    // Classify decoded segments conservatively, including repeated separators,
    // root keys and case variants; retain the original key for storage lookup.
    const segments = key.split("/").filter(Boolean).map(part => part.toLowerCase());
    const isChunk = segments[0] === "uploads" && segments[1] === "chunks";
    const isOwnerOnlyFile = segments[0] === "invoices" || segments[0] === "meta-campaigns";
    const isApplicationFile = segments[0] === "applications";
    if (isChunk) {
      // Server-side chunk assembly uses storageGet directly, not this proxy.
      return void res.status(404).send("Not found");
    }
    if (isOwnerOnlyFile || isApplicationFile) {
      try {
        const user = await sdk.authenticateRequest(req);
        if (!user) return void res.status(401).send("Authentication required");
        const access = await resolveApyAccess(user);
        if (isOwnerOnlyFile && access.level !== "owner") return void res.status(403).send("Owner access required");
        if (isApplicationFile && !access.canManageOperations) return void res.status(403).send("Operations Manager or owner access required");
      } catch {
        return void res.status(401).send("Authentication required");
      }
    }

    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }

    const controller = new AbortController();
    let nodeStream: import("node:stream").Readable | undefined;
    const stopUpstream = () => {
      controller.abort();
      nodeStream?.destroy();
    };
    const onClose = () => {
      res.off("finish", onFinish);
      if (!res.writableFinished) stopUpstream();
    };
    const onFinish = () => res.off("close", onClose);
    res.once("close", onClose);
    res.once("finish", onFinish);
    res.once("error", () => {
      stopUpstream();
      res.destroy();
    });

    const fail = (err: unknown) => {
      if (res.destroyed || res.writableEnded) return;
      console.error("[StorageProxy] failed:", err);
      if (res.headersSent) {
        res.destroy();
        return;
      }
      res.set("Cache-Control", "private, no-store");
      res.set("Surrogate-Control", "no-store");
      res.set("CDN-Cache-Control", "no-store");
      res.removeHeader("Content-Length");
      res.removeHeader("Content-Type");
      res.status(502).send("Storage proxy error");
    };

    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/",
      );
      forgeUrl.searchParams.set("path", key);

      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
        signal: controller.signal,
      });
      if (res.destroyed) {
        await forgeResp.body?.cancel().catch(() => {});
        return;
      }

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
      const imageResp = await fetch(url, { signal: controller.signal });
      if (res.destroyed) {
        await imageResp.body?.cancel().catch(() => {});
        return;
      }
      if (!imageResp.ok) {
        console.error(`[StorageProxy] image fetch error: ${imageResp.status}`);
        res.status(502).send("Failed to fetch image from storage");
        return;
      }

      const contentType = imageResp.headers.get("content-type") || "application/octet-stream";
      const contentLength = imageResp.headers.get("content-length");
      res.set("Content-Type", contentType);
      if (contentLength) res.set("Content-Length", contentLength);

      const setPublicCache = () => {
        if (isOwnerOnlyFile || isApplicationFile) return;
        res.set("Cache-Control", "public, max-age=86400");
        res.removeHeader("Surrogate-Control");
        res.removeHeader("CDN-Cache-Control");
      };
      if (imageResp.body) {
        const { Readable } = await import("stream");
        if (res.destroyed) {
          await imageResp.body.cancel().catch(() => {});
          return;
        }
        nodeStream = Readable.fromWeb(imageResp.body as any);
        const source = nodeStream;
        let sourceFailed = false;
        const onSourceFailure = (err: unknown) => {
          if (sourceFailed || res.destroyed) return;
          sourceFailed = true;
          source.unpipe(res);
          fail(err);
          controller.abort();
          source.destroy();
        };
        source.on("error", onSourceFailure);
        source.on("close", () => {
          if (!source.readableEnded) onSourceFailure(new Error("Storage stream closed prematurely"));
        });
        setPublicCache();
        source.pipe(res);
      } else {
        const buffer = Buffer.from(await imageResp.arrayBuffer());
        setPublicCache();
        res.send(buffer);
      }
    } catch (err) {
      fail(err);
    }
  });
}
