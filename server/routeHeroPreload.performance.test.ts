import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { PRIMARY_HERO_IMAGE } from "../shared/heroImage";
import { publicPortraitUrl } from "../shared/publicPortraits";

const html = readFileSync(new URL("../client/index.html", import.meta.url), "utf8");
const tag = html.match(/<link rel="preload" as="image"[^>]+id="route-hero-preload"[^>]*>/)?.[0] ?? "";
const script = html.match(/<script>\s*const heroPreload[\s\S]*?<\/script>/)?.[0]
  .replace(/^<script>|<\/script>$/g, "") ?? "";
const quoteImage = publicPortraitUrl("/manus-storage/apy_portrait_two_goldens_oct13_44cd44f3.jpg");

function preloadFor(pathname: string) {
  const link = { href: tag.match(/href="([^"]+)"/)?.[1], media: "not all" };
  const classes: string[] = [];
  runInNewContext(script, {
    window: { location: { pathname } },
    document: { getElementById: () => link, documentElement: { classList: { add: (name: string) => classes.push(name) } } },
  });
  return { link, classes };
}

describe("route-specific hero preloads", () => {
  it("starts inactive so unrelated pages do not fetch the homepage portrait", () => {
    expect(tag).toContain('media="not all"');
    expect(tag).toContain('fetchpriority="high"');
    for (const route of ["/privacy", "/puppy-yoga-hamilton", "/private-events/quote/other"]) {
      expect(preloadFor(route).link.media).toBe("not all");
    }
  });
  it("preloads the same approved Chow image on home and Guelph", () => {
    for (const route of ["/", "/puppy-yoga-guelph"]) {
      expect(preloadFor(route).link).toEqual({ href: PRIMARY_HERO_IMAGE, media: "all" });
    }
    expect(preloadFor("/").classes).toContain("home-pending");
    expect(preloadFor("/puppy-yoga-guelph").classes).toEqual([]);
  });
  it("preloads the quote experience's existing two-puppy photo instead of the Chow photo", () => {
    expect(preloadFor("/private-events/quote").link).toEqual({ href: quoteImage, media: "all" });
    const experience = readFileSync(new URL("../client/src/components/PrivateEventExperience.tsx", import.meta.url), "utf8");
    expect(experience).toContain('puppy_yoga: "/manus-storage/apy_portrait_two_goldens_oct13_44cd44f3.jpg"');
    expect(experience).toContain("onError={recoverPublicPortrait}");
  });
});
