import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const kitchenerPage = readFileSync(
  new URL("../client/src/pages/Kitchener.tsx", import.meta.url),
  "utf8",
);

const refreshedGalleryPaths = [
  "/manus-storage/apy_kitchener_refresh_01_01_class_group_ac0ef78a.jpg",
  "/manus-storage/apy_kitchener_refresh_02_02_blue_top_puppy_f94bf3da.jpg",
  "/manus-storage/apy_kitchener_refresh_03_03_two_friends_9845114b.jpg",
  "/manus-storage/apy_kitchener_refresh_04_04_couple_with_puppies_4c5409c2.jpg",
  "/manus-storage/apy_kitchener_refresh_05_05_puppy_cuddle_e9b68a33.jpg",
  "/manus-storage/apy_kitchener_refresh_06_06_group_with_puppies_91a94b47.jpg",
  "/manus-storage/apy_kitchener_refresh_07_07_portrait_with_puppy_bdaa5a2b.jpg",
  "/manus-storage/apy_kitchener_refresh_08_08_two_friends_two_puppies_28d980f9.jpg",
  "/manus-storage/apy_kitchener_refresh_09_09_four_friends_137e81de.jpg",
];

describe("Kitchener photo gallery", () => {
  it("uses nine distinct curated APY images with no duplicated gallery source", () => {
    expect(new Set(refreshedGalleryPaths).size).toBe(9);

    for (const imagePath of refreshedGalleryPaths) {
      expect(kitchenerPage).toContain(imagePath);
    }

    const photoBlock = kitchenerPage.match(/photos:\s*\[([\s\S]*?)\],\s*whyReasons:/)?.[1];
    expect(photoBlock).toBeDefined();

    const sources = [...(photoBlock ?? "").matchAll(/src:\s*"([^"]+)"/g)].map(
      match => match[1],
    );
    expect(sources).toHaveLength(9);
    expect(new Set(sources).size).toBe(sources.length);
  });

  it("does not reintroduce the earlier Kitchener gallery asset set", () => {
    expect(kitchenerPage).not.toContain("apy_kitchener_01_be82fd91.jpg");
    expect(kitchenerPage).not.toContain("apy_kitchener_09_a602301b.jpg");
  });
});
