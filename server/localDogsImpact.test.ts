import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("local dogs in need ticket donation message", () => {
  it("uses the compact top banner to state the ticket contribution without pilot or partner claims", () => {
    const sectionSource = readFileSync(
      resolve(import.meta.dirname, "../client/src/components/sections/LocalDogsImpact.tsx"),
      "utf8",
    );
    const navbarSource = readFileSync(
      resolve(import.meta.dirname, "../client/src/components/Navbar.tsx"),
      "utf8",
    );

    expect(sectionSource).toContain("Every APY ticket gives back.");
    expect(sectionSource).toContain("$0.50 from every eligible paid public-class ticket");
    expect(sectionSource).toContain("supports local dogs in need");
    expect(sectionSource).not.toContain("three-month pilot");
    expect(sectionSource).not.toContain("Pound Dog Rescue");
    expect(navbarSource).toContain('import LocalDogsImpact from "@/components/sections/LocalDogsImpact"');
    expect(navbarSource).toContain("<LocalDogsImpact />");
  });
});
