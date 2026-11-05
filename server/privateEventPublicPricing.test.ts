import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import {
  PRIVATE_EVENT_PACKAGE_BANDS,
  privateEventBandLabel,
  PRIVATE_EVENT_PRICE_NOTE,
  PRIVATE_EVENT_TRAVEL_NOTE,
  PRIVATE_EVENT_CUSTOM_NOTE,
} from "../shared/privateEventPricing";
import { PUBLIC_LOCATION_LIST } from "../shared/publicLocations";
import { PRIVATE_EVENT_FORMAT_PRICE_NOTE, PRIVATE_EVENT_CUSTOM_SCOPE_NOTE } from "../shared/privateEventExperience";
import { seoRenderMiddleware } from "./seoRenderer";
import { APY_SYSTEM_PROMPT } from "./chatbot-knowledge";

const mocks = vi.hoisted(() => ({ seo: vi.fn() }));
vi.mock("@/hooks/useSeoMeta", () => ({ useSeoMeta: mocks.seo }));
vi.mock("@/hooks/useMetaPixel", () => ({ useMetaPixel: () => ({ track: vi.fn() }) }));
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));
vi.mock("@/components/ChatbotWidget", () => ({ default: () => null }));
vi.mock("@/components/ScrollToTop", () => ({ default: () => null }));
vi.mock("@/lib/trpc", () => ({
  trpc: { privateEvents: { submitInquiry: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) } } },
}));
import Corporate from "../client/src/pages/Corporate";
import PrivatePuppyYogaEvents from "../client/src/pages/PrivatePuppyYogaEvents";
import PrivateEventQuote from "../client/src/pages/PrivateEventQuote";
import Kitchener from "../client/src/pages/Kitchener";
import Hamilton from "../client/src/pages/Hamilton";
import Oakville from "../client/src/pages/Oakville";
import Guelph from "../client/src/pages/Guelph";

const PRIVATE_ROUTES = ["/corporate-puppy-yoga", "/private-puppy-yoga-events", "/private-events/quote"];
const CITY_ROUTES = ["/puppy-yoga-kitchener", "/puppy-yoga-hamilton", "/puppy-yoga-oakville", "/puppy-yoga-guelph"];
const PRIVATE_PAGES = [
  ["/corporate-puppy-yoga", Corporate],
  ["/private-puppy-yoga-events", PrivatePuppyYogaEvents],
  ["/private-events/quote", PrivateEventQuote],
] as const;
const CITY_PAGES = [
  ["/puppy-yoga-kitchener", Kitchener],
  ["/puppy-yoga-hamilton", Hamilton],
  ["/puppy-yoga-oakville", Oakville],
  ["/puppy-yoga-guelph", Guelph],
] as const;
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const text = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const bandLabels = [privateEventBandLabel("classic"), privateEventBandLabel("signature"), privateEventBandLabel("luxury")];

function render(page: ComponentType, route: string) {
  mocks.seo.mockClear();
  const html = renderToStaticMarkup(createElement(Router, { ssrPath: route }, createElement(page)));
  return { html, metadata: mocks.seo.mock.calls.at(-1)?.[0] };
}

function crawl(route: string) {
  let html = "";
  const response = {
    status: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    end: vi.fn((body: string) => { html = body; }),
  };
  const next = vi.fn();
  seoRenderMiddleware({ method: "GET", path: route, query: {}, headers: { "user-agent": "Googlebot" } } as Request, response as unknown as Response, next);
  expect(next).not.toHaveBeenCalled();
  expect(response.status).toHaveBeenCalledWith(200);
  const schemas = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(match => JSON.parse(match[1]));
  return { html, schemas };
}

