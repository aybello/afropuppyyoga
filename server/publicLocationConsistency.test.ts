import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import type { Request, Response } from "express";
import {
  PUBLIC_LOCATION_NAMES, PUBLIC_LOCATION_COUNT, PUBLIC_LOCATION_LIST,
  MEMBERSHIP_LOCATION_COPY, PUBLIC_LOCATION_FAQ, HOME_SEO_TITLE,
  HOME_SEO_DESCRIPTION, LOYALTY_SEO_DESCRIPTION, PUBLIC_SERVICE_DESCRIPTION,
} from "@shared/publicLocations";
import { seoRenderMiddleware } from "./seoRenderer";
import { APY_SYSTEM_PROMPT } from "./chatbot-knowledge";

vi.mock("@/lib/trpc", () => ({
  trpc: { system: { notifyOwner: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) } } },
}));
import Memberships from "../client/src/components/sections/Memberships";
import Loyalty from "../client/src/pages/Loyalty";
import Contact from "../client/src/components/sections/Contact";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const schemas = (html: string) => [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(match => JSON.parse(match[1]));
const text = (html: string) => html.replace(/<[^>]*>/g, "");
const renderMemberships = () => renderToStaticMarkup(createElement(Router, { ssrPath: "/" }, createElement(Memberships)));

function crawler(path: string) {
  let html = "";
  const response = { status: vi.fn().mockReturnThis(), set: vi.fn().mockReturnThis(), end: vi.fn((body: string) => { html = body; }) };
  const next = vi.fn();
  seoRenderMiddleware({ method: "GET", path, query: {}, headers: { "user-agent": "Googlebot" } } as Request, response as unknown as Response, next);
  expect(next).not.toHaveBeenCalled();
  expect(response.status).toHaveBeenCalledWith(200);
  return html;
}

describe("connected public four-location information", () => {
  it("uses one public city list, not permanent-studio or staffing codes", () => {
    expect(PUBLIC_LOCATION_NAMES).toEqual(["Kitchener", "Hamilton", "Oakville", "Guelph"]);
    expect(PUBLIC_LOCATION_COUNT).toBe(4);
    expect(PUBLIC_LOCATION_LIST).toBe("Kitchener, Hamilton, Oakville and Guelph");
  });

  it("includes all four cities in both membership validity statements", () => {
    const html = renderMemberships();
    expect(text(html)).toContain(MEMBERSHIP_LOCATION_COPY);
    expect(text(html)).toContain(`Valid in ${PUBLIC_LOCATION_LIST}`);
    for (const city of PUBLIC_LOCATION_NAMES) expect(html.match(new RegExp(city, "g"))).toHaveLength(2);
    expect(html).not.toContain("three cities");
  });

  it("preserves membership prices, monthly credits, discounts and commitment terms", () => {
    const html = text(renderMemberships());
    for (const value of ["$40/month", "$60/month", "1 free class per month", "2 free classes per month", "20% off any additional classes", "Free class during your birthday month", "Classes do not roll over", "3-month minimum commitment", "Cancel anytime after that"]) expect(html).toContain(value);
    expect(html).not.toContain("Unlimited classes");
  });

  it("includes Guelph in rewards coverage without changing the three-class reward flow", () => {
    const html = text(renderToStaticMarkup(createElement(Loyalty)));
    expect(html).toContain(`Works across all APY locations: ${PUBLIC_LOCATION_LIST}`);
    expect(html).toContain(`Your attendance is tracked by email address across ${PUBLIC_LOCATION_LIST}`);
    expect(html).toContain("Attend 3 classes. Get your 4th free.");
    expect(html).toContain("valid for 60 days");
    expect(html).toContain("Private events and gifted tickets may not count");
  });

  it("includes Guelph in contact with the verified venue and selected-event guidance", () => {
    const html = renderToStaticMarkup(createElement(Contact));
    for (const city of PUBLIC_LOCATION_NAMES) expect(html).toContain(city);
    expect(html).toContain("Emotion Dance Company");
    expect(html).toContain("375 Southgate Drive, Unit 2, Guelph, ON");
    expect(html).toContain('href="/puppy-yoga-guelph"');
    expect(html).toContain("Check the venue on your selected event before booking.");
  });

  it("keeps static, client and crawler homepage metadata synchronized", () => {
    const staticHtml = read("client/index.html");
    const crawlerHtml = crawler("/");
    for (const html of [staticHtml, crawlerHtml]) {
      expect(html).toContain(`<title>${HOME_SEO_TITLE}</title>`);
      expect(html).toContain(`name="description" content="${HOME_SEO_DESCRIPTION}"`);
      expect(html).toContain(`property="og:description" content="${HOME_SEO_DESCRIPTION}"`);
      expect(html).toContain(`name="twitter:description" content="${HOME_SEO_DESCRIPTION}"`);
    }
    expect(read("client/src/pages/Home.tsx")).toContain("title: HOME_SEO_TITLE");
    expect(read("client/src/pages/Home.tsx")).toContain("description: HOME_SEO_DESCRIPTION");
  });

  it("keeps static and crawler service areas complete without inventing a Guelph business address", () => {
    for (const html of [read("client/index.html"), crawler("/")]) {
      const business = schemas(html).find(schema => schema["@type"] === "LocalBusiness");
      expect(business.areaServed.map((city: { name: string }) => city.name)).toEqual(PUBLIC_LOCATION_NAMES);
      expect(business.description).toBe(PUBLIC_SERVICE_DESCRIPTION);
      expect(business.address.addressLocality).toBe("Kitchener");
      const faq = schemas(html).find(schema => schema["@type"] === "FAQPage");
      expect(faq.mainEntity.find((q: { name: string }) => q.name === "Where are your classes held?").acceptedAnswer.text).toBe(PUBLIC_LOCATION_FAQ);
    }
    expect(read("client/src/components/sections/FAQ.tsx")).toContain("a: PUBLIC_LOCATION_FAQ");
  });

  it("serves crawler membership terms that match the visible passes rather than unlimited classes", () => {
    const html = crawler("/");
    expect(html).toContain(MEMBERSHIP_LOCATION_COPY);
    expect(html).toContain("$40/month, 1 class credit per month");
    expect(html).toContain("$60/month, 2 class credits per month");
    expect(html).toContain("Credits do not roll over");
    expect(html).not.toContain("Unlimited classes");
    expect(html).toContain("375 Southgate Drive, Unit 2, Guelph, ON");
    expect(html).toContain(PUBLIC_LOCATION_FAQ);
  });

  it("serves four-city rewards metadata and the actual reward flow to crawlers", () => {
    const html = crawler("/loyalty");
    expect(html).toContain(LOYALTY_SEO_DESCRIPTION);
    expect(html).toContain(`email across ${PUBLIC_LOCATION_LIST}`);
    expect(html).toContain("Attend 3 qualifying APY classes");
    expect(html).toContain("valid for 60 days");
    expect(html).not.toContain("Earn bonus points");
    expect(html).not.toContain("Points never expire");
    expect(read("client/src/pages/Loyalty.tsx")).toContain("description: LOYALTY_SEO_DESCRIPTION");
  });

  it("keeps corporate and private crawler service coverage complete with venue availability guidance", () => {
    for (const route of ["/corporate-puppy-yoga", "/private-puppy-yoga-events", "/private-events/quote"]) {
      const html = crawler(route);
      expect(html).toContain(PUBLIC_LOCATION_LIST);
      expect(html).toContain("subject to availability");
      expect(html).not.toContain("our studios in Kitchener, Hamilton, Oakville, and Guelph");
    }
  });

  it("keeps chatbot city and membership knowledge current without inventing recurring dates", () => {
    expect(APY_SYSTEM_PROMPT).toContain(`4 public locations: ${PUBLIC_LOCATION_LIST}`);
    expect(APY_SYSTEM_PROMPT).toContain(MEMBERSHIP_LOCATION_COPY);
    expect(APY_SYSTEM_PROMPT).toContain(PUBLIC_LOCATION_FAQ);
    expect(APY_SYSTEM_PROMPT).toContain("Do not describe Guelph as a permanent APY studio");
    expect(APY_SYSTEM_PROMPT).not.toContain("two locations");
    expect(APY_SYSTEM_PROMPT).not.toContain("Oakville: Coming soon");
    expect(APY_SYSTEM_PROMPT).not.toContain("Classes run on Saturdays at");
  });

  it("derives public location counts and checks each service city's existing route, navigation and sitemap", () => {
    expect(read("client/src/components/sections/Experience.tsx")).toContain("value={PUBLIC_LOCATION_COUNT}");
    expect(read("client/src/pages/Corporate.tsx")).toContain('stat: PUBLIC_LOCATION_COUNT, label: "Ontario locations"');
    for (const city of PUBLIC_LOCATION_NAMES) {
      const route = `/puppy-yoga-${city.toLowerCase()}`;
      for (const path of ["client/src/App.tsx", "client/src/components/Navbar.tsx", "client/src/components/Footer.tsx", "client/src/components/sections/Hero.tsx", "client/public/sitemap.xml"]) expect(read(path), `${city}: ${path}`).toContain(route);
    }
  });
});
