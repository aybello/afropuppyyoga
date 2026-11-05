import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { HERO_IMAGE_SOURCES, PRIMARY_HERO_IMAGE } from "../shared/heroImage";

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
    const heroPhoto = PRIMARY_HERO_IMAGE;
    expect(heroSource).toContain("heroImageSource(heroImageState)");
    expect(heroPhoto).toContain("files.manuscdn.com/");
    expect(indexSource).toContain(`heroPreload.href = "${heroPhoto}"`);
    expect(indexSource).toContain(`"${heroPhoto}"`);
    expect(indexSource).toContain("shellPhoto.onerror");
    expect(indexSource).toContain("zstgfhkhgJOsMcBx.jpg");
    expect(indexSource).not.toContain("<noscript><style>#home-first-paint");
    expect(indexSource).not.toContain("apy_hero_bg-aDMPriKGFaJ3ZgQKWVBv5n.webp");
    expect(heroSource).toContain('loading="eager"');
    expect(heroSource).toContain('classList.remove("home-pending")');
  });

  it("keeps the shell hidden without JavaScript on every route, while preserving the font fallback", () => {
    expect(indexSource).toMatch(/#home-first-paint\s*\{[^}]*display:\s*none/s);
    expect(indexSource).toContain('html.home-pending #home-first-paint { display: flex; }');
    const noscripts = [...indexSource.matchAll(/<noscript>([\s\S]*?)<\/noscript>/g)].map(match => match[1]);
    expect(noscripts.some(content => content.includes('fonts.googleapis.com'))).toBe(true);
    expect(noscripts.every(content => !/home-first-paint|home-shell|Where Wellness|Book a Class/.test(content))).toBe(true);
  });

  it("uses the same finite genuine-photo recovery chain as React, without fetching on other routes", () => {
    const script = indexSource.match(/<script>\s*\/\/ No hidden-route image requests[\s\S]*?<\/script>/)?.[0]
      .replace(/^<script>|<\/script>$/g, "") ?? "";
    expect(script).not.toBe("");
    const image = { src: "", dataset: {} as Record<string, string>, onerror: () => {}, removeAttribute: (name: string) => { if (name === "src") image.src = ""; } };
    runInNewContext(script, { window: { location: { pathname: "/" } }, document: { getElementById: () => image } });
    for (const source of HERO_IMAGE_SOURCES) {
      expect(image.src).toBe(source);
      image.onerror();
    }
    expect(image.src).toBe("");
    expect(image.dataset.heroFailed).toBe("true");
    let queried = false;
    runInNewContext(script, { window: { location: { pathname: "/privacy" } }, document: { getElementById: () => { queried = true; } } });
    expect(queried).toBe(false);
  });
});
