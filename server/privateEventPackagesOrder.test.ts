import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trpc", () => ({
  trpc: { privateEvents: { submitInquiry: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) } } },
}));
import PrivateEventQuote from "../client/src/pages/PrivateEventQuote";

const source = readFileSync(new URL("../client/src/pages/PrivateEventQuote.tsx", import.meta.url), "utf8");
const render = () => renderToStaticMarkup(createElement(PrivateEventQuote));
const text = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

describe("same-page private-event packages before the quote form", () => {
  it("renders all three packages before the editable quote form in one main landmark", () => {
    const html = render();
    const packagePosition = html.indexOf('id="private-event-packages"');
    const formPosition = html.indexOf('id="quote-form"');
    expect(packagePosition).toBeGreaterThan(-1);
    expect(formPosition).toBeGreaterThan(packagePosition);
    for (const name of ["Classic Experience", "Signature Experience", "Luxury Experience"]) {
      const position = html.indexOf(name);
      expect(position).toBeGreaterThan(packagePosition);
      expect(position).toBeLessThan(formPosition);
    }
    expect(html.match(/<main(?:\s|>)/g)).toHaveLength(1);
    expect(html.indexOf("<main>")).toBeLessThan(packagePosition);
    expect(html.indexOf("</main>")).toBeGreaterThan(formPosition);
    expect(html.match(/<form\b/g)).toHaveLength(1);
  });

  it("uses one page heading and keeps the quote heading after package comparison", () => {
    const html = render();
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).toMatch(/<h1\b[^>]*id="private-event-packages-title"/);
    expect(html).toMatch(/<h2\b[^>]*id="private-event-quote-title"/);
    expect(text(html)).toContain("Choose Your Experience");
    expect(text(html)).toContain("Get an Instant Quote");
    expect(html.indexOf('id="private-event-packages-title"')).toBeLessThan(html.indexOf('id="private-event-quote-title"'));
  });

  it("preserves advertised prices, inclusions, Most Popular label and travel/session guidance", () => {
    const html = render();
    const packages = text(html.slice(html.indexOf('id="private-event-packages"'), html.indexOf('id="private-event-quote-title"')));
    for (const value of ["$1,200-$1,500", "$1,500-$2,250", "$2,500+", "Most Popular", "Professional event photography", "Basic mats included", "Professional videography options", "Travel fees apply for offsite events.", "Second session required for 21+ guests."]) {
      expect(packages).toContain(value);
    }
  });

  it("keeps the original same-page corporate quote link without custom scrollIntoView behavior", () => {
    const html = render();
    expect(html).toMatch(/<a\b[^>]*href="#quote-form"[^>]*>\s*Request a Corporate Quote\s*<\/a>/);
    expect(source).not.toContain("scrollIntoView");
    expect(source).toContain('id="quote-form"');
    expect(source).toContain('className="min-w-0 scroll-mt-28"');
  });

  it("retains the event/contact fields, package controls and disabled untouched inquiry submission", () => {
    const html = render();
    const quote = html.slice(html.indexOf('id="quote-form"'));
    for (const value of ["Event Type", "Number of Guests", "Event Location", "Full Name", "Email Address", "Phone Number", "Additional Notes", "Send My Inquiry", "Canadian mobile or local number required."]) expect(text(quote)).toContain(value);
    expect(quote).toContain('type="email"');
    expect(quote).toContain('type="tel"');
    expect(quote).toContain('type="number"');
    expect(quote).toContain('aria-pressed="true"');
    expect(quote).toMatch(/<button\b[^>]*type="submit"[^>]*disabled/);
    expect(source).toContain("submitInquiry.mutate({");
    expect(source).toContain("normalizeCanadianPhoneNumber(phone)");
  });
});
