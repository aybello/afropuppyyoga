import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const kitchenerPage = readFileSync(
  new URL("../client/src/pages/Kitchener.tsx", import.meta.url),
  "utf8",
);

const multiClassGalleryPaths = [
  "/manus-storage/apy_kitchener_gallery_01_oct17_group_1855cea5.jpg",
  "/manus-storage/apy_kitchener_gallery_02_oct24_portrait_7773eb35.jpg",
  "/manus-storage/apy_kitchener_gallery_03_oct10_friends_fce63f49.jpg",
  "/manus-storage/apy_kitchener_gallery_04_oct04_portrait_464e300c.jpg",
  "/manus-storage/apy_kitchener_gallery_05_sep27_candid_6da4b3f3.jpg",
  "/manus-storage/apy_kitchener_gallery_06_aug01_puppy_bc15310d.jpg",
  "/manus-storage/apy_kitchener_gallery_07_jun21_on_mat_172ef0af.jpg",
  "/manus-storage/apy_kitchener_gallery_08_may10_couple_2797774a.jpg",
];

describe("Kitchener photo gallery", () => {
  it("uses eight curated APY images from distinct Kitchener class dates", () => {
    expect(new Set(multiClassGalleryPaths).size).toBe(8);

    for (const imagePath of multiClassGalleryPaths) {
      expect(kitchenerPage).toContain(imagePath);
    }

    const photoBlock = kitchenerPage.match(/photos:\s*\[([\s\S]*?)\],\s*whyReasons:/)?.[1];
    expect(photoBlock).toBeDefined();

    const sources = [...(photoBlock ?? "").matchAll(/src:\s*"([^"]+)"/g)].map(
      match => match[1],
    );
    expect(sources).toHaveLength(8);
    expect(new Set(sources).size).toBe(sources.length);
  });

  it("does not reintroduce the earlier single-class Kitchener gallery assets", () => {
    expect(kitchenerPage).not.toContain("apy_kitchener_01_be82fd91.jpg");
    expect(kitchenerPage).not.toContain("apy_kitchener_09_a602301b.jpg");
    expect(kitchenerPage).not.toContain("apy_kitchener_refresh_");
  });
});
