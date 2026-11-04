import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import {
  PRIVATE_EVENT_EXPERIENCES,
  PRIVATE_EVENT_SCHEDULES,
  PRIVATE_EVENT_VENUES,
  PRIVATE_EVENT_FORMAT_PRICE_NOTE,
  PRIVATE_EVENT_CUSTOM_SCOPE_NOTE,
} from "../shared/privateEventExperience";
import { PRIVATE_EVENT_PACKAGE_BANDS, privateEventBandLabel } from "../shared/privateEventPricing";
import { seoRenderMiddleware } from "./seoRenderer";
import { APY_SYSTEM_PROMPT } from "./chatbot-knowledge";

vi.mock("@/hooks/useSeoMeta", () => ({ useSeoMeta: vi.fn() }));
vi.mock("@/hooks/useMetaPixel", () => ({ useMetaPixel: () => ({ track: vi.fn() }) }));
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));
vi.mock("@/components/ChatbotWidget", () => ({ default: () => null }));
vi.mock("@/components/ScrollToTop", () => ({ default: () => null }));

import Corporate from "../client/src/pages/Corporate";
import PrivatePuppyYogaEvents from "../client/src/pages/PrivatePuppyYogaEvents";
import Kitchener from "../client/src/pages/Kitchener";
import Hamilton from "../client/src/pages/Hamilton";
import Oakville from "../client/src/pages/Oakville";

const PRIVATE_PAGES = [
  ["/corporate-puppy-yoga", Corporate],
  ["/private-puppy-yoga-events", PrivatePuppyYogaEvents],
] as const;
const PRIVATE_ROUTES = [...PRIVATE_PAGES.map(([route]) => route), "/private-events/quote"];

