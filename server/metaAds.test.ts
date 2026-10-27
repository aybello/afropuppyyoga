import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildMetaPlacementTargeting, getMetaAdsConfiguration } from "./metaAds";

describe("Meta Marketing API configuration", () => {
  it("does not mistake existing CAPI credentials for Ads publishing access", () => {
    const config = getMetaAdsConfiguration({ META_CAPI_ACCESS_TOKEN: "capi-only", META_CAPI_ENABLED: "true" });
    expect(config.ready).toBe(false);
    expect(config.reason).toContain("not been configured");
  });

  it("requires an explicit APY account lock and a complete APY-only identity", () => {
    const base = {
      META_ADS_APY_ACCESS_TOKEN: "secret-not-returned",
      META_ADS_APY_AD_ACCOUNT_ID: "12345",
      META_ADS_APY_FACEBOOK_PAGE_ID: "67890",
      META_ADS_APY_INSTAGRAM_ACCOUNT_ID: "98765",
      META_ADS_APY_TARGETING_JSON: '{"geo_locations":{"countries":["CA"]}}',
    };
    expect(getMetaAdsConfiguration(base).ready).toBe(false);
    const config = getMetaAdsConfiguration({ ...base, META_ADS_APY_ACCOUNT_LOCK: "afropuppyyoga" });
    expect(config).toMatchObject({ ready: true, adAccountId: "12345", facebookPageId: "67890", instagramAccountId: "98765" });
    expect(JSON.stringify(config)).not.toContain("secret-not-returned");
  });

  it("rejects nonnumeric or malformed account identifiers", () => {
    const config = getMetaAdsConfiguration({
      META_ADS_APY_ACCESS_TOKEN: "token", META_ADS_APY_ACCOUNT_LOCK: "afropuppyyoga",
      META_ADS_APY_AD_ACCOUNT_ID: "act_echelon", META_ADS_APY_FACEBOOK_PAGE_ID: "67890", META_ADS_APY_INSTAGRAM_ACCOUNT_ID: "98765",
      META_ADS_APY_TARGETING_JSON: "{}",
    });
    expect(config.ready).toBe(false);
  });

  it("sends only the owner-selected Facebook and Instagram placement restrictions", () => {
    expect(buildMetaPlacementTargeting({ geo_locations: { countries: ["CA"] } }, ["instagram"])).toMatchObject({ publisher_platforms: ["instagram"], instagram_positions: ["stream", "story", "reels"] });
    expect(buildMetaPlacementTargeting({}, ["facebook"])).toMatchObject({ publisher_platforms: ["facebook"], facebook_positions: ["feed"] });
    expect(buildMetaPlacementTargeting({}, ["facebook", "instagram"])).toMatchObject({ publisher_platforms: ["facebook", "instagram"], facebook_positions: ["feed"], instagram_positions: ["stream", "story", "reels"] });
  });

  it("keeps missing provider IDs classified as uncertain rather than retryable provider errors", () => {
    const source = readFileSync(new URL("./metaAds.ts", import.meta.url), "utf8");
    expect(source).toContain('MetaAdsSafeError("unknown_outcome", "Meta returned a campaign response without an ID');
    expect(source).toContain('MetaAdsSafeError("unknown_outcome", "Meta returned an ad set response without an ID');
    expect(source).toContain('MetaAdsSafeError("unknown_outcome", "Meta returned an image response without a reference');
    expect(source).toContain('MetaAdsSafeError("unknown_outcome", "Meta returned a video response without a reference');
    expect(source).toContain('MetaAdsSafeError("unknown_outcome", "Meta returned an ad creative response without an ID');
    expect(source).toContain('MetaAdsSafeError("unknown_outcome", "Meta returned an ad response without an ID');
  });
});
