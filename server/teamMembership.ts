export type TeamMembershipCandidate = {
  isTeamMember: boolean | number | null;
  status: string;
  deletedAt?: unknown;
};

/**
 * Only people explicitly promoted during onboarding or added through the Team
 * & Availability workflow can appear in APY HQ staffing tools.
 */
export function isActiveTeamMember(person: TeamMembershipCandidate) {
  return Boolean(person.isTeamMember)
    && person.deletedAt == null
    && (person.status === "onboarded" || person.status === "accepted");
}
