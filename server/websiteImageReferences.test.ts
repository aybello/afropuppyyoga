import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FALLBACK_HERO_IMAGE,
  getNextHeroImageOnError,
  PRIMARY_HERO_IMAGE,
} from "../shared/heroImage";

const readProjectFile = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

describe("public website image references", () => {
  it("uses a working managed asset when the primary homepage hero fails", () => {
    expect(FALLBACK_HERO_IMAGE).toBe(
      "/manus-storage/apy_corporate_hero_202ea280.jpg",
    );
    expect(getNextHeroImageOnError(PRIMARY_HERO_IMAGE)).toBe(
      FALLBACK_HERO_IMAGE,
    );
    expect(getNextHeroImageOnError(FALLBACK_HERO_IMAGE)).toBeNull();
  });

  it("does not restore the deleted hero or location preview paths", () => {
    const sources = [
      readProjectFile("../shared/heroImage.ts"),
      readProjectFile("../client/src/pages/Waterloo.tsx"),
      readProjectFile("../client/src/components/LocationPage.tsx"),
    ].join("\n");

    expect(sources).not.toContain("afropuppyyoga-hero_3919ee3c");
    expect(sources).not.toContain("og_image_apy.jpg");
    expect(sources).toContain("apy_corporate_hero_202ea280.jpg");
  });
});
