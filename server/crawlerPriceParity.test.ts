/**
 * Crawler / user content parity tests.
 *
 * Google's Circumventing Systems policy defines cloaking as "showing different
 * content on your website to different people or to Google". The crawler-rendered
 * HTML previously asserted flat "$55" ticket prices that appear nowhere in the
 * React app that real users see, and that did not match the real Luma ticket
 * ladder (which varies by date and tier).
 *
 * These tests lock that fix in: crawler HTML must never again assert a hard
 * class ticket price that users are not shown.
 *
 * Private-event and membership prices are intentionally NOT asserted as absent,
 * because those figures ARE rendered to real users in the SPA
 * (client/src/pages/Corporate.tsx, Birthday.tsx, PrivateEventQuote.tsx,
 * client/src/components/sections/Memberships.tsx) so parity already holds there.
 */
import { describe, expect, it } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { nextWeekdayIso, seoRenderMiddleware } from "./seoRenderer";

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

describe("crawler pages do not assert class ticket prices users never see", () => {
  it.each(TICKET_PAGES)("%s contains no $55 ticket price claim", (path) => {
    expect(crawl(path)).not.toContain("$55");
  });

  it.each(TICKET_PAGES)("%s does not claim classes start at a fixed price", (path) => {
    const html = crawl(path);
    expect(html).not.toMatch(/classes\s+start\s+at\s+\$\d/i);
    expect(html).not.toMatch(/start\s+at\s+\$55/i);
  });

  it.each(TICKET_PAGES)("%s Event offers carry no fabricated price", (path) => {
    const html = crawl(path);
    expect(html).not.toMatch(/"price"\s*:\s*"55"/);
  });

  it.each(TICKET_PAGES)("%s has no leftover double-period copy bug", (path) => {
    expect(crawl(path)).not.toContain(". .");
  });
});

describe("ticket tier structure is still exposed for SEO", () => {
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

describe("corporate package copy matches what users are shown", () => {
  it("keeps the starting prices users see and drops invented upper bounds", () => {
    const html = crawl("/corporate-puppy-yoga");
    // Corporate.tsx shows "Starting at $1,200" and "Starting at $2,000".
    expect(html).toContain("$1,200");
    expect(html).toContain("$2,000");
    expect(html).not.toContain("$1,800");
    expect(html).not.toContain("$3,500");
  });
});

describe("real users are never served the crawler HTML", () => {
  it.each(TICKET_PAGES)("%s falls through to the SPA for a normal browser", (path) => {
    const res = render(path, BROWSER_UA);
    expect(res.fellThrough).toBe(true);
    expect(res.body).toBe("");
  });
});

/**
 * Event schema previously carried hardcoded July 2026 dates while still
 * claiming "EventScheduled" and "InStock". By October those were three months
 * stale, telling Google a long-past class was still bookable.
 */
describe("advertised class dates never go stale", () => {
  it("always returns a future date, never today", () => {
    // A Saturday. Asking for Saturday must roll forward a full week.
    const saturday = new Date("2026-10-17T12:00:00Z");
    const { startDate } = nextWeekdayIso(6, 10, 90, saturday);
    expect(startDate.startsWith("2026-10-24")).toBe(true);
  });

  it("returns the next Saturday from a mid-week date", () => {
    const friday = new Date("2026-10-16T12:00:00Z");
    const { startDate, endDate } = nextWeekdayIso(6, 10, 90, friday);
    expect(startDate).toBe("2026-10-17T10:00:00-04:00");
    expect(endDate).toBe("2026-10-17T11:30:00-04:00");
  });

  it("returns the next Sunday from a mid-week date", () => {
    const friday = new Date("2026-10-16T12:00:00Z");
    const { startDate } = nextWeekdayIso(0, 10, 90, friday);
    expect(startDate).toBe("2026-10-18T10:00:00-04:00");
  });

  it("uses the standard-time offset in winter", () => {
    const january = new Date("2027-01-06T12:00:00Z");
    const { startDate } = nextWeekdayIso(6, 10, 90, january);
    expect(startDate.endsWith("-05:00")).toBe(true);
  });

  it("uses the daylight-time offset in summer", () => {
    const july = new Date("2027-07-07T12:00:00Z");
    const { startDate } = nextWeekdayIso(6, 10, 90, july);
    expect(startDate.endsWith("-04:00")).toBe(true);
  });

  it("crawler pages advertise no past class dates", () => {
    const today = new Date().toISOString().slice(0, 10);
    for (const path of TICKET_PAGES) {
      const html = crawl(path);
      const dates = [...html.matchAll(/"startDate":"(\d{4}-\d{2}-\d{2})/g)].map(
        (m) => m[1]
      );
      for (const d of dates) {
        expect(d >= today).toBe(true);
      }
    }
  });

  it("no hardcoded 2026-07 class dates remain", () => {
    for (const path of TICKET_PAGES) {
      expect(crawl(path)).not.toContain("2026-07-19");
      expect(crawl(path)).not.toContain("2026-07-20");
    }
  });
});
