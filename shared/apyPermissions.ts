export type ApyAccessLevel = "owner" | "operations_manager" | "team_member" | "none";

export type ApyHubToolAccess = "owner" | "operations" | "team";

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
