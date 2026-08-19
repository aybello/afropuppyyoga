export type TeamMembershipCandidate = {
  isTeamMember: boolean | number | null;
  status: string;
  deletedAt?: unknown;
};

/**
 * A job application is not an APY HQ team record. Only people explicitly added
 * through the Team & Availability workflow can appear in the staffing tools.
 */
export function isActiveTeamMember(person: TeamMembershipCandidate) {
  return Boolean(person.isTeamMember)
    && person.deletedAt == null
    && (person.status === "onboarded" || person.status === "accepted");
}