function expectNoOldPrice(content: string) {
  expect(content).not.toMatch(/\$1,?200\b|"(?:price|minPrice|maxPrice)"\s*:\s*"?1200\b/);
  expect(content).not.toMatch(/\$1,500[–-]\$2,250|\$2,500\+/);
}

function expectBands(content: string) {
  for (const band of bandLabels) expect(content).toContain(band);
}

describe("approved private-event public pricing", () => {
  it("uses the explicitly approved test bands rather than silently changing their endpoints", () => {
    expect(PRIVATE_EVENT_PACKAGE_BANDS).toMatchObject({
      classic: { min: 1500, max: 1750 },
      signature: { min: 2000, max: 2250 },
      luxury: { min: 2500, max: 3500 },
    });
    expect(bandLabels).toEqual(["$1,500-$1,750 + HST", "$2,000-$2,250 + HST", "$2,500-$3,500 + HST"]);
  });

  it.each(PRIVATE_PAGES)("%s SSR visibly renders all bands, tax and quote caveats", (route, page) => {
    const { html } = render(page, route);
    const visible = text(html);
    expectBands(visible);
    expectNoOldPrice(html);
    expect(visible).toContain(PRIVATE_EVENT_PRICE_NOTE);
    expect(visible).toMatch(/(?:21 or more|21\+|above 20)/);
    expect(html).toContain(route === "/private-events/quote" ? 'href="#quote-form"' : 'href="/private-events/quote"');
  });

  it("corporate cards align to package scope rather than conflicting venue/group-capacity products", () => {
    const { html } = render(Corporate, "/corporate-puppy-yoga");
    const visible = text(html);
    for (const band of Object.values(PRIVATE_EVENT_PACKAGE_BANDS)) expect(visible).toContain(band.name);
    expect(visible).toContain("Core studio experience · Up to 20 guests");
    expect(visible).toContain("Professional photography · Up to 20 guests");
    expect(visible).toContain("professional photography and an enhanced setup");
    expect(visible).not.toMatch(/In-Studio Private Event|On-Site Corporate Event|Teams of 6–25|Teams of 15–50/);
    expect(html).toContain("/manus-storage/apy_corporate_hero_202ea280.jpg");
    expect(visible).toContain("Team Wellness That");
    expect(visible).toContain("Choose Your Format");
  });

  it("private page does not promise public-class refreshments as a private default", () => {
    const { html } = render(PrivatePuppyYogaEvents, "/private-puppy-yoga-events");
    expect(text(html)).not.toContain("Complimentary refreshments");
    expect(text(html)).toContain("larger groups quoted separately");
  });

  it.each(CITY_PAGES)("%s SSR contains no obsolete private starting price", (route, page) => {
    const { html } = render(page, route);
    expectNoOldPrice(html);
    expect(html).toContain('href="/private-events/quote"');
    if (route !== "/puppy-yoga-guelph") {
      expect(text(html)).toContain("Private events starting at $1,500 + HST");
      expect(text(html)).toContain(PRIVATE_EVENT_PRICE_NOTE);
      expect(text(html)).toContain("Complimentary refreshments");
    } else {
      expect(html).toContain("375 Southgate Drive, Unit 2, Guelph, Ontario");
    }
  });

  it.each(PRIVATE_PAGES.slice(0, 2))("%s React metadata starts at $1,500 plus HST and matches crawler description", (route, page) => {
    const { metadata } = render(page, route);
    expect(metadata.canonical).toBe(`https://afropuppyyoga.ca${route}`);
    expect(metadata.description).toContain("$1,500 + HST");
    expect(crawl(route).html).toContain(`name="description" content="${metadata.description}"`);
  });

  it.each([...PRIVATE_ROUTES, ...CITY_ROUTES])("%s crawler HTML has no old private-price claim", route => {
    expectNoOldPrice(crawl(route).html);
  });

  it.each(PRIVATE_ROUTES)("%s crawler metadata, FAQ and offer express approved bands and tax-exclusive quote rules", route => {
    const { html, schemas } = crawl(route);
    expectBands(html);
    expect(html).toMatch(/name="description" content="[^"]*\$1,500 \+ HST/);
    expect(html).toMatch(/property="og:description" content="[^"]*\$1,500 \+ HST/);
    expect(html).toContain(`<link rel="canonical" href="https://afropuppyyoga.ca${route}"`);
    const service = schemas.find(schema => schema["@type"] === "Service");
    expect(service.offers).toMatchObject({
      "@type": "Offer",
      price: "1500",
      priceCurrency: "CAD",
      description: `${PRIVATE_EVENT_PRICE_NOTE} ${PRIVATE_EVENT_FORMAT_PRICE_NOTE} ${PRIVATE_EVENT_CUSTOM_SCOPE_NOTE}`,
      priceSpecification: {
        "@type": "PriceSpecification",
        minPrice: 1500,
        maxPrice: 1750,
        priceCurrency: "CAD",
        valueAddedTaxIncluded: false,
      },
    });
    expect(service.offers).not.toHaveProperty("availability");
    const faq = schemas.find(schema => schema["@type"] === "FAQPage");
    const priceAnswer = faq.mainEntity.find((question: { name: string }) => /cost/i.test(question.name)).acceptedAnswer.text;
    expectBands(priceAnswer);
    expect(priceAnswer).toContain(PRIVATE_EVENT_PRICE_NOTE);
    expect(priceAnswer).toContain("groups of 21 or more require a custom quote");
    const venueAnswer = faq.mainEntity.find((question: { name: string }) => /office|venue|Where/i.test(question.name)).acceptedAnswer.text;
    expect(venueAnswer).toContain(PRIVATE_EVENT_TRAVEL_NOTE);
    const inclusionAnswer = faq.mainEntity.find((question: { name: string }) => /included/i.test(question.name)).acceptedAnswer.text;
    expect(inclusionAnswer).toContain("Signature adds professional photography and an enhanced setup");
    expect(inclusionAnswer).toContain("inclusions depend on the selected package or confirmed quote");
    expect(html).toContain(PUBLIC_LOCATION_LIST);
    expect(html).toContain("subject to availability");
    expect(html).not.toMatch(/"startDate"|"@type":"Event"|"@type":"LocalBusiness","name":"AfroPuppyYoga.*Guelph/);
  });

  it("owned public source uses shared bands and contains no legacy public pricing or capacity promises", () => {
    for (const path of ["client/src/pages/Corporate.tsx", "client/src/pages/PrivatePuppyYogaEvents.tsx", "client/src/components/LocationPage.tsx", "server/seoRenderer.ts", "server/chatbot-knowledge.ts"]) {
      const source = read(path);
      expectNoOldPrice(source);
      expect(source, path).toContain("privateEventPricing");
      expect(source, path).toContain("PRIVATE_EVENT_PRICE_NOTE");
      expect(source, path).not.toMatch(/larger group capacity|Teams of 6–25|Teams of 15–50\+|Signature at 10–25/);
    }
    const locationSource = read("client/src/components/LocationPage.tsx");
    expect(locationSource).toContain("valueAddedTaxIncluded: false");
    expect(locationSource).toContain('"@type": "Service"');
    expect(locationSource).toContain('"@type": "FAQPage"');
    expect(locationSource).toContain("isPrivateEventPage ? privateEventSchema : schema");
  });

  it("chatbot follows bands, confirmed scope and separate travel without corporate uplift or optimality claims", () => {
    expectNoOldPrice(APY_SYSTEM_PROMPT);
    expectBands(APY_SYSTEM_PROMPT);
    expect(APY_SYSTEM_PROMPT).toContain(PRIVATE_EVENT_PRICE_NOTE);
    expect(APY_SYSTEM_PROMPT).toContain(PRIVATE_EVENT_TRAVEL_NOTE);
    expect(APY_SYSTEM_PROMPT).toContain(PRIVATE_EVENT_CUSTOM_NOTE);
    expect(APY_SYSTEM_PROMPT).toContain("Do not invent fixed travel fees or apply an automatic corporate uplift");
    expect(APY_SYSTEM_PROMPT).toContain("not proven optimal prices or margin guarantees");
    expect(APY_SYSTEM_PROMPT).toContain("Groups of 21 or more require a custom quote");
  });

  it("sitemap refreshes changed public routes without altering unrelated careers and ethics dates", () => {
    const sitemap = read("client/public/sitemap.xml");
    for (const route of [...PRIVATE_ROUTES, ...CITY_ROUTES]) {
      expect(sitemap).toContain(`<loc>https://afropuppyyoga.ca${route}</loc>\n    <lastmod>2026-11-04</lastmod>`);
    }
    for (const route of ["/careers", "/ethics"]) {
      expect(sitemap).toContain(`<loc>https://afropuppyyoga.ca${route}</loc>\n    <lastmod>2026-07-06</lastmod>`);
    }
  });
});
