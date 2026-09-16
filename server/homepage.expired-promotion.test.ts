import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("retired public promotions", () => {
  it("does not ship the expired 20% Summer Sale banner on the homepage", () => {
    const heroSource = readFileSync(
      resolve(import.meta.dirname, "../client/src/components/sections/Hero.tsx"),
      "utf8",
    );
    const homeSource = readFileSync(
      resolve(import.meta.dirname, "../client/src/pages/Home.tsx"),
      "utf8",
    );
    const retiredBannerPath = resolve(
      import.meta.dirname,
      "../client/src/components/SummerSaleBanner.tsx",
    );

    expect(heroSource).not.toContain("Summer Sale — 20% Off");
    expect(homeSource).not.toContain("SummerSaleBanner");
    expect(existsSync(retiredBannerPath)).toBe(false);
  });
});
