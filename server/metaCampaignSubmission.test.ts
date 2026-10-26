import { describe, expect, it } from "vitest";
import { campaignSubmissionBlockReason } from "./metaCampaignSubmission";

describe("campaign submission duplicate prevention", () => {
  it("permits exactly a ready local draft with no external objects", () => {
    expect(campaignSubmissionBlockReason({ status: "ready", metaCampaignId: null, metaAdSetId: null })).toBeNull();
  });

  it("blocks resubmission after any Meta object, partial result, or uncertain outcome", () => {
    expect(campaignSubmissionBlockReason({ status: "ready", metaCampaignId: "meta-campaign", metaAdSetId: null })).toContain("Meta objects");
    expect(campaignSubmissionBlockReason({ status: "partial", metaCampaignId: "meta-campaign", metaAdSetId: "meta-adset" })).toContain("Meta objects");
    expect(campaignSubmissionBlockReason({ status: "blocked", metaCampaignId: null, metaAdSetId: null })).toContain("uncertain provider outcome");
  });
});
