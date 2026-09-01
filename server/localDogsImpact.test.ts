import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("local dogs in need ticket donation message", () => {
  it("states the approved pilot amount and ticket eligibility without naming an unconfirmed partner", () => {
    const sectionSource = readFileSync(
      resolve(import.meta.dirname, "../client/src/components/sections/LocalDogsImpact.tsx"),
      "utf8",
    );
    const homeSource = readFileSync(
      resolve(import.meta.dirname, "../client/src/pages/Home.tsx"),
      "utf8",
    );

    expect(sectionSource).toContain("current three-month pilot");
    expect(sectionSource).toContain("$0.50 from every eligible paid, non-refunded public-class ticket");
    expect(sectionSource).toContain("support local dogs in need");
    expect(sectionSource).not.toContain("Pound Dog Rescue");
    expect(homeSource).toContain('lazy(() => import("@/components/sections/LocalDogsImpact"))');
    expect(homeSource).toContain("<LocalDogsImpact />");
  });
});
