import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";

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
  it.each(["Googlebot", "Mozilla/5.0"])("serves correct uppercase public and protected documents to %s", async agent => {
    const headers = { "user-agent": agent };
    const city = await fetch(`${base}/PUPPY-YOGA-GUELPH?source=test`, { headers });
    const cityHtml = await city.text();
    expect(city.status).toBe(200);
    expect(cityHtml).toContain('rel="canonical" href="https://afropuppyyoga.ca/puppy-yoga-guelph"');
    expect(cityHtml.match(/<title>(.*?)<\/title>/i)?.[1]).toMatch(/Guelph/i);
    for (const route of ["/admin-login", "/ADMIN-LOGIN/", "/ADMIN/breeder-leads/MixedCase", "/st%61ff-access", "/sign"]) {
      const response = await fetch(base + route, { headers });
      const html = await response.text();
      expect(response.status).toBe(200);
      expect(response.headers.get("x-robots-tag")).toContain("noindex");
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(response.headers.get("surrogate-control")).toBe("no-store");
      expect(html).toContain('<meta name="robots" content="noindex, nofollow, noarchive"');
      expect(html).not.toContain('rel="canonical"');
      expect(html).not.toContain('property="og:url"');
      expect(html).toContain("<title>AfroPuppyYoga</title>");
    }
  });
  it("preserves HEAD status and private/crawler cache policy", async () => {
    for (const agent of ["Googlebot", "Mozilla/5.0"]) {
      for (const route of ["/puppy-yoga-guelph", "/PUPPY-YOGA-GUELPH", "/ADMIN-LOGIN", "/admin/breeder-leads/Mixed", "/unknown"]) {
        const headers = { "user-agent": agent };
        const get = await fetch(base + route, { headers });
        const head = await fetch(base + route, { method: "HEAD", headers });
        expect(head.status, `${agent} ${route}`).toBe(get.status);
        for (const header of ["cache-control", "surrogate-control", "x-robots-tag"]) {
          expect(head.headers.get(header), `${agent} ${route} ${header}`).toBe(get.headers.get(header));
        }
        expect(await head.text()).toBe("");
      }
    }
  });
});
