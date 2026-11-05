import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { renderClientSeoHead } from "./clientSeoRenderer";
import { getPublicSeoSnapshot, seoRenderMiddleware } from "./seoRenderer";

const template = readFileSync(new URL("../client/index.html", import.meta.url), "utf8");
const routes = ["/", "/puppy-yoga-kitchener", "/puppy-yoga-hamilton", "/puppy-yoga-oakville", "/puppy-yoga-guelph", "/corporate-puppy-yoga", "/private-puppy-yoga-events", "/private-events/quote", "/careers", "/ethics", "/loyalty", "/partnerships"];
const links = ["/puppy-yoga-kitchener", "/puppy-yoga-hamilton", "/puppy-yoga-oakville", "/puppy-yoga-guelph", "/corporate-puppy-yoga", "/private-puppy-yoga-events", "/private-events/quote"];

function crawl(path: string) {
  let output = "";
  let status = 200;
  const headers: Record<string, string> = {};
  const res = {
    status(code: number) { status = code; return this; },
    set(values: Record<string, string>) { Object.assign(headers, values); return this; },
    end(value: string) { output = value; return this; },
  };
  const next = vi.fn();
  seoRenderMiddleware({ method: "GET", path, query: {}, headers: { "user-agent": "Googlebot" } } as unknown as Request, res as unknown as Response, next);
  return { output, status, headers, next };
}

describe("public initial-document SEO", () => {
  it.each(routes)("keeps the actual SPA and a single route canonical for %s", path => {
    const result = renderClientSeoHead(template, path);
    const snapshot = getPublicSeoSnapshot(path)!;
    expect(result.slice(result.indexOf("<body>"))).toBe(template.slice(template.indexOf("<body>")));
    expect(result.match(/<title\b/gi)).toHaveLength(1);
    expect(result.match(/<title>[^<]*<\/title>/i)?.[0]).toBe(snapshot.match(/<title>[^<]*<\/title>/i)?.[0]);
    expect(result.match(/<meta name="description"[^>]*>/i)?.[0]).toBe(snapshot.match(/<meta name="description"[^>]*>/i)?.[0]);
    expect(result.match(/rel="canonical"/g)).toHaveLength(1);
    expect(result).toContain(`rel="canonical" href="https://afropuppyyoga.ca${path}"`);
    expect(result).toContain(`<meta property="og:url" content="https://afropuppyyoga.ca${path}"`);
    expect(result).toContain('id="initial-route-breadcrumb"');
    expect(result).not.toContain('"@type": "VideoObject"');
    expect(result).not.toContain('"@type": "Review"');
  });
  it("does not claim homepage as canonical for operational or unknown routes", () => {
    for (const path of ["/staff-access", "/sign", "/admin/breeder-leads/123", "/submit-invoice", "/not-a-route"]) {
      const page = renderClientSeoHead(template, path);
      expect(page).not.toContain('rel="canonical"');
      expect(page.slice(page.indexOf("<body>"))).toBe(template.slice(template.indexOf("<body>")));
    }
  });
  it.each(["/PUPPY-YOGA-GUELPH", "/Puppy-Yoga-Guelph/", "/puppy-yoga-guel%70h"])("matches accepted public route %s to its lowercase snapshot", path => {
    const result = renderClientSeoHead(template, path);
    const snapshot = getPublicSeoSnapshot("/puppy-yoga-guelph")!;
    expect(result.match(/<title>[^<]*<\/title>/i)?.[0]).toBe(snapshot.match(/<title>[^<]*<\/title>/i)?.[0]);
    expect(result).toContain('rel="canonical" href="https://afropuppyyoga.ca/puppy-yoga-guelph"');
    expect(result).toContain('<meta property="og:url" content="https://afropuppyyoga.ca/puppy-yoga-guelph"');
  });
  it("does not use a known page snapshot for unknown or malformed paths", () => {
    for (const path of ["/PUPPY-YOGA-GUELPH//", "/PUPPY-YOGA-GUELPH/extra", "/constructor", "/careers%ZZ"]) {
      expect(renderClientSeoHead(template, path)).not.toContain('rel="canonical"');
    }
  });
  it("aligns private shell robots and removes misleading homepage metadata", () => {
    const result = renderClientSeoHead(template, "/ADMIN-LOGIN", { noindex: true });
    expect(result).toContain('<meta name="robots" content="noindex, nofollow, noarchive"');
    expect(result).not.toContain('content="index, follow"');
    expect(result).not.toContain('rel="canonical"');
    expect(result).not.toContain('property="og:url"');
    expect(result).toContain("<title>AfroPuppyYoga</title>");
    expect(result.slice(result.indexOf("<body>"))).toBe(template.slice(template.indexOf("<body>")));
  });
  it.each(routes)("keeps important links in the crawler snapshot for %s", path => {
    const { output, headers } = crawl(path);
    for (const link of links) expect(output).toContain(`href="${link}"`);
    expect(output).not.toContain('href="/birthday"');
    expect(headers["Cache-Control"]).toContain("no-store");
    expect(headers.Vary).toBe("User-Agent");
  });
  it("leaves unregistered and sensitive paths to the existing SPA/server", () => {
    for (const path of ["/sign", "/staff-access", "/submit-invoice", "/admin/breeder-leads/123", "/api/oauth/callback", "/missing", "/assets/app.js", "/constructor"]) {
      expect(crawl(path).next).toHaveBeenCalledOnce();
    }
  });
  it.each(["/puppy-yoga-kitchener", "/puppy-yoga-hamilton", "/puppy-yoga-oakville"])("does not invent opening hours, coordinates, prices or cuisine in %s snapshot", path => {
    const snapshot = getPublicSeoSnapshot(path)!;
    const schema = [...snapshot.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
    expect(JSON.stringify(schema)).not.toMatch(/openingHoursSpecification|priceRange|servesCuisine|GeoCoordinates/);
  });
  it("describes Guelph as an event venue rather than an APY studio", () => {
    const snapshot = getPublicSeoSnapshot("/puppy-yoga-guelph")!;
    expect(snapshot).toContain("Emotion Dance Company, 375 Southgate Drive, Unit 2");
    expect(snapshot).toContain("current Guelph event listings");
    expect(snapshot).not.toContain('"@type":"LocalBusiness"');
  });
});
