export type ApyAccessLevel = "owner" | "operations_manager" | "team_member" | "none";

export type ApyHubToolAccess = "owner" | "operations" | "team";

export const APY_TEAM_ROLES = [
  "Yoga Instructor",
  "Operations Manager",
  "Puppy Monitor",
  "Puppy Specialist",
  "BDR",
  "Social Media Specialist",
] as const;

export const APY_TEAM_LOCATIONS = ["KW", "OAK", "HAM", "CENTRAL"] as const;

export type ApyTeamRole = (typeof APY_TEAM_ROLES)[number];
export type ApyTeamLocation = (typeof APY_TEAM_LOCATIONS)[number];

export const APY_CENTRAL_TEAM_ROLES = ["BDR", "Social Media Specialist"] as const;

export function isCentralApyTeamRole(role: string | null | undefined): role is (typeof APY_CENTRAL_TEAM_ROLES)[number] {
  return APY_CENTRAL_TEAM_ROLES.some((centralRole) => centralRole === role);
}

export function normalizeApyRole(role: string | null | undefined): string {
  return (role ?? "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

export function isOperationsManagerRole(role: string | null | undefined): boolean {
  return normalizeApyRole(role) === "operations manager";
}

export function getApyAccessLevel(role: string | null | undefined, isOwner = false): ApyAccessLevel {
  if (isOwner) return "owner";
  if (!role) return "none";
  return isOperationsManagerRole(role) ? "operations_manager" : "team_member";
}

export function canManageOperations(level: ApyAccessLevel): boolean {
  return level === "owner" || level === "operations_manager";
}

export function canAccessHubTool(level: ApyAccessLevel, required: ApyHubToolAccess): boolean {
  if (level === "owner") return true;
  if (required === "operations") return level === "operations_manager";
  return required === "team" && (level === "operations_manager" || level === "team_member");
}
