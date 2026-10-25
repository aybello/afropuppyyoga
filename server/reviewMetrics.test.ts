import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { REVIEW_METRICS, REVIEW_FEEDBACK_COUNT, REVIEW_COUNT_NOTE, COUNTED_GOOGLE_REVIEWS } from "../shared/reviewMetrics";
vi.mock("../client/src/hooks/useCountUp", () => ({ useCountUp: (value: number) => ({ count: value, ref: { current: null } }) }));
import Reviews from "../client/src/components/sections/Reviews";
import Experience from "../client/src/components/sections/Experience";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
describe("verified review count baseline", () => {
  it("keeps all Google histogram buckets and the complete Google denominator", () => {
    expect(Object.values(REVIEW_METRICS.google.stars).reduce((a, b) => a + b, 0)).toBe(208);
    expect(REVIEW_METRICS.google.total).toBe(208);
    expect(REVIEW_METRICS.google.rating).toBe(4.7);
    expect(REVIEW_METRICS.google.stars[1]).toBe(11);
  });
  it("computes only the requested filtered comparison and never relabels it as five-star", () => {
    expect(COUNTED_GOOGLE_REVIEWS).toBe(197);
    expect(REVIEW_METRICS.luma.total).toBe(414);
    expect(Object.values(REVIEW_METRICS.luma.stars).reduce((a, b) => a + b, 0)).toBe(414);
    expect(REVIEW_FEEDBACK_COUNT).toBe(611);
    expect(REVIEW_FEEDBACK_COUNT).not.toBe(REVIEW_METRICS.google.stars[5] + REVIEW_METRICS.luma.stars[5]);
    expect(REVIEW_COUNT_NOTE).toContain("Google 1-star reviews are excluded");
    expect(REVIEW_COUNT_NOTE).toContain("July 2025 to October 2026");
    expect(REVIEW_COUNT_NOTE).toContain("repeat guests");
  });
  it("renders an exact neutral Experience count with the scope disclosure", () => {
    const html = renderToStaticMarkup(createElement(Experience));
    expect(html).toContain("611");
    expect(html).toContain("Reviews &amp; feedback counted");
    expect(html).toContain("Google 1-star reviews are excluded");
    expect(html).not.toContain("5-Star Reviews");
  });
  it("renders the complete Google rating separately from the mixed count", () => {
    const html = renderToStaticMarkup(createElement(Reviews));
    expect(html).toContain("4.7");
    expect(html).toContain("208");
    expect(html).toContain("Kitchener");
    expect(html).toContain("611");
    expect(html).toContain("This count is separate from the Google rating above");
    expect(html).not.toContain("verified reviews");
    expect(html).not.toContain("4.9");
  });
  it("keeps the filtered comparison out of every static JSON-LD aggregate", () => {
    const matches = [...source("client/index.html").matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    expect(matches.length).toBeGreaterThan(0);
    const docs = matches.map((m) => JSON.parse(m[1]));
    expect(docs.every((doc) => !JSON.stringify(doc).includes('"aggregateRating"'))).toBe(true);
  });
  it("removes stale counts and unsupported multi-location aggregate ratings from the runtime sources", () => {
    for (const path of ["client/src/components/LocationPage.tsx", "client/src/pages/Home.tsx", "client/src/pages/Corporate.tsx", "server/seoRenderer.ts"]) {
      const text = source(path);
      expect(text, path).not.toMatch(/494\+?|495\+?|4\.9/);
    }
    expect(source("server/seoRenderer.ts")).not.toContain("aggregateRating:");
    expect(source("client/src/components/LocationPage.tsx")).not.toContain("aggregateRating:");
  });
});
