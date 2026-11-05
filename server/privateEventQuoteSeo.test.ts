import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DomUtils, parseDocument } from "htmlparser2";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { estimatePrivateEventPackage } from "@shared/privateEventPricing";

// Exercise both visible states without sending an inquiry or touching a database.
const state = vi.hoisted(() => ({ submitted: false }));
vi.mock("react", async importOriginal => {
  const react = await importOriginal<typeof import("react")>();
  return {
    ...react,
    useState: (initial: unknown) => react.useState(initial === "form" && state.submitted ? "submitted" : initial),
  };
});
vi.mock("@/lib/trpc", () => ({
  trpc: { privateEvents: { submitInquiry: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) } } },
}));
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));
import PrivateEventQuote from "../client/src/pages/PrivateEventQuote";

function render() {
  const html = renderToStaticMarkup(createElement(PrivateEventQuote));
  const document = parseDocument(html);
  const visible = DomUtils.textContent(document).replace(/\s+/g, " ").trim();
  return { html, document, visible };
}

describe("private event quote clarity", () => {
  beforeEach(() => { state.submitted = false; });

  it("renders an explicit Ontario private and corporate package heading and preserves the experience choices", () => {
    const { document, visible } = render();
    const heading = DomUtils.getElementById("private-event-packages-title", document.children);
    expect(heading && DomUtils.textContent(heading)).toMatch(/Private & Corporate Puppy Yoga Packages in Ontario/);
    expect(visible).toContain("Choose Your Experience");
    expect(visible).toContain("Puppy Yoga");
    expect(visible).toContain("Puppy Play & Wellness Lounge");
  });

  it("qualifies the Luxury price where it appears and retains standard and custom quote boundaries", () => {
    const { document, visible } = render();
    const luxuryBadge = DomUtils.findOne(node => node.type === "tag" && node.name === "div" && DomUtils.textContent(node).includes("Luxury Experience") && !DomUtils.textContent(node).includes("Classic Experience"), document.children);
    expect(luxuryBadge).not.toBeNull();
    const luxury = DomUtils.textContent(luxuryBadge!);
    expect(luxury).toContain("$2,500-$3,500 + HST");
    expect(luxury).toContain("standard 60-minute studio puppy yoga for up to 20 guests");
    expect(luxury).toContain("Groups of 21 or more and other custom formats require a quote for the full event; it may exceed this range.");
    for (const band of ["$1,500-$1,750 + HST", "$2,000-$2,250 + HST", "$2,500-$3,500 + HST"]) expect(visible).toContain(band);
    expect(estimatePrivateEventPackage({ packageType: "luxury", guests: 20 }).requiresCustomQuote).toBe(false);
    expect(estimatePrivateEventPackage({ packageType: "luxury", guests: 21 }).requiresCustomQuote).toBe(true);
  });

  it("shows consistent non-timed follow-up language in the form", () => {
    const { visible, html } = render();
    expect(visible.match(/We'll follow up with a formal quote and availability\./g)).toHaveLength(3);
    expect(visible).not.toMatch(/within\s+24(?:\s*[-–]\s*48)?\s*(?:hours|hrs)/i);
    expect(html.match(/<input\b[^>]*type="date"/g)).toHaveLength(2);
    expect(html).toMatch(/<button\b[^>]*type="submit"[^>]*disabled/);
  });

  it("shows non-timed follow-up language after successful submission", () => {
    state.submitted = true;
    const { visible } = render();
    expect(visible).toContain("Inquiry Received!");
    expect(visible).toContain("We've received your event details and will follow up with a formal quote and availability.");
    expect(visible).toContain("We follow up with a formal quote and availability");
    expect(visible).not.toMatch(/within\s+24(?:\s*[-–]\s*48)?\s*(?:hours|hrs)/i);
  });
});
