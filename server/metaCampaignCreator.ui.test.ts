import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("../client/src/pages/MetaCampaignCreator.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");
const nav = readFileSync(new URL("../client/src/components/AdminNav.tsx", import.meta.url), "utf8");

describe("Campaign Creator UI wiring", () => {
  it("keeps the Campaign Creator in APY HQ and out of public navigation", () => {
    expect(app).toContain('path="/admin/meta-campaigns"');
    expect(nav).toContain('href: "/admin/meta-campaigns"');
    expect(nav).toContain('required: "owner"');
  });

  it("contains a five-step media-first creator and a deliberate final confirmation", () => {
    expect(page).toContain('const STEPS = ["Event", "Media", "Copy", "Budget & placements", "Review"]');
    expect(page).toContain("META_CAMPAIGN_MAX_CREATIVES");
    expect(page).toContain("Create campaign in Meta");
    expect(page).toContain("AlertDialog");
    expect(page).toContain("Private upload");
  });

  it("keeps private media previews and owner access handling explicit", () => {
    expect(page).toContain("createLocalCreativePreview");
    expect(page).toContain("releaseLocalCreativePreview");
    expect(page).toContain('access.data?.level !== "owner"');
    expect(page).toContain("Publishing locked");
  });
});
