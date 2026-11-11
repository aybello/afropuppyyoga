import { readFileSync } from "node:fs";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { renderClientSeoHead } from "./clientSeoRenderer";
import { getPublicSeoSnapshot } from "./seoRenderer";

const mocks = vi.hoisted(() => ({ seo: vi.fn() }));
vi.mock("@/hooks/useSeoMeta", () => ({ useSeoMeta: mocks.seo }));
vi.mock("@/hooks/useMetaPixel", () => ({ useMetaPixel: () => ({ track: vi.fn() }) }));
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));
vi.mock("@/components/ChatbotWidget", () => ({ default: () => null }));
vi.mock("@/components/ScrollToTop", () => ({ default: () => null }));
vi.mock("@/lib/trpc", () => ({ trpc: { privateEvents: { submitInquiry: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) } } } }));
import Oakville from "../client/src/pages/Oakville";
import Kitchener from "../client/src/pages/Kitchener";
import Hamilton from "../client/src/pages/Hamilton";
import Guelph from "../client/src/pages/Guelph";
import Corporate from "../client/src/pages/Corporate";
import PrivatePuppyYogaEvents from "../client/src/pages/PrivatePuppyYogaEvents";
import PrivateEventQuote from "../client/src/pages/PrivateEventQuote";

const pages: [string, ComponentType][] = [
  ["/puppy-yoga-oakville", Oakville],
  ["/corporate-puppy-yoga", Corporate],
  ["/private-puppy-yoga-events", PrivatePuppyYogaEvents],
  ["/private-events/quote", PrivateEventQuote],
];
const template = readFileSync(new URL("../client/index.html", import.meta.url), "utf8");
const tagContent = (html: string, selector: string) => html.match(new RegExp(`<meta ${selector} content="([^"]*)"`, "i"))?.[1];
function renderPage(path: string, page: ComponentType) {
  mocks.seo.mockClear();
  const html = renderToStaticMarkup(createElement(Router, { ssrPath: path }, createElement(page)));
  return { html, metadata: mocks.seo.mock.calls.at(-1)?.[0] };
}

describe("priority page search and social metadata", () => {
  it.each(pages)("aligns %s React, initial HTML and crawler metadata", (path, page) => {
    const { metadata } = renderPage(path, page);
    const crawler = getPublicSeoSnapshot(path)!;
    const initial = renderClientSeoHead(template, path);
    expect(metadata).toBeDefined();
    expect(metadata.canonical).toBe(`https://afropuppyyoga.ca${path}`);
    expect(metadata.description).toContain("546 five-star reviews");
    for (const html of [crawler, initial]) {
      expect(html.match(/<title>([^<]+)<\/title>/i)?.[1]).toBe(metadata.title);
      expect(tagContent(html, 'name="description"')).toBe(metadata.description);
      expect(tagContent(html, 'property="og:title"')).toBe(metadata.ogTitle ?? metadata.title);
      expect(tagContent(html, 'property="og:description"')).toBe(metadata.ogDescription ?? metadata.description);
      expect(tagContent(html, 'name="twitter:title"')).toBe(metadata.ogTitle ?? metadata.title);
      expect(tagContent(html, 'name="twitter:description"')).toBe(metadata.ogDescription ?? metadata.description);
      expect(tagContent(html, 'property="og:image"')).toBe(metadata.ogImage);
      expect(tagContent(html, 'name="twitter:image"')).toBe(metadata.ogImage);
      expect(html).toContain(`<link rel="canonical" href="${metadata.canonical}"`);
    }
  });
  it.each(pages.slice(1))("keeps %s price scope explicit in both search copy and visible content", (path, page) => {
    const { html, metadata } = renderPage(path, page);
    expect(metadata.description).toContain("60-minute studio");
    expect(metadata.description).toContain("up to 20 guests");
    expect(metadata.description).toContain("$1,500 + HST");
    expect(metadata.description).toContain("custom quote");
    expect(html).toContain("$1,500");
    expect(html).toContain("$3,500");
  });
  it.each([
    ["/puppy-yoga-kitchener", Kitchener],
    ["/puppy-yoga-hamilton", Hamilton],
    ["/puppy-yoga-guelph", Guelph],
  ] as [string, ComponentType][])("keeps social images consistent for %s", (path, page) => {
    const { metadata } = renderPage(path, page);
    for (const html of [getPublicSeoSnapshot(path)!, renderClientSeoHead(template, path)]) {
      expect(tagContent(html, 'property="og:image"')).toBe(metadata.ogImage);
      expect(tagContent(html, 'name="twitter:image"')).toBe(metadata.ogImage);
    }
  });
  it("removes unsupported Oakville number-one claims and stale location count", () => {
    const { html } = renderPage("/puppy-yoga-oakville", Oakville);
    const crawler = getPublicSeoSnapshot("/puppy-yoga-oakville")!;
    expect(html).not.toMatch(/Ontario.s #1/i);
    expect(crawler).not.toMatch(/third Ontario location/i);
    expect(html).toContain("1670 North Service Rd E");
    expect(html).toContain("40 minutes of guided yoga");
    expect(html).toContain("20 minutes of puppy play");
  });
});
