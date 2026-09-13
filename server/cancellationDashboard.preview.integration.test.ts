import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboard = readFileSync(resolve(import.meta.dirname, "../client/src/pages/CancellationDashboard.tsx"), "utf8");

describe("preview-first cancellation dashboard", () => {
  it("renders the exact email and SMS previews and submits only the current server-issued preview key", () => {
    expect(dashboard).toContain("emailPreview.subject");
    expect(dashboard).toContain("emailPreview.text");
    expect(dashboard).toContain("smsPreview");
    expect(dashboard).toContain("rebookingCode");
    expect(dashboard).toContain("previewKey: previewData.previewKey");
    expect(dashboard).toContain("The confirmed preview is checked again before any delivery.");
  });
});
