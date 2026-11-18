import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Hero from "../client/src/components/sections/Hero";

describe("founder network logos", () => {
  it("includes all three requested logos with one accessible name each", () => {
    const html = renderToStaticMarkup(createElement(Hero));
    for (const [name, path] of [
      ["Black Founders Network", "/manus-storage/bfn_b4c7db4c.webp"],
      ["Black Entrepreneurship Alliance", "/manus-storage/bea-white_6e169b46.webp"],
      ["Startup Canada", "/manus-storage/startup-canada_c4227197.webp"],
    ]) {
      expect(html.split(`alt="${name}"`)).toHaveLength(2);
      expect(html.split(`src="${path}"`)).toHaveLength(3);
    }
    expect(html).toContain("background-color:#191919");
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('alt="Cyclone Spin Studio"');
    expect(html).toContain('alt="Nutram Pet Foods"');
    expect(html).toContain('alt="Little Scholars Child Care"');
  });
});
