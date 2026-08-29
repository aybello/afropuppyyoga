import { and, eq, isNull } from "drizzle-orm";
import { jobApplications, type User } from "../drizzle/schema";
import { getApyAccessLevel, type ApyAccessLevel, canManageOperations } from "../shared/apyPermissions";
import { normalizeCanadianPhoneNumber } from "../shared/phone";
import { getDb } from "./db";
import { isActiveTeamMember } from "./teamMembership";

export type ApyTeamMember = {
  id: number;
  name: string;
  role: string;
  location: string;
  email: string | null;
  phone: string | null;
};

export type ApyAccess = {
  level: ApyAccessLevel;
  teamMember: ApyTeamMember | null;
  canManageOperations: boolean;
};

type TeamEmailCandidate = {
  isTeamMember: boolean | number | null;
  status: string;
  deletedAt?: unknown;
  email: string | null;
};

const noAccess = (): ApyAccess => ({ level: "none", teamMember: null, canManageOperations: false });

function phoneFromStaffIdentity(openId: string): string | null {
  const marker = "staff-phone:";
  return openId.startsWith(marker) ? normalizeCanadianPhoneNumber(openId.slice(marker.length)) : null;
}

function toTeamMember(person: typeof jobApplications.$inferSelect): ApyTeamMember {
  return { id: person.id, name: person.name, role: person.role, location: person.location, email: person.email ?? null, phone: person.phone ?? null };
}

async function getActiveTeamCandidates() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db.select().from(jobApplications).where(and(eq(jobApplications.isTeamMember, true), isNull(jobApplications.deletedAt)));
}

/** Selects only a manually managed, active APY HQ team member for an email invite. */
export function findActiveTeamEmailCandidate<T extends TeamEmailCandidate>(candidates: T[], email: string): T | null {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return null;
  return candidates.find((person) => isActiveTeamMember(person) && person.email?.trim().toLowerCase() === normalizedEmail) ?? null;
}

export async function findActiveTeamMemberByPhone(phone: string): Promise<ApyTeamMember | null> {
  const normalizedPhone = normalizeCanadianPhoneNumber(phone);
  if (!normalizedPhone) return null;
  const candidates = await getActiveTeamCandidates();
  const match = candidates.find((person) => isActiveTeamMember(person) && normalizeCanadianPhoneNumber(person.phone ?? "") === normalizedPhone);
  return match ? toTeamMember(match) : null;
}

export async function findActiveTeamMemberByEmail(email: string): Promise<ApyTeamMember | null> {
  const candidates = await getActiveTeamCandidates();
  const match = findActiveTeamEmailCandidate(candidates, email);
  return match ? toTeamMember(match) : null;
}

export async function resolveApyAccess(user: User | null): Promise<ApyAccess> {
  if (!user) return noAccess();
  if (user.role === "admin") return { level: "owner", teamMember: null, canManageOperations: true };

  const email = user.email?.trim().toLowerCase() ?? null;
  const phone = phoneFromStaffIdentity(user.openId);
  if (!email && !phone) return noAccess();

  const candidates = await getActiveTeamCandidates();
  const member = candidates.find((person) => {
    if (!isActiveTeamMember(person)) return false;
    const emailMatches = Boolean(email && person.email?.trim().toLowerCase() === email);
    const phoneMatches = Boolean(phone && normalizeCanadianPhoneNumber(person.phone ?? "") === phone);
    return emailMatches || phoneMatches;
  });

  if (!member) return noAccess();
  const level = getApyAccessLevel(member.role);
  return { level, teamMember: toTeamMember(member), canManageOperations: canManageOperations(level) };
}
