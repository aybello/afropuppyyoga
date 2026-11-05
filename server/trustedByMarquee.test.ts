import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const hero = readFileSync(new URL("../client/src/components/sections/Hero.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../client/src/index.css", import.meta.url), "utf8");
const about = readFileSync(new URL("../client/src/components/sections/About.tsx", import.meta.url), "utf8");

describe("Trusted By strip and approved photo replacement", () => {
  it("renders two equal stable-width partner sets for a seamless loop", () => {
    expect(hero).toContain('[0, 1].map((copy)');
    expect(hero).toContain('className="apy-trust-set"');
    expect(hero).toContain('className="apy-trust-logo"');
    expect(css).toContain('width: 176px');
    expect(css).toContain('gap: 0.875rem');
    expect(css).toContain('animation: apyTrustMarquee 60s linear infinite');
    expect(css).toContain('to { transform: translateX(-50%); }');
  });

  it("loads moving logos eagerly and hides the duplicate from assistive technology", () => {
    const strip = hero.slice(hero.indexOf('className="apy-trust-window'));
    expect(hero).toContain('loading="eager"');
    expect(hero).not.toContain('loading="lazy"');
    expect(strip).toContain('aria-hidden={copy === 1 ? true : undefined}');
    expect(hero).toContain('alt={copy === 0 ? org.name : ""}');
    expect(hero).toContain('name: "LiftOff"');
    expect(hero).toContain('height: 88');
    expect((hero.match(/name: "/g) ?? [])).toHaveLength(23);
    expect((hero.match(/optimized: "\/manus-storage\//g) ?? [])).toHaveLength(6);
    expect(hero).toContain('org.optimized && !useOriginal && <source');
    expect(hero).toContain('if (org.optimized && !useOriginal) setUseOriginal(true)');
    expect(hero).not.toContain('source.remove()');
    expect(strip).toContain('<PartnerLogo org={org} copy={copy} />');
  });

  it("removes the Pause button while keeping hover, keyboard and reduced-motion behavior", () => {
    expect(css).toContain('.apy-trust-window:hover .apy-trust-track');
    expect(css).toContain('.apy-trust-window:focus-within .apy-trust-track');
    expect(hero).not.toContain('logosPaused');
    expect(hero).not.toContain('Pause partner logos');
    expect(hero).not.toContain('Resume partner logos');
    expect(hero).toContain('id="trusted-partners-title"');
    expect(hero).toContain('tabIndex={0}');
    expect(css).toContain('.apy-trust-window:focus-visible');
    expect(css).toContain('animation-play-state: paused');
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.apy-trust-window \{ overflow-x: auto; \}\s*\.apy-trust-track \{ animation: none; \}/);
    expect(css).toContain('.apy-trust-set[aria-hidden="true"] { display: none; }');
  });

  it("replaces the disliked About photo while preserving its layout and lazy loading", () => {
    expect(about).toContain('apy_portrait_golden_cuddle_oct19_d7e4953e.jpg');
    expect(about).not.toContain('apy_kitchener_gallery_04_oct04_portrait_464e300c.jpg');
    expect(about).not.toContain('apy_kitchener_gallery_06_aug01_puppy_bc15310d.jpg');
    expect(about).toContain('width={1500}');
    expect(about).toContain('height={2000}');
    expect(about).toContain('loading="lazy"');
    expect(about).toContain('aspect-[3/4]');
  });
});
