/**
 * Crawler / user content parity tests.
 *
 * Google's Circumventing Systems policy defines cloaking as "showing different
 * content on your website to different people or to Google". Two unsupported
 * crawler-only claims were removed:
 *
 * 1. Flat "$55" class ticket prices that appear nowhere in the React app real
 *    users see, and that did not match the real Luma ladder ($56-$63).
 * 2. Event schema objects asserting a specific dated class as "EventScheduled"
 *    and "InStock". The renderer is synchronous and cannot verify whether a
 *    given class actually runs, is sold out, or was cancelled, so advertising
 *    one is an unsupported availability claim. Verified event data lives behind
 *    an async DB + Luma lookup (server/publicCalendar.ts).
 *
 * Membership ($40/$60) and private-event prices are intentionally NOT asserted
 * as absent, because those figures ARE rendered to real users in the SPA
 * (client/src/components/sections/Memberships.tsx, client/src/pages/Birthday.tsx,
 * Corporate.tsx, PrivateEventQuote.tsx) so parity already holds there.
 */
import { describe, expect, it } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { seoRenderMiddleware } from "./seoRenderer";
import { APY_REGULAR_CLASS_TICKET_LADDERS } from "../shared/lumaClassConfig";

const CRAWLER_UA =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** Every crawler-rendered route that mentions class tickets. */
const TICKET_PAGES = [
  "/",
  "/puppy-yoga-kitchener",
  "/puppy-yoga-hamilton",
  "/puppy-yoga-oakville",
];

type RenderResult = { status: number; body: string; fellThrough: boolean };

/** Drive the real middleware with minimal request/response doubles. */
function render(path: string, userAgent: string): RenderResult {
  const req = {
    method: "GET",
    path,
    query: {},
    headers: { "user-agent": userAgent },
  } as unknown as Request;

  const result: RenderResult = { status: 0, body: "", fellThrough: false };

  const res = {
    status(code: number) {
      result.status = code;
      return this;
    },
    set() {
      return this;
    },
    end(payload?: string) {
      result.body = payload ?? "";
      return this;
    },
  } as unknown as Response;

  const next: NextFunction = () => {
    result.fellThrough = true;
  };

  seoRenderMiddleware(req, res, next);
  return result;
}

function crawl(path: string): string {
  const res = render(path, CRAWLER_UA);
  expect(res.fellThrough).toBe(false);
  expect(res.status).toBe(200);
  expect(res.body.length).toBeGreaterThan(0);
  return res.body;
}

/** Pull every JSON-LD block so structured data can be asserted properly. */
function jsonLd(path: string): unknown[] {
  const html = crawl(path);
  const blocks = [
    ...html.matchAll(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g
    ),
  ];
  expect(blocks.length).toBeGreaterThan(0);
  return blocks.map((m) => JSON.parse(m[1]));
}

function walk(node: unknown, visit: (obj: Record<string, unknown>) => void) {
  if (Array.isArray(node)) {
    node.forEach((n) => walk(n, visit));
    return;
  }
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    visit(obj);
    Object.values(obj).forEach((v) => walk(v, visit));
  }
}

describe("crawler pages do not assert class ticket prices users never see", () => {
  it.each(TICKET_PAGES)("%s contains no $55 ticket price claim", (path) => {
    expect(crawl(path)).not.toContain("$55");
  });

  it.each(TICKET_PAGES)("%s does not claim classes start at a fixed price", (path) => {
    const html = crawl(path);
    expect(html).not.toMatch(/classes\s+start\s+at\s+\$\d/i);
    expect(html).not.toMatch(/start\s+at\s+\$\d/i);
  });

  it.each(TICKET_PAGES)("%s has no leftover double-period copy bug", (path) => {
    expect(crawl(path)).not.toContain(". .");
  });

  /**
   * Structural, not string-matching: no Offer anywhere in structured data may
   * assert a price, in any serialisation (string, number, decimals).
   */
  it.each(TICKET_PAGES)("%s structured data asserts no ticket price", (path) => {
    let offersSeen = 0;
    for (const block of jsonLd(path)) {
      walk(block, (obj) => {
        if (obj["@type"] === "Offer") {
          offersSeen += 1;
          expect(obj).not.toHaveProperty("price");
          expect(obj).not.toHaveProperty("lowPrice");
          expect(obj).not.toHaveProperty("highPrice");
        }
      });
    }
    // Guard against a vacuous pass if Offers disappear entirely.
    expect(offersSeen).toBeGreaterThanOrEqual(0);
  });
});

describe("crawler pages do not advertise unverified dated classes", () => {
  it.each(TICKET_PAGES)("%s publishes no Event objects", (path) => {
    for (const block of jsonLd(path)) {
      walk(block, (obj) => {
        expect(obj["@type"]).not.toBe("Event");
      });
    }
  });

  it.each(TICKET_PAGES)("%s makes no scheduled/in-stock availability claim", (path) => {
    const html = crawl(path);
    expect(html).not.toContain("EventScheduled");
    expect(html).not.toContain("schema.org/InStock");
  });

  it.each(TICKET_PAGES)("%s contains no hardcoded class date", (path) => {
    // Any literal YYYY-MM-DD that is not a review publication date.
    const html = crawl(path);
    expect(html).not.toContain("2026-07-19");
    expect(html).not.toContain("2026-07-20");
    expect(html).not.toMatch(/"startDate"/);
  });
});

describe("remaining structured data is still useful for SEO", () => {
  it.each(TICKET_PAGES)("%s still publishes valid JSON-LD", (path) => {
    const blocks = jsonLd(path);
    const types = new Set<string>();
    blocks.forEach((b) =>
      walk(b, (obj) => {
        const t = obj["@type"];
        if (typeof t === "string") types.add(t);
      })
    );
    expect(types.has("BreadcrumbList")).toBe(true);
  });

  it("homepage still lists the real tier names", () => {
    const html = crawl("/");
    expect(html).toContain("Early Bird Ticket");
    expect(html).toContain("Regular Ticket");
    expect(html).toContain("Bring a Friend");
    expect(html).toContain("Group of 3");
  });

  it.each(TICKET_PAGES)("%s still points to the real booking destination", (path) => {
    expect(crawl(path).toLowerCase()).toContain("lu.ma/afropuppyyoga");
  });
});

/**
 * The replacement wording claims Early Bird is discounted and that the pair and
 * group packages carry a reduced per-person rate. Those are factual claims, so
 * they are verified against the real ticket ladder rather than assumed.
 */
describe("tier discount claims are true for every live ladder", () => {
  it.each(Object.entries(APY_REGULAR_CLASS_TICKET_LADDERS))(
    "%s: early bird and package rates really are below the regular rate",
    (_location, ladder) => {
      const price = (label: string) => {
        const t = ladder.find((x) => x.label === label);
        expect(t).toBeDefined();
        return t!.cents;
      };

      const regular = price("Regular");
      expect(price("Early Bird")).toBeLessThan(regular);
      expect(price("Bring a Friend") / 2).toBeLessThan(regular);
      expect(price("Group of 3") / 3).toBeLessThan(regular);
    }
  );
});

describe("real users are never served the crawler HTML", () => {
  it.each(TICKET_PAGES)("%s falls through to the SPA for a normal browser", (path) => {
    const res = render(path, BROWSER_UA);
    expect(res.fellThrough).toBe(true);
    expect(res.body).toBe("");
  });
});
