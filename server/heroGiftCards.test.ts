import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Hero from "../client/src/components/sections/Hero";
import { BOOK_URL } from "../client/src/const";

describe("homepage gift-card action", () => {
  it("places the gift-card purchase link beside the existing hero actions", () => {
    const html = renderToStaticMarkup(createElement(Hero));
    const gift = html.match(/<a\b[^>]*href="https:\/\/luma\.com\/15iajebr"[^>]*>Gift Cards<\/a>/)?.[0];
    expect(gift).toBeDefined();
    expect(gift).toContain('target="_blank"');
    expect(gift).toContain('rel="noopener noreferrer"');
    expect(gift).toContain("min-h-12");
    expect(gift).toContain("focus-visible:outline-2");
    expect(html.indexOf("Private Events</a>")).toBeLessThan(html.indexOf(gift!));
    expect(html.indexOf(gift!)).toBeLessThan(html.indexOf("546 five-star reviews"));
    expect(html).toContain(`href="${BOOK_URL}"`);
    expect(html).toContain('href="/private-events/quote"');
    expect(html).toContain("Memberships</a>");
  });
});
