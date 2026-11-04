import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { FIVE_STAR_REVIEW_COUNT } from "@shared/reviewMetrics";
import { seoRenderMiddleware } from "./seoRenderer";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function crawlerPage(path: string) {
  let html = "";
  const response = {
    status: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    end: vi.fn((body: string) => { html = body; }),
  };
  const next = vi.fn();
  seoRenderMiddleware({ method: "GET", path, query: {}, headers: { "user-agent": "Googlebot" } } as Request, response as unknown as Response, next);
  expect(next).not.toHaveBeenCalled();
  expect(response.status).toHaveBeenCalledWith(200);
  const schemas = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map(match => JSON.parse(match[1]));
  return { html, schemas };
}

describe("APY city landing pages", () => {
  it("registers Guelph and exposes it in the homepage, menu, footer, city links and sitemap", () => {
    for (const path of ["client/src/App.tsx", "client/src/components/sections/Hero.tsx", "client/src/components/Navbar.tsx", "client/src/components/Footer.tsx", "client/src/components/LocationPage.tsx", "client/public/sitemap.xml"]) {
      expect(read(path), path).toContain("/puppy-yoga-guelph");
    }
    expect(read("client/src/App.tsx")).toContain('lazy(() => import("./pages/Guelph"))');
    expect(read("client/src/components/sections/Experience.tsx")).toContain('value={4} suffix="" label="Ontario Locations"');
  });

  it("keeps Colibri the main Hamilton studio, with its complete address and a separate collaboration label", () => {
    const page = read("client/src/pages/Hamilton.tsx");
    expect(page).toContain('venueName: "Colibri Studio (Main Studio)"');
    expect(page).toContain('venueAddress: "2751 Barton Street East, Hamilton, ON L8E 2J8"');
    expect(page).toContain('streetAddress: "2751 Barton Street East"');
    expect(page).toContain('venueArea: "Hamilton, Ontario"');
    expect(page).toContain('postalCode: "L8E 2J8"');
    expect(page).toContain("Something New (Collaboration Location)");
    expect(page).toContain("416 Concession Street");
    expect(page).not.toContain("downtown Hamilton");
    expect(page).not.toContain('streetAddress: ""');
  });

  it("shows the verified Guelph venue without inventing a permanent studio or copying conflicting postal codes", () => {
    const page = read("client/src/pages/Guelph.tsx");
    expect(page).toContain("Emotion Dance Company");
    expect(page).toContain("375 Southgate Drive, Unit 2, Guelph, Ontario");
    expect(page).toContain("selected event listing before booking");
    expect(page).toContain("Moments from AfroPuppyYoga");
    expect(page).toContain('"@type": "Service"');
    expect(page).not.toMatch(/"@type": "LocalBusiness"|N1G 3W6|N1G 4Y1|openingHoursSpecification/);
  });

  it("keeps the unfiltered original Luma calendar and an external booking fallback to avoid hiding untagged events", () => {
    const page = read("client/src/pages/Guelph.tsx");
    expect(page).toContain("https://lu.ma/embed/calendar/cal-Z474jeIbvUXskHE/events?theme=light&lt=light");
    expect(page).not.toContain("tag=guelph");
    expect(page).toContain("appendAttributionToLumaUrl(CALENDAR_URL)");
    expect(page).toContain("appendAttributionToLumaUrl(BOOK_URL)");
    expect(page).toContain("Browse events across all our locations");
    expect(page).toContain('rel="noopener noreferrer"');
    expect(page).toContain('href="/private-events/quote"');
  });

  it("serves Guelph crawler HTML with the correct canonical, verified address and service-area schema", () => {
    const { html, schemas } = crawlerPage("/puppy-yoga-guelph");
    expect(html).toContain('<link rel="canonical" href="https://afropuppyyoga.ca/puppy-yoga-guelph"');
    expect(html).toContain("375 Southgate Drive, Unit 2");
    expect(html).toContain(`${FIVE_STAR_REVIEW_COUNT} five-star reviews`);
    expect(schemas.find(schema => schema["@type"] === "Service")).toMatchObject({ areaServed: { name: "Guelph" }, provider: { name: "AfroPuppyYoga" } });
    expect(schemas.some(schema => schema["@type"] === "LocalBusiness")).toBe(false);
  });

  it("keeps Hamilton's crawler main-studio address aligned with the visible page", () => {
    const { html, schemas } = crawlerPage("/puppy-yoga-hamilton");
    expect(html).toContain("Colibri Studio (Main Studio)");
    expect(html).toContain("collaboration location for selected events only");
    const business = schemas.find(schema => schema["@type"] === "LocalBusiness");
    expect(business.address).toMatchObject({ streetAddress: "2751 Barton Street East", addressLocality: "Hamilton", postalCode: "L8E 2J8" });
  });
});
