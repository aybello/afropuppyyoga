import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import * as reviewMetrics from "../shared/reviewMetrics";
import {
  FIVE_STAR_REVIEW_COUNT,
  REVIEW_COUNT_LABEL,
  REVIEW_METRICS,
} from "../shared/reviewMetrics";
import { seoRenderMiddleware } from "./seoRenderer";

vi.mock("../client/src/hooks/useCountUp", () => ({
  useCountUp: (value: number) => ({ count: value, ref: { current: null } }),
}));

import Reviews from "../client/src/components/sections/Reviews";
import Experience from "../client/src/components/sections/Experience";

const source = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const INTERNAL_METHOD_COPY =
  /reviews?\s*(?:&|and)\s*feedback counted|Google 1-star reviews?|\bexclude[ds]?\b|authenticated Luma|CSV|exported|repeat guests?|July 2025|October 2026|count is separate|scope disclosure|audit/i;

function crawlHomepage(path = "/"): string {
  const req = {
    method: "GET",
    path,
    query: {},
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    },
  } as unknown as Request;

  let status = 0;
  let body = "";
  let fellThrough = false;
  const res = {
    status(code: number) {
      status = code;
      return this;
    },
    set() {
      return this;
    },
    end(payload?: string) {
      body = payload ?? "";
      return this;
    },
  } as unknown as Response;
  const next: NextFunction = () => {
    fellThrough = true;
  };

  seoRenderMiddleware(req, res, next);
  expect(fellThrough).toBe(false);
  expect(status).toBe(200);
  return body;
}

describe("five-star review count baseline", () => {
  it("keeps the exact source histograms and Google rating denominator", () => {
    expect(REVIEW_METRICS.google.stars).toEqual({
      5: 182,
      4: 6,
      3: 6,
      2: 3,
      1: 11,
    });
    expect(REVIEW_METRICS.luma.stars).toEqual({
      5: 364,
      4: 29,
      3: 4,
      2: 7,
      1: 10,
    });
    expect(REVIEW_METRICS.google.total).toBe(208);
    expect(REVIEW_METRICS.google.rating).toBe(4.7);
    expect(REVIEW_METRICS.luma.total).toBe(414);
  });

  it("computes 546 from only the Google and Luma five-star buckets", () => {
    expect(FIVE_STAR_REVIEW_COUNT).toBe(
      REVIEW_METRICS.google.stars[5] + REVIEW_METRICS.luma.stars[5],
    );
    expect(FIVE_STAR_REVIEW_COUNT).toBe(546);
    expect(FIVE_STAR_REVIEW_COUNT).not.toBe(581);
    expect(FIVE_STAR_REVIEW_COUNT).not.toBe(611);
    expect(REVIEW_COUNT_LABEL).toBe("Five-Star Reviews");
  });

  it("removes the retired filtered-count and disclosure exports", () => {
    expect(reviewMetrics).not.toHaveProperty("COUNTED_GOOGLE_REVIEWS");
    expect(reviewMetrics).not.toHaveProperty("REVIEW_FEEDBACK_COUNT");
    expect(reviewMetrics).not.toHaveProperty("REVIEW_COUNT_NOTE");
  });

  it("renders the Experience stat without public methodology notes", () => {
    const html = renderToStaticMarkup(createElement(Experience));
    expect(html).toContain("546");
    expect(html).toContain("Five-Star Reviews");
    expect(html).not.toContain("Google + Luma");
    expect(html).not.toContain("across Google and Luma");
    expect(html).not.toContain("581");
    expect(html).not.toContain("611");
    expect(html).not.toMatch(INTERNAL_METHOD_COPY);
  });

  it("renders concise customer copy while keeping the Google source badge separate", () => {
    const html = renderToStaticMarkup(createElement(Reviews));
    expect(html).toContain("546 Five-Star Reviews");
    expect(html).not.toContain("Google + Luma");
    expect(html).not.toContain("across Google and Luma");
    expect(html).toContain("4.7");
    expect(html).toContain("Google: 208 reviews, Kitchener");
    expect(html).not.toContain("581");
    expect(html).not.toContain("611");
    expect(html).not.toMatch(INTERNAL_METHOD_COPY);
  });

  it("gives crawlers the same concise count and source-specific Google claim", () => {
    const html = crawlHomepage();
    expect(html).toContain("546 Five-Star Reviews");
    expect(html).not.toContain("Google + Luma");
    expect(html).not.toContain("across Google and Luma");
    expect(html).toContain(
      "Our Kitchener studio has a 4.7 rating from all 208 Google reviews.",
    );
    expect(html).not.toContain("581");
    expect(html).not.toContain("611");
    expect(html).not.toMatch(INTERNAL_METHOD_COPY);
  });

  it("keeps the mixed count out of every static JSON-LD aggregate", () => {
    const matches = [
      ...source("client/index.html").matchAll(
        /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
      ),
    ];
    expect(matches.length).toBeGreaterThan(0);
    const docs = matches.map((match) => JSON.parse(match[1]));
    expect(
      docs.every((doc) => !JSON.stringify(doc).includes('"aggregateRating"')),
    ).toBe(true);
  });

  it("removes stale counts and unsupported multi-location aggregate ratings from runtime sources", () => {
    for (const path of [
      "client/src/components/LocationPage.tsx",
      "client/src/pages/Home.tsx",
      "client/src/pages/Corporate.tsx",
      "server/seoRenderer.ts",
    ]) {
      const text = source(path);
      expect(text, path).not.toMatch(/494\+?|495\+?|4\.9/);
    }
    expect(source("server/seoRenderer.ts")).not.toContain("aggregateRating:");
    expect(source("client/src/components/LocationPage.tsx")).not.toContain(
      "aggregateRating:",
    );
  });
  it("highlights the same five-star claim in search and social previews", () => {
    const shell = source("client/index.html");
    for (const name of ['name="description"', 'property="og:description"', 'name="twitter:description"']) {
      expect(shell.match(new RegExp(`<meta ${name} content="([^"]*)"`))?.[1]).toContain("546 five-star reviews");
    }
    for (const route of ["/", "/corporate-puppy-yoga", "/private-puppy-yoga-events", "/puppy-yoga-kitchener", "/puppy-yoga-hamilton", "/puppy-yoga-oakville"]) {
      const html = crawlHomepage(route);
      expect(html.match(/<meta name="description" content="([^"]*)"/)?.[1], route).toContain("546 five-star reviews");
      expect(html, route).not.toMatch(INTERNAL_METHOD_COPY);
    }
    for (const path of ["client/src/pages/Home.tsx", "client/src/pages/Corporate.tsx", "client/src/components/LocationPage.tsx"]) {
      expect(source(path), path).toContain("${FIVE_STAR_REVIEW_COUNT} five-star reviews");
    }
  });

});
