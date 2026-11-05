import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { serveStatic } from "./_core/vite";
import { isRegisteredSpaPath, SPA_ROUTE_PATTERNS } from "./clientSeoRenderer";
import { seoRenderMiddleware } from "./seoRenderer";

let server: Server;
let origin: string;
let dir: string;
const template = readFileSync(new URL("../client/index.html", import.meta.url), "utf8");

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "apy-spa-test-"));
  mkdirSync(path.join(dir, "assets"));
  writeFileSync(path.join(dir, "index.html"), template);
  writeFileSync(path.join(dir, "assets", "app.js"), "asset-ok");
  const app = express();
  // Model upstream index.ts behavior and verify the actual SEO and static
  // middleware in their real order without starting the database-backed server.
  app.use((req, res, next) => {
    res.vary("Accept-Encoding");
    if (/^\/(?:admin(?:\/|$)|staff(?:\/|$)|staff-access$|sign$|submit-invoice$)/.test(req.path)) {
      res.set("X-Robots-Tag", "noindex, nofollow, noarchive");
      res.set("Cache-Control", "private, no-store");
    }
    next();
  });
  app.get("/about", (_req, res) => res.redirect(301, "/"));
  app.get("/api/oauth/callback", (_req, res) => res.status(202).send("oauth-handler"));
  app.post("/api/example", (_req, res) => res.status(202).send("api-handler"));
  app.get(["/privacy", "/terms", "/refund-policy", "/quickbooks-disconnect"], (req, res) => res.send(`legal:${req.path}`));
  app.use(seoRenderMiddleware);
  serveStatic(app, dir);
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  origin = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  if (dir) rmSync(dir, { recursive: true, force: true });
});

const get = (url: string, init: RequestInit = {}) => fetch(origin + url, { redirect: "manual", ...init });

describe("SPA document routing over HTTP", () => {
  it("tracks every explicit App.tsx route, but not its catch-all", () => {
    const app = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");
    const found = [...app.matchAll(/<Route\s+path=\{?["']([^"']+)["']\}?/g)].map(match => match[1]);
    expect(found.length).toBeGreaterThan(40);
    expect([...SPA_ROUTE_PATTERNS].sort()).toEqual(found.sort());
  });
  it.each([...SPA_ROUTE_PATTERNS])("serves registered route %s", async pattern => {
    const url = pattern.replace(":id", "example-42");
    const response = await get(`${url}?test=1`);
    expect(response.status).toBe(200);
  });
  it.each(["Googlebot", "Mozilla/5.0"])("returns an uncached noindex 404 for unknown HTML to %s", async agent => {
    const response = await get("/totally-missing?from=search", { headers: { "user-agent": agent, accept: "text/html" } });
    const body = await response.text();
    expect(response.status).toBe(404);
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("surrogate-control")).toBe("no-store");
    expect(response.headers.get("vary")).toMatch(/User-Agent/i);
    expect(body).toContain("404 Not Found");
    expect(body).not.toContain('rel="canonical"');
  });
  it("protects registered staff and parameterized routes even for Googlebot", async () => {
    for (const url of ["/staff", "/staff-access?token=example", "/admin/breeder-leads/123?source=test", "/STAFF/training", "/st%61ff-access"]) {
      const response = await get(url, { headers: { "user-agent": "Googlebot" } });
      expect(response.status).toBe(200);
      expect(response.headers.get("x-robots-tag")).toContain("noindex");
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(response.headers.get("surrogate-control")).toBe("no-store");
      expect(await response.text()).toContain('id="root"');
    }
  });
  it("does not accept malformed parameterized or prototype paths", async () => {
    for (const url of ["/admin/breeder-leads/123/extra", "/constructor", "/missing//", "/careers//"]) {
      for (const agent of ["Googlebot", "Mozilla/5.0"]) {
        expect((await get(url, { headers: { "user-agent": agent } })).status).toBe(404);
      }
    }
  });
  it("matches Wouter's case, decodeURI and single-trailing-slash rules", () => {
    expect(isRegisteredSpaPath("/STAFF/TRAINING/")).toBe(true);
    expect(isRegisteredSpaPath("/staff/train%69ng")).toBe(true);
    expect(isRegisteredSpaPath("/staff/training//")).toBe(false);
    expect(isRegisteredSpaPath("/admin/breeder-leads/%2F")).toBe(true);
    expect(isRegisteredSpaPath("/admin/breeder-leads")).toBe(true);
  });
  it("preserves legal and upstream OAuth/API/redirect handling", async () => {
    for (const url of ["/privacy", "/terms?src=1", "/refund-policy", "/quickbooks-disconnect"]) {
      const response = await get(url, { headers: { "user-agent": "Googlebot" } });
      expect(response.status).toBe(200);
      expect(await response.text()).toContain("legal:");
    }
    const oauth = await get("/api/oauth/callback?code=example");
    expect(oauth.status).toBe(202);
    expect(await oauth.text()).toBe("oauth-handler");
    expect((await get("/api/example", { method: "POST" })).status).toBe(202);
    const redirect = await get("/about?src=test");
    expect(redirect.status).toBe(301);
    expect(redirect.headers.get("location")).toBe("/");
  });
  it("serves assets before the document fallback", async () => {
    const asset = await get("/assets/app.js");
    expect(asset.status).toBe(200);
    expect(await asset.text()).toBe("asset-ok");
    expect(asset.headers.get("cache-control")).toContain("immutable");
    expect((await get("/assets/missing.js")).status).toBe(404);
  });
  it("preserves non-GET fallback behavior and returns 404 for HEAD unknown", async () => {
    expect((await get("/unknown", { method: "POST" })).status).toBe(200);
    const head = await get("/unknown", { method: "HEAD" });
    expect(head.status).toBe(404);
    expect(await head.text()).toBe("");
  });
  it("varies both crawler and browser documents without clobbering upstream Vary", async () => {
    const bot = await get("/careers", { headers: { "user-agent": "Googlebot" } });
    const browser = await get("/careers", { headers: { "user-agent": "Mozilla/5.0" } });
    for (const response of [bot, browser]) {
      expect(response.status).toBe(200);
      expect(response.headers.get("vary")).toMatch(/Accept-Encoding/i);
      expect(response.headers.get("vary")).toMatch(/User-Agent/i);
    }
    expect(bot.headers.get("cache-control")).toContain("no-store");
    expect(bot.headers.get("surrogate-control")).toBe("no-store");
    expect(browser.headers.get("cache-control")).toContain("s-maxage=300");
    expect(await bot.text()).not.toContain('id="root"');
    expect(await browser.text()).toContain('id="root"');
  });
});
