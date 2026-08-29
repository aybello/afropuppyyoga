import { describe, expect, it } from "vitest";
import {
  FALLBACK_HERO_IMAGE,
  getNextHeroImageOnError,
  PRIMARY_HERO_IMAGE,
} from "../shared/heroImage";

describe("homepage hero image fallback", () => {
  it("uses the secondary source when the managed hero image fails", () => {
    expect(getNextHeroImageOnError(PRIMARY_HERO_IMAGE)).toBe(FALLBACK_HERO_IMAGE);
  });

  it("stops retrying after the secondary hero source fails", () => {
    expect(getNextHeroImageOnError(FALLBACK_HERO_IMAGE)).toBeNull();
  });
});
