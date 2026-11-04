import { readFileSync } from "node:fs";
import postcss from "postcss";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../client/src/index.css", import.meta.url), "utf8");
const spacing = css.slice(css.indexOf("/* Existing public design: tighter vertical rhythm"));
const stylesheet = postcss.parse(spacing);
const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

// Source guards protect unchanged contracts; measured layout evidence lives outside the repo.
describe("existing public design spacing", () => {
  it("changes only vertical whitespace and anchor clearance, never visibility or geometry", () => {
    expect(spacing).toContain(".apy-homepage main > [data-home-deferred-section] > section");
    const allowed = new Set(["padding-block", "padding-top", "padding-bottom", "margin-top", "margin-bottom", "row-gap", "scroll-margin-top"]);
    stylesheet.walkDecls(decl => expect(allowed.has(decl.prop), decl.toString()).toBe(true));
    expect(spacing).not.toMatch(/!important|overflow|display\s*:|font-size|line-height|height\s*:|aspect-ratio|object-fit/);
  });

  it("scopes every override to public homepage, footer, city or private-event elements", () => {
    stylesheet.walkRules(rule => {
      for (const selector of rule.selectors) {
        expect(selector).toMatch(/^(\.apy-homepage |\.apy-public-footer|\.apy-page > (section|main > section)\.apy-section|#private-event-(experiences|packages))/);
      }
    });
  });

  it("retains generous fixed-header clearance and visible anchors", () => {
    expect(spacing).toContain("padding-top: 6rem;");
    expect(spacing).toContain("padding-top: 7rem;");
    expect(spacing).toContain("scroll-margin-top: 5rem;");
    expect(spacing).toContain("scroll-margin-top: 6rem;");
    expect(spacing).toContain(".apy-homepage #home > .container { row-gap: 1rem; }");
    expect(spacing).toContain(".container:has(#quote-form)");
    expect(source("client/src/components/sections/Hero.tsx")).toContain('min-h-12');
    expect(source("client/src/pages/PrivateEventQuote.tsx")).toContain('scroll-mt-28');
  });

  it("does not replace deferred sections with fixed-height or clipped content", () => {
    expect(source("client/src/components/DeferredSection.tsx")).toContain('style={shouldRender ? undefined : { minHeight }}');
    const home = source("client/src/pages/Home.tsx");
    for (const section of ["Experience", "LumaCalendar", "Memberships", "About", "OurStory", "PrivateEvents", "Gallery", "InstagramFeed", "Reviews", "OurValues", "LoyaltyProgram", "GiftCards", "EthicalStandards", "FAQ", "Contact"]) {
      expect(home).toContain(`<${section} />`);
    }
    expect(home).not.toMatch(/QuestionOfTheDay|question.of.the.day/i);
  });

  it("preserves the gallery, image framing, marquee cards and actual calendar heights", () => {
    const gallery = source("client/src/components/sections/Gallery.tsx");
    expect(gallery).toContain("const INITIAL_COUNT = 12;");
    expect(gallery).toContain("setVisibleCount(c => c + 12)");
    expect(gallery).toContain('w-full h-auto block object-cover object-top');
    expect(source("client/src/components/sections/Hero.tsx")).toContain('aspect-[3/4] lg:aspect-[4/5]');
    expect(css).toContain("width: 176px;");
    const calendar = source("client/src/components/sections/LumaCalendar.tsx");
    expect(calendar).toContain('height="500"');
    expect(calendar).toContain('md:!h-[600px]');
  });
});
