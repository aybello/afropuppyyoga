import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// These page tests exercise real city configs and templates without starting the app or a database.
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));
vi.mock("@/components/ChatbotWidget", () => ({ default: () => null }));
vi.mock("@/components/ScrollToTop", () => ({ default: () => null }));
vi.mock("wouter", () => ({ Link: (props: Record<string, unknown>) => createElement("a", props) }));

import Kitchener from "../client/src/pages/Kitchener";
import Hamilton from "../client/src/pages/Hamilton";
import Oakville from "../client/src/pages/Oakville";
import Guelph from "../client/src/pages/Guelph";
import PrivateEvents from "../client/src/pages/PrivatePuppyYogaEvents";

const render = (page: typeof Kitchener) => renderToStaticMarkup(createElement(page));
const iframeUrl = (html: string) => {
  const iframe = html.match(/<iframe\b[^>]*>/)?.[0];
  expect(iframe).toBeDefined();
  const src = iframe!.match(/\bsrc="([^"]+)"/)?.[1];
  expect(src).toBeDefined();
  return new URL(src!.replaceAll("&amp;", "&"));
};

describe("public city booking guidance", () => {
  it.each([
    ["Kitchener", Kitchener, "kitchener"],
    ["Hamilton", Hamilton, "hamilton"],
    ["Oakville", Oakville, "oakville"],
  ] as const)("labels %s's calendar honestly and preserves its existing embed and tag", (city, page, tag) => {
    const html = render(page);
    const url = iframeUrl(html);
    expect(url.origin + url.pathname).toBe("https://lu.ma/embed/calendar/cal-Z474jeIbvUXskHE/events");
    expect(url.searchParams.get("tag")).toBe(tag);
    expect(html).toContain("Shared AfroPuppyYoga calendar on Luma");
    expect(html).toContain(`Select a ${city} event and check its date and venue before booking.`);
    expect(html).toContain("If the calendar does not display, open it on Luma");
    expect(html).toContain('href="https://lu.ma/afropuppyyoga"');
    expect(html).not.toContain(`View All ${city} Classes`);
  });

  it("shows only the confirmed local preparation tips beside the city calendar", () => {
    const kitchener = render(Kitchener);
    const oakville = render(Oakville);
    const hamilton = render(Hamilton);
    expect(kitchener).toContain("For Kitchener, please bring your own yoga mat.");
    expect(kitchener).not.toContain("For Oakville, bring a yoga mat.");
    expect(oakville).toContain("For Oakville, bring a yoga mat. We recommend arriving 10 minutes early.");
    expect(oakville).not.toContain("For Kitchener, please bring your own yoga mat.");
    expect(hamilton).not.toContain("For Kitchener, please bring your own yoga mat.");
    expect(hamilton).not.toContain("For Oakville, bring a yoga mat.");
  });

  it("keeps Colibri as Hamilton's main venue and Something New as collaboration-only", () => {
    const html = render(Hamilton);
    expect(html).toContain("Colibri Studio (Main Studio)");
    expect(html).toContain("2751 Barton Street East");
    expect(html).toContain("Something New (Collaboration Location)");
    expect(html).toContain("selected collaboration events at Something New");
  });

  it("keeps Guelph's calendar unfiltered, shared, and its event venue non-permanent", () => {
    const html = render(Guelph);
    const url = iframeUrl(html);
    expect(url.origin + url.pathname).toBe("https://lu.ma/embed/calendar/cal-Z474jeIbvUXskHE/events");
    expect(url.searchParams.has("tag")).toBe(false);
    expect(html).toContain("All AfroPuppyYoga events on Luma");
    expect(html).toContain("Choose a Guelph");
    expect(html).toContain("class and check its date and venue before booking.");
    expect(html).toContain("Current Guelph event venue");
    expect(html).toContain("Emotion Dance Company");
    expect(html).toContain("375 Southgate Drive, Unit 2, Guelph, Ontario");
    expect(html).toContain('href="https://lu.ma/afropuppyyoga"');
    expect(html).not.toContain("For Oakville, bring a yoga mat.");
    expect(html).not.toContain("For Kitchener, please bring your own yoga mat.");
  });

  it("does not introduce a calendar or city preparation tip on the private-events template", () => {
    const html = render(PrivateEvents);
    expect(html).not.toContain("cal-Z474jeIbvUXskHE");
    expect(html).not.toContain("For Kitchener, please bring your own yoga mat.");
    expect(html).not.toContain("For Oakville, bring a yoga mat.");
  });
});
