import { APY_TEAM_ROLES, normalizeApyRole } from "./apyPermissions";

export type EmployeeTreeMember = {
  id: number;
  sourceApplicationId: number | null;
  name: string;
  role: string;
  location: string;
  employmentStatus: "active" | "inactive";
  hasApyHqAccess: boolean;
};

const LOCATION_LABELS: Record<string, string> = { CENTRAL: "APY-wide", KW: "Kitchener", OAK: "Oakville", HAM: "Hamilton", GUE: "Guelph" };
const LOCATION_ALIASES: Record<string, string> = {
  kw: "KW", kitchener: "KW", "kitchener-waterloo": "KW", "kitchener waterloo": "KW",
  gue: "GUE", guelph: "GUE",
  oak: "OAK", oakville: "OAK", ham: "HAM", hamilton: "HAM",
  central: "CENTRAL", "apy-wide": "CENTRAL", "apy wide": "CENTRAL",
};
const ROLE_ORDER = ["Operations Manager", "Operations Specialist", "Yoga Instructor", "Movement Instructor", "Puppy Monitor", "Puppy Specialist", "BDR", "Social Media Specialist"];

/** Display-only aliases. Never rewrite roles, locations, employment or access. */
export function employeeTreeRole(role: string) {
  return APY_TEAM_ROLES.find((candidate) => normalizeApyRole(candidate) === normalizeApyRole(role))
    ?? (role.trim() || "Role not set");
}

/** Every Directory row belongs to exactly one location and one role branch. */
export function buildEmployeeTeamTree(employees: EmployeeTreeMember[]) {
  const locations = new Map<string, { key: string; label: string; roles: Map<string, EmployeeTreeMember[]> }>();
  for (const key of ["CENTRAL", "KW", "OAK", "HAM", "GUE"]) {
    locations.set(key, { key, label: LOCATION_LABELS[key], roles: new Map() });
  }
  for (const employee of employees) {
    const savedLocation = employee.location.trim();
    const key = LOCATION_ALIASES[savedLocation.toLowerCase()] ?? `other:${savedLocation}`;
    if (!locations.has(key)) locations.set(key, { key, label: savedLocation || "Location not set", roles: new Map() });
    const location = locations.get(key)!;
    const role = employeeTreeRole(employee.role);
    const members = location.roles.get(role) ?? [];
    members.push(employee);
    location.roles.set(role, members);
  }
  return Array.from(locations.values()).map((location) => ({
    key: location.key,
    label: location.label,
    roles: Array.from(location.roles, ([role, members]) => ({
      role,
      members: [...members].sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id),
    })).sort((a, b) => {
      const rank = (role: string) => { const index = ROLE_ORDER.indexOf(role); return index < 0 ? ROLE_ORDER.length : index; };
      return rank(a.role) - rank(b.role) || a.role.localeCompare(b.role);
    }),
  }));
}
