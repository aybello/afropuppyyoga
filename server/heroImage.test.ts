import { describe, expect, it } from "vitest";
import {
  FALLBACK_HERO_IMAGE,
  getNextHeroImageOnError,
  PRIMARY_HERO_IMAGE,
} from "../shared/heroImage";

describe("homepage hero image fallback", () => {
  it("uses the managed fallback only when the reliable CDN hero image fails", () => {
    expect(PRIMARY_HERO_IMAGE).toMatch(/^https:\/\/d2xsxph8kpxj0f\.cloudfront\.net\//);
    expect(FALLBACK_HERO_IMAGE).toMatch(/^\/manus-storage\//);
    expect(getNextHeroImageOnError(PRIMARY_HERO_IMAGE)).toBe(FALLBACK_HERO_IMAGE);
  });

  it("stops retrying after the secondary hero source fails", () => {
    expect(getNextHeroImageOnError(FALLBACK_HERO_IMAGE)).toBeNull();
  });
});