function visibleText(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function render(page: ComponentType, route: string): string {
  return renderToStaticMarkup(createElement(Router, { ssrPath: route }, createElement(page)));
}

function crawl(route: string) {
  let html = "";
  const response = {
    status: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    end: vi.fn((body: string) => { html = body; }),
  };
  const next = vi.fn();
  seoRenderMiddleware(
    { method: "GET", path: route, query: {}, headers: { "user-agent": "Googlebot" } } as Request,
    response as unknown as Response,
    next,
  );
  expect(next).not.toHaveBeenCalled();
  expect(response.status).toHaveBeenCalledWith(200);
  const schemas = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map(match => JSON.parse(match[1]));
  return { html, schemas };
}

function expectExperiencesAndFormats(content: string) {
  for (const experience of Object.values(PRIVATE_EVENT_EXPERIENCES)) {
    expect(content).toContain(experience.name);
    expect(content).toContain(experience.description);
  }
  for (const schedule of Object.values(PRIVATE_EVENT_SCHEDULES)) expect(content).toContain(schedule);
  expect(content).toContain(PRIVATE_EVENT_VENUES.studio);
  expect(content).toContain(PRIVATE_EVENT_VENUES.client_venue.toLowerCase());
  expect(content).toContain("subject to availability");
  expect(content).toContain("room resets");
  expect(content).toContain("puppy rest");
  expect(content).toContain(PRIVATE_EVENT_FORMAT_PRICE_NOTE);
  expect(content).toContain(PRIVATE_EVENT_CUSTOM_SCOPE_NOTE);
  expect(content).toContain("nonstandard durations");
  expect(content).toContain("help choosing");
}

function expectOriginalBands(content: string) {
  for (const key of ["classic", "signature", "luxury"] as const) {
    expect(content).toContain(privateEventBandLabel(key));
  }
  expect(PRIVATE_EVENT_PACKAGE_BANDS).toMatchObject({
    classic: { min: 1500, max: 1750 },
    signature: { min: 2000, max: 2250 },
    luxury: { min: 2500, max: 3500 },
  });
  expect(content).not.toMatch(/\$1,?200\b|\$1,?800\b/);
}

describe("private event public experience content", () => {
  it.each(PRIVATE_PAGES)("%s renders both experiences, independent formats and full custom quote caveats", (route, page) => {
    const html = render(page, route);
    const content = visibleText(html);
    expectExperiencesAndFormats(content);
    expectOriginalBands(content);
    expect(content).toContain("never a multiplied package price");
    expect(content).toMatch(/(?:without a guided yoga class|without guided yoga|without yoga)/);
    expect(html).toContain('href="/private-events/quote#private-event-experiences"');
    expect(html).toContain('href="/private-events/quote"');
  });

  it("keeps the private info page focused on a quoted event rather than public-class checkout", () => {
    const html = render(PrivatePuppyYogaEvents, "/private-puppy-yoga-events");
    expect(html).not.toContain("<iframe");
    expect(visibleText(html)).not.toContain("View Upcoming Classes");
    expect(visibleText(html)).not.toContain("What's Included in Every Session");
    expect(visibleText(html)).toContain("Standard Private Puppy Yoga Includes");
  });

  it.each(PRIVATE_ROUTES)("%s crawler visibly includes experiences, schedules and unchanged approved bands", route => {
    const { html } = crawl(route);
    const content = visibleText(html);
    expectExperiencesAndFormats(content);
    expectOriginalBands(content);
    expect(content).toContain("Schedule is separate from the experience");
    expect(content).toContain("never a multiplied package price");
    expect(html).toContain('href="/private-events/quote#private-event-experiences"');
    expect(html).not.toMatch(/"startDate"|"@type":"Event"|"availability":/);
  });

  it.each(PRIVATE_ROUTES)("%s Service and Offer descriptions scope numeric prices to standard studio yoga only", route => {
    const { schemas } = crawl(route);
    const service = schemas.find(schema => schema["@type"] === "Service");
    expectExperiencesAndFormats(service.description);
    expect(service.description).toContain(PRIVATE_EVENT_FORMAT_PRICE_NOTE);
    expect(service.offers.description).toContain(PRIVATE_EVENT_FORMAT_PRICE_NOTE);
    expect(service.offers.description).toContain(PRIVATE_EVENT_CUSTOM_SCOPE_NOTE);
    expect(service.offers).toMatchObject({
      "@type": "Offer",
      price: "1500",
      priceCurrency: "CAD",
      priceSpecification: {
        minPrice: 1500,
        maxPrice: 1750,
        valueAddedTaxIncluded: false,
      },
    });
    expect(service.offers).not.toHaveProperty("availability");
    const faq = schemas.find(schema => schema["@type"] === "FAQPage");
    const scheduleAnswer = faq.mainEntity.find((question: { name: string }) => /multiple sessions/.test(question.name)).acceptedAnswer.text;
    expect(scheduleAnswer).toContain(PRIVATE_EVENT_FORMAT_PRICE_NOTE);
    const pricingAnswer = faq.mainEntity.find((question: { name: string }) => /cost/.test(question.name)).acceptedAnswer.text;
    expectOriginalBands(pricingAnswer);
    expect(pricingAnswer).toContain(PRIVATE_EVENT_FORMAT_PRICE_NOTE);
    expect(pricingAnswer).toContain("never a multiplied package price");
  });

  it("chatbot treats lounge and scheduling as separately scoped requests, not blanket same-price packages", () => {
    expectExperiencesAndFormats(APY_SYSTEM_PROMPT);
    expectOriginalBands(APY_SYSTEM_PROMPT);
    expect(APY_SYSTEM_PROMPT).toContain("Never multiply a standard package band by the number of sessions");
    expect(APY_SYSTEM_PROMPT).toContain("or tell visitors all formats cost the same");
    expect(APY_SYSTEM_PROMPT).toContain("no guided yoga class in the lounge");
    expect(APY_SYSTEM_PROMPT).toContain("Do not promise a permanent APY studio in Guelph");
    expect(APY_SYSTEM_PROMPT).toContain("https://afropuppyyoga.ca/private-events/quote#private-event-experiences");
  });

  it.each([
    ["/puppy-yoga-kitchener", Kitchener],
    ["/puppy-yoga-hamilton", Hamilton],
    ["/puppy-yoga-oakville", Oakville],
  ] as const)("%s retains public class calendar, refreshments, schema and public prices", (route, page) => {
    const html = render(page, route);
    expect(html).toContain("<iframe");
    expect(visibleText(html)).toContain("View Upcoming Classes");
    expect(visibleText(html)).toContain("Complimentary refreshments");
    const { schemas } = crawl(route);
    const business = schemas.find(schema => schema["@type"] === "LocalBusiness");
    expect(business).toBeDefined();
    expect(business.priceRange).toBe("$$");
  });
});
