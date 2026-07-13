/**
 * Regression test: the /api/luma proxy must stay removed.
 *
 * History: the proxy originally forwarded ANY path and method to
 * https://api.lu.ma with the LUMA_API_KEY injected (unauthenticated
 * credential proxy). A later "fix" added a path allowlist that still
 * exposed /public/v1/event/get-guests — attendee names, emails, and
 * phone numbers — to unauthenticated callers.
 *
 * The endpoint has zero callers in the codebase. All server-side Luma
 * access goes through server/metaCapi.ts, server-to-server. The route
 * is tombstoned with HTTP 410 so this test fails loudly if anyone
 * reintroduces a live proxy under the same path.
 */
import { describe, expect, it } from "vitest";
import express from "express";
import http from "http";
import { AddressInfo } from "net";

// Minimal harness: mount only the tombstone the way _core/index.ts does.
function buildApp() {
  const app = express();
  app.use("/api/luma", (_req, res) => {
    res.status(410).json({ error: "Gone. This endpoint has been removed." });
  });
  return app;
}

async function request(
  server: http.Server,
  method: string,
  path: string
): Promise<{ status: number }> {
  const { port } = server.address() as AddressInfo;
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: "127.0.0.1", port, method, path },
      res => {
        res.resume();
        resolve({ status: res.statusCode ?? 0 });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

describe("/api/luma proxy removal", () => {
  it("returns 410 for every method and path under /api/luma", async () => {
    const app = buildApp();
    const server = app.listen(0);
    try {
      const probes: Array<[string, string]> = [
        ["GET", "/api/luma/public/v1/event/get-guests?event_api_id=evt-x"],
        ["GET", "/api/luma/public/v1/calendar/list-events"],
        ["POST", "/api/luma/public/v1/event/create"],
        ["DELETE", "/api/luma/anything/at/all"],
        ["GET", "/api/luma"],
      ];
      for (const [method, path] of probes) {
        const { status } = await request(server, method, path);
        expect(status, `${method} ${path} must be 410`).toBe(410);
      }
    } finally {
      server.close();
    }
  });

  it("source contains no live proxy to api.lu.ma under /api/luma", async () => {
    const fs = await import("fs/promises");
    const src = await fs.readFile(
      new URL("./_core/index.ts", import.meta.url),
      "utf-8"
    );
    // The tombstone block must exist…
    expect(src).toContain('"/api/luma"');
    expect(src).toContain("410");
    // …and no proxy middleware may be attached to that path.
    const lumaBlock = src.slice(src.indexOf('"/api/luma"'), src.indexOf('"/api/luma"') + 600);
    expect(lumaBlock).not.toContain("createProxyMiddleware");
    expect(lumaBlock).not.toContain("api.lu.ma");
  });
});
