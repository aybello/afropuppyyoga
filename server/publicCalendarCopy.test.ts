import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LUMA_CALENDAR_EMBED_URL } from "../shared/lumaCalendarEmbed";

const mocks = vi.hoisted(() => ({ states: [] as boolean[], track: vi.fn(), cta: vi.fn(), attribution: vi.fn() }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useState: (initial: unknown) => [mocks.states.shift() ?? initial, vi.fn()] };
});
vi.mock("../client/src/hooks/useAnalytics", () => ({ trackCTAClick: mocks.cta }));
vi.mock("../client/src/hooks/useMetaPixel", () => ({ useMetaPixel: () => ({ track: mocks.track }) }));
vi.mock("../client/src/lib/lumaAttribution", () => ({ appendAttributionToLumaUrl: mocks.attribution }));
import LumaCalendar from "../client/src/components/sections/LumaCalendar";

function render(loaded = false, near = false, requested = false) {
  mocks.states = [loaded, near, requested];
  return renderToStaticMarkup(createElement(LumaCalendar));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.attribution.mockImplementation((url: string) => `${url}&utm_source=calendar-test`);
});

describe("restored public Luma calendar", () => {
  it("keeps the classes anchor and direct calendar link before loading the iframe", () => {
    const html = render();
    expect(html).toContain('id="classes"');
    expect(html).toContain("Upcoming");
    expect(html).toContain("Open Full Calendar");
    expect(html).toContain("Show upcoming classes");
    expect(html).not.toContain("<iframe");
    expect(html).toContain('href="https://luma.com/AfroPuppyYoga?k=c&amp;utm_source=calendar-test"');
    expect(mocks.track).not.toHaveBeenCalled();
    expect(mocks.cta).not.toHaveBeenCalled();
  });

  it.each([[true, false], [false, true]])("renders the original live embed when near=%s or requested=%s", (near, requested) => {
    const html = render(false, near, requested);
    expect(html).toContain("<iframe");
    expect(html).toContain('title="AfroPuppyYoga Upcoming Classes"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('width="100%"');
    expect(html).toContain('height="500"');
    expect(html).toContain("md:!h-[600px]");
    expect(html).toContain("cal-Z474jeIbvUXskHE/events?theme=light&amp;lt=light&amp;utm_source=calendar-test");
    expect(mocks.attribution).toHaveBeenCalledWith(LUMA_CALENDAR_EMBED_URL);
    expect(html).toContain("Loading upcoming classes");
    expect(html).not.toContain("Book this class");
  });

  it("removes its loading skeleton once the iframe load state is complete", () => {
    const html = render(true, true);
    expect(html).toContain("<iframe");
    expect(html).toContain("opacity:1");
    expect(html).not.toContain("Loading upcoming classes");
  });

  it("keeps admission and optional mat rental separate without hardcoded ticket prices", () => {
    const html = render(true, true);
    expect(html).toContain("Open a class to see its admission ticket options and total at checkout.");
    expect(html).toContain("Mat rental is optional and priced separately from admission.");
    expect(html).toContain("HST is calculated at checkout");
    expect(html).not.toContain("Admission from");
    expect(html).not.toMatch(/CA\$\d|\$55|Instant confirmation/);
  });
});
