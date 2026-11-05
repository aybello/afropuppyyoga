import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";

// Isolate Vite's own asset server; the real setupVite Express fallback is under test.
vi.mock("vite", async importOriginal => {
  const vite = await importOriginal<typeof import("vite")>();
  return {
    ...vite,
    createServer: vi.fn(async () => ({
      middlewares: (_req: unknown, _res: unknown, next: () => void) => next(),
      transformIndexHtml: async (_url: string, html: string) => html,
      ssrFixStacktrace: () => {},
    })),
  };
});
import { setupVite } from "./_core/vite";
import { seoRenderMiddleware } from "./seoRenderer";

let server: Server;
let base: string;
beforeAll(async () => {
  const app = express();
  app.use(seoRenderMiddleware);
  server = createServer(app);
  await setupVite(app, server);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  base = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

describe("development SPA document fallback over HTTP", () => {
  it.each(["Googlebot", "Mozilla/5.0"])("404s unknown routes for %s", async agent => {
    const response = await fetch(`${base}/unknown?hello=1`, { headers: { "user-agent": agent } });
    expect(response.status).toBe(404);
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("serves parameterized operational and public paths", async () => {
    for (const route of ["/admin/breeder-leads/123?tab=test", "/staff", "/privacy", "/careers"]) {
      expect((await fetch(base + route)).status).toBe(200);
    }
  });
});
