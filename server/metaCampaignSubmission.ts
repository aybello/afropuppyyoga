export type CampaignSubmissionState = {
  status: string;
  metaCampaignId: string | null;
  metaAdSetId: string | null;
};

/**
 * A campaign creation attempt is one-way: any Meta object or uncertain provider
 * result stops a second creation attempt. A human reconciliation flow is needed
 * before changing a campaign with external state.
 */
export function campaignSubmissionBlockReason(campaign: CampaignSubmissionState): string | null {
  if (campaign.metaCampaignId || campaign.metaAdSetId) return "This campaign already has Meta objects and requires reconciliation before any further action.";
  if (campaign.status === "blocked") return "This campaign has an uncertain provider outcome and requires reconciliation before any further action.";
  if (campaign.status === "partial") return "This campaign has a partial Meta result and requires reconciliation before any further action.";
  if (campaign.status !== "ready") return "Save a complete local draft with at least one valid creative before submitting.";
  return null;
}
