import { normalizeCanadianPhoneNumber } from "../shared/phone";

type Identity = { name: string; email: string | null; phone: string | null };
type Profile = Identity & { id: number; status: string; isTeamMember: boolean | number | null; deletedAt: unknown };
type Employee = Identity & { id: number; sourceApplicationId: number | null };

const emailOf = (person: Identity) => person.email?.trim().toLowerCase() || null;
const phoneOf = (person: Identity) => normalizeCanadianPhoneNumber(person.phone ?? "");
const nameOf = (person: Identity) => person.name.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
export function employeeContactsMatch(left: Identity, right: Identity) {
  const email = emailOf(left), phone = phoneOf(left);
  return Boolean(email && email === emailOf(right)) || Boolean(phone && phone === phoneOf(right));
}
function sameEmployeeIdentity(employee: Identity, profile: Identity) {
  if (!nameOf(employee) || nameOf(employee) !== nameOf(profile) || !employeeContactsMatch(employee, profile)) return false;
  const email = emailOf(employee), otherEmail = emailOf(profile);
  const phone = phoneOf(employee), otherPhone = phoneOf(profile);
  // One shared contact cannot override a contradictory second contact.
  return !(email && otherEmail && email !== otherEmail) && !(phone && otherPhone && phone !== otherPhone);
}

/** Resolve only for an explicitly selected Directory employee, inside the staffing lock. */
export function resolveEmployeeLoginProfile<T extends Profile>(employee: Employee, profiles: T[], directory: Employee[]) {
  const matches = profiles.filter((profile) => employeeContactsMatch(employee, profile));
  if (directory.some((other) => other.id !== employee.id && employeeContactsMatch(employee, other))) {
    throw new Error("Another Employee Directory record uses this contact. Update or restore that record instead of creating a duplicate login.");
  }
  const linked = employee.sourceApplicationId === null ? undefined : profiles.find((profile) => profile.id === employee.sourceApplicationId);
  if (employee.sourceApplicationId !== null && !linked) {
    throw new Error("The linked APY HQ profile could not be found. Review the employee record before activating it.");
  }
  const related = linked ? [...matches, linked] : matches;
  if (directory.some((other) => other.id !== employee.id && related.some((profile) => profile.id === other.sourceApplicationId))) {
    throw new Error("The matching APY HQ profile is already linked to another employee.");
  }
  const duplicates = matches.filter((profile) => profile.id !== linked?.id && sameEmployeeIdentity(employee, profile) && profile.status === "onboarded");
  for (const profile of matches) {
    if (profile.id === linked?.id || duplicates.some((duplicate) => duplicate.id === profile.id)) continue;
    // Archived applicants are inert history, not a second login. Do not merge,
    // reactivate, rewrite or delete them. Ownership checks above still apply.
    if (profile.deletedAt != null) continue;
    throw new Error("Another applicant or staff profile uses this contact. Review the conflicting record before activating login.");
  }
  const canonical = linked ?? [...duplicates].sort((a, b) => b.id - a.id)[0];
  if (!canonical && matches.length) {
    throw new Error("This contact belongs to an applicant. Complete their onboarding through the applicant record before linking employee access.");
  }
  return { canonical, duplicates: duplicates.filter((profile) => profile.id !== canonical?.id) };
}
