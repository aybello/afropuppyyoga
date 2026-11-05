import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FALLBACK_HERO_IMAGE,
  getNextHeroImageOnError,
  PRIMARY_HERO_IMAGE,
  HERO_IMAGE_SOURCES,
} from "../shared/heroImage";

const readProjectFile = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

describe("public website image references", () => {
  it("uses a working managed asset when the primary homepage hero fails", () => {
    expect(FALLBACK_HERO_IMAGE).toBe(
      "https://files.manuscdn.com/user_upload_by_module/session_file/310519663446228701/zstgfhkhgJOsMcBx.jpg",
    );
    expect(getNextHeroImageOnError(PRIMARY_HERO_IMAGE)).toBe(
      FALLBACK_HERO_IMAGE,
    );
    expect(getNextHeroImageOnError(FALLBACK_HERO_IMAGE)).toBe(HERO_IMAGE_SOURCES[2]);
    expect(getNextHeroImageOnError(HERO_IMAGE_SOURCES[4])).toBeNull();
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

  it("includes the supplied LiftOff logo in the public hero trust banner", () => {
    const hero = readProjectFile("../client/src/components/sections/Hero.tsx");

    expect(hero).toContain('name: "LiftOff"');
    expect(hero).toContain("LiftOff_Logo_Building_Legacy_banner_5f5d7710.png");
    expect(hero).toContain("height: 88");
  });

  it("leads the gallery with polished APY originals hosted on permanent managed paths", () => {
    const about = readProjectFile("../client/src/components/sections/About.tsx");
    const gallery = readProjectFile("../client/src/components/sections/Gallery.tsx");
    const photos = gallery.split("const PHOTOS = [")[1].split("];")[0];
    const sources = [...photos.matchAll(/src: (?:"([^"]+)"|`([^`]+)`)/g)]
      .map(match => match[1] || match[2]);

    expect(sources.slice(0, 3)).toEqual([
      "/manus-storage/apy_portrait_golden_cuddle_oct19_d7e4953e.jpg",
      "/manus-storage/apy_portrait_two_goldens_oct13_44cd44f3.jpg",
      "/manus-storage/apy_portrait_chow_cuddle_nov01_52f30f49.jpg",
    ]);
    expect(about).toContain(sources[0]);
    expect(about).not.toContain("apy_kitchener_gallery_04_oct04_portrait_464e300c.jpg");
    expect(sources).toHaveLength(33);
    expect(new Set(sources).size).toBe(sources.length);
    expect(about + gallery).not.toContain("cdninstagram.com");
  });
});
