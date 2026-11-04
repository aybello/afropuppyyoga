import { describe, expect, it } from "vitest";
import { getLegacyImageRecoveryTarget } from "./legacyImageRecovery";

describe("legacy public image recovery", () => {
  it("maps the retired Kitchener gallery to its restored equivalents", () => {
    expect(getLegacyImageRecoveryTarget("/manus-storage/IMG_0657_84447a5e.jpg")).toBe(
      "/manus-storage/apy_kitchener_01_be82fd91.jpg",
    );
    expect(getLegacyImageRecoveryTarget("/manus-storage/IMG_8573_464bace7.jpg")).toBe(
      "/manus-storage/apy_kitchener_09_a602301b.jpg",
    );
  });

  it("recovers shared Hamilton and Oakville legacy photo paths with the page context", () => {
    const oldFirstSharedPhoto = "/manus-storage/ham_oak_IMG_3209_d7f2d0c0.jpg";
    expect(getLegacyImageRecoveryTarget(oldFirstSharedPhoto, "https://afropuppyyoga.ca/puppy-yoga-hamilton")).toBe(
      "/manus-storage/apy_hamilton_01_7eb2d831.jpg",
    );
    expect(getLegacyImageRecoveryTarget(oldFirstSharedPhoto, "https://afropuppyyoga.ca/puppy-yoga-oakville")).toBe(
      "/manus-storage/apy_oakville_01_53c61421.jpg",
    );
  });

  it("recovers retired hero paths but never intercepts a current or unknown asset", () => {
    expect(getLegacyImageRecoveryTarget("/manus-storage/corporate_hero_95e52cfc.jpg")).toBe(
      "/manus-storage/apy_corporate_hero_202ea280.jpg",
    );
    expect(getLegacyImageRecoveryTarget("/manus-storage/private-events-hero_72e6b8e7.jpg")).toBe(
      "/manus-storage/apy_portrait_two_goldens_oct13_44cd44f3.jpg",
    );
    expect(getLegacyImageRecoveryTarget("/manus-storage/apy_hamilton_01_7eb2d831.jpg")).toBeNull();
    expect(getLegacyImageRecoveryTarget("/manus-storage/not-an-apy-image.jpg")).toBeNull();
  });

  it("recovers explicitly rejected photos for visitors running cached page bundles", () => {
    expect(getLegacyImageRecoveryTarget("/manus-storage/apy_hamilton_03_f2f5d54e.jpg")).toBe("/manus-storage/apy_portrait_golden_cuddle_oct19_d7e4953e.jpg");
    for (const path of ["apy_oakville_03_6e1d8088.jpg", "apy_private_events_hero_43ef0f7d.jpg"]) {
      expect(getLegacyImageRecoveryTarget("/manus-storage/" + path)).toBe("/manus-storage/apy_portrait_two_goldens_oct13_44cd44f3.jpg");
    }
    expect(getLegacyImageRecoveryTarget("/manus-storage/apy_portrait_two_goldens_oct13_44cd44f3.jpg")).toBeNull();
    expect(getLegacyImageRecoveryTarget("/manus-storage/ham_oak_IMG_7923_87d8073f.jpg", "https://afropuppyyoga.ca/puppy-yoga-oakville")).toBe("/manus-storage/apy_portrait_two_goldens_oct13_44cd44f3.jpg");
  });
});
