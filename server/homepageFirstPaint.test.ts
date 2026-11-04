import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");
const indexSource = readFileSync(new URL("../client/index.html", import.meta.url), "utf8");
const heroSource = readFileSync(new URL("../client/src/components/sections/Hero.tsx", import.meta.url), "utf8");

describe("homepage first paint", () => {
  it("does not show the generic spinner while the Home route loads", () => {
    expect(appSource).toContain('location === "/" ? <HomePageLoader /> : <PageLoader />');
    expect(appSource).toContain('className="min-h-screen bg-transparent"');
  });

  it("paints an ivory booking shell without a dark intermediate screen before the Home route is ready", () => {
    expect(indexSource).toContain('document.documentElement.classList.add("home-pending")');
    expect(indexSource).toContain("html.home-pending #root");
    expect(indexSource).toContain('style id="homepage-light-first-paint"');
    expect(indexSource).toContain('id="home-first-paint"');
    expect(indexSource).toContain("Where Wellness");
    expect(indexSource).toContain("background-color: #FEFAF4");
    expect(indexSource).not.toContain("background-color: #1a0a12");
    expect(indexSource).not.toContain("rgba(0, 0, 0, 0.8)");
  });

  it("preloads the same authentic photograph used by the React hero and initial HTML image", () => {
    const heroPhoto = heroSource.match(/const HERO_PHOTO = "([^"]+)"/)?.[1];
    const preloadPhoto = indexSource.match(/<link rel="preload" as="image" href="([^"]+)"/)?.[1];
    expect(heroPhoto).toMatch(/^\/manus-storage\/apy_kitchener_gallery_/);
    expect(preloadPhoto).toBe(heroPhoto);
    expect(indexSource).toContain(`background: url("${heroPhoto}")`);
    expect(indexSource).not.toContain("apy_hero_bg-aDMPriKGFaJ3ZgQKWVBv5n.webp");
    expect(heroSource).toContain('loading="eager"');
    expect(heroSource).toContain('classList.remove("home-pending")');
  });
});
