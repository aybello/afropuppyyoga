import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import Hero from "../client/src/components/sections/Hero";
import {
  FALLBACK_HERO_IMAGE, getNextHeroImageOnError, PRIMARY_HERO_IMAGE,
  HERO_IMAGE_SOURCES, heroImageReducer, heroImageSource, INITIAL_HERO_IMAGE_STATE,
} from "../shared/heroImage";

const fail = (state = INITIAL_HERO_IMAGE_STATE) => heroImageReducer(state, { type: "error", index: state.index, cycle: state.cycle });

describe("actual homepage portrait recovery", () => {
  it("starts the rendered hero with the approved direct public Chow portrait", () => {
    expect(PRIMARY_HERO_IMAGE).toBe("https://files.manuscdn.com/user_upload_by_module/session_file/310519663446228701/zstgfhkhgJOsMcBx.jpg");
    const html = renderToStaticMarkup(createElement(Hero));
    expect(html).toContain(`src="${PRIMARY_HERO_IMAGE}"`);
    expect(html).toContain('width="1500" height="2000"');
    expect(html).toContain('loading="eager"');
    expect(html).toContain('fetchPriority="high"');
    expect(html).toContain("Smiling guest cuddling a fluffy Chow puppy");
    expect(html).not.toContain("Retry photo");
  });

  it("advances from direct Chow to same-photo managed recovery, then approved Golden and stops", () => {
    expect(HERO_IMAGE_SOURCES).toHaveLength(4);
    expect(FALLBACK_HERO_IMAGE).toBe("/manus-storage/apy_portrait_chow_cuddle_nov01_52f30f49.jpg?v=apy-portraits-20261104");
    expect(getNextHeroImageOnError(PRIMARY_HERO_IMAGE)).toBe(FALLBACK_HERO_IMAGE);
    expect(getNextHeroImageOnError(FALLBACK_HERO_IMAGE)).toBe(HERO_IMAGE_SOURCES[2]);
    expect(HERO_IMAGE_SOURCES[2]).toContain("/tkTWwpxwClsSwSww.jpg");
    expect(HERO_IMAGE_SOURCES[3]).toContain("apy_portrait_golden_cuddle_oct19_d7e4953e.jpg?v=");
    expect(getNextHeroImageOnError(HERO_IMAGE_SOURCES[3])).toBeNull();
    expect(getNextHeroImageOnError("/unknown.jpg")).toBeNull();
  });

  it("exhausts exactly four attempts and ignores further errors", () => {
    let state = INITIAL_HERO_IMAGE_STATE;
    for (let index = 0; index < 4; index++) {
      expect(state.index).toBe(index);
      expect(state.failed).toBe(false);
      state = fail(state);
    }
    expect(state.failed).toBe(true);
    expect(state.index).toBe(3);
    expect(fail(state)).toBe(state);
  });

  it("does not skip images when stale or duplicate error callbacks arrive", () => {
    const second = fail();
    expect(heroImageReducer(second, { type: "error", index: 0, cycle: 0 })).toBe(second);
    expect(heroImageReducer(second, { type: "error", index: 2, cycle: 0 })).toBe(second);
  });

  it("allows repeated manual retries with fresh URLs and rejects errors from the earlier cycle", () => {
    let state = INITIAL_HERO_IMAGE_STATE;
    for (let cycle = 0; cycle < 3; cycle++) {
      for (let index = 0; index < 4; index++) state = fail(state);
      state = heroImageReducer(state, { type: "retry" });
      expect(state).toEqual({ index: 0, cycle: cycle + 1, failed: false });
      expect(heroImageSource(state)).toContain(`?retry=${cycle + 1}`);
      expect(heroImageReducer(state, { type: "error", index: 0, cycle })).toBe(state);
      const recoveryState = fail(state);
      expect(heroImageSource(recoveryState)).toContain(`&retry=${cycle + 1}`);
    }
  });

  it("does not restart a healthy image when Retry is not needed", () => {
    expect(heroImageReducer(INITIAL_HERO_IMAGE_STATE, { type: "retry" })).toBe(INITIAL_HERO_IMAGE_STATE);
    expect(heroImageSource(INITIAL_HERO_IMAGE_STATE)).toBe(PRIMARY_HERO_IMAGE);
  });

  it("wires recovery, correct alt text, accessible terminal Retry and first-paint cleanup in the real component", () => {
    const source = readFileSync(new URL("../client/src/components/sections/Hero.tsx", import.meta.url), "utf8");
    expect(source).toContain("useReducer(heroImageReducer, INITIAL_HERO_IMAGE_STATE)");
    expect(source).toContain("heroImageSource(heroImageState)");
    expect(source).toContain('dispatchHeroImage({ type: "error", index: heroImageIndex, cycle: heroImageState.cycle })');
    expect(source).toContain('dispatchHeroImage({ type: "retry" })');
    expect(source).toContain('role="status"');
    expect(source).toContain("The photo could not load.");
    expect(source).toContain("Retry photo");
    expect(source).toContain("heroImageIndex < 2");
    expect(source).toContain('onLoad={() => document.documentElement.classList.remove("home-pending")}');
  });
});
