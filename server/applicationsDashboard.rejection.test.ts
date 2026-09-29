import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "client/src/pages/ApplicationsDashboard.tsx"),
  "utf8",
);

describe("Applications Dashboard main-list rejection controls", () => {
  it("opens the rejection workflow instead of silently changing a row to rejected", () => {
    expect(source).toContain("const beginRejection = (app: Application)");
    expect(source).toContain('if (val === "rejected")');
    expect(source).toContain("beginRejection(app as Application)");
    expect(source).toContain('title="Send a rejection email and move this applicant to Rejected"');
  });

  it("keeps onboarded employees outside the rejection workflow", () => {
    expect(source).toContain('app.status !== "rejected" && app.status !== "onboarded"');
    expect(source).toContain("Onboarded employees cannot be rejected from the application pipeline");
  });
});
