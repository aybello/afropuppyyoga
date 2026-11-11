import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const portal = readFileSync(new URL("../client/src/pages/StaffPortal.tsx", import.meta.url), "utf8");
const rule = portal.slice(portal.indexOf("function requiredAccessForTool"), portal.indexOf("function getGreeting"));

describe("staff portal tool access", () => {
  it("keeps finance and ads tools owner-only", () => {
    const ownerLine = rule.split("\n").find((line) => line.includes('return "owner"')) ?? "";
    for (const id of ["invoices", "revenue", "private-revenue-dashboard", "quickbooks", "meta-campaigns"]) {
      expect(ownerLine).toContain(`id === "${id}"`);
    }
  });
  it("gives Employee Directory to operations staff, not only the owner (owner decision 2026-11-11)", () => {
    const ownerLine = rule.split("\n").find((line) => line.includes('return "owner"')) ?? "";
    expect(ownerLine).not.toContain("employee-directory");
    expect(rule).toContain('return "operations"');
  });
});
