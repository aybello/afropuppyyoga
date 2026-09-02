import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("local dogs in need ticket donation message", () => {
  it("uses a refined hero impact note without pilot or partner claims", () => {
    const sectionSource = readFileSync(
      resolve(import.meta.dirname, "../client/src/components/sections/LocalDogsImpact.tsx"),
      "utf8",
    );
    const navbarSource = readFileSync(
      resolve(import.meta.dirname, "../client/src/components/Navbar.tsx"),
      "utf8",
    );
    const heroSource = readFileSync(
      resolve(import.meta.dirname, "../client/src/components/sections/Hero.tsx"),
      "utf8",
    );

    expect(sectionSource).toContain("Puppy love, shared forward");
    expect(sectionSource).toContain("$0.50 from every eligible paid public-class ticket");
    expect(sectionSource).toContain("supports local dogs in need");
    expect(navbarSource).not.toContain("<LocalDogsImpact />");
    expect(heroSource).toContain("<LocalDogsImpact />");
    expect(sectionSource).not.toContain("three-month pilot");
    expect(sectionSource).not.toContain("Pound Dog Rescue");
    expect(sectionSource).toContain("bg-[#FFF6F7]/90");
    expect(sectionSource).toContain("text-[#3D1728]");
    expect(sectionSource).not.toContain("bg-[#2C1320]/70");
  });
});
