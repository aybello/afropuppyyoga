import { z } from "zod";
import { APY_TEAM_LOCATIONS, APY_TEAM_ROLES, isCentralApyTeamRole, normalizeApyRole } from "../shared/apyPermissions";
import { normalizeCanadianPhoneNumber } from "../shared/phone";

const locationSchema = z.enum(APY_TEAM_LOCATIONS);
const emailSchema = z.string().email();

/** Validates only identity details, never staffing levels or paperwork. */
export function getEmployeeLoginDetails(employee: { role: string; location: string; email: string | null; phone: string | null }) {
  const role = APY_TEAM_ROLES.find((candidate) => normalizeApyRole(candidate) === normalizeApyRole(employee.role));
  if (!role) throw new Error("Choose a supported employee role before activating access.");
  const location = locationSchema.safeParse(employee.location);
  if (!location.success) throw new Error("Choose a supported employee location before activating access.");
  if (isCentralApyTeamRole(role) && location.data !== "CENTRAL") {
    throw new Error("BDR and Social Media Specialist roles use the APY-wide location.");
  }
  const savedEmail = employee.email?.trim().toLowerCase() ?? "";
  const email = emailSchema.safeParse(savedEmail).success ? savedEmail : null;
  const phone = normalizeCanadianPhoneNumber(employee.phone ?? "");
  if (!email && !phone) throw new Error("Add a valid email address or phone number before activating login.");
  return { role, location: location.data, email, phone };
}
