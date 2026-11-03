import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { normalizeCanadianPhoneNumber } from "../shared/phone";
import { employeeContactsMatch } from "./employeeProfileResolution";

type Identity = { name: string; email: string | null; phone: string | null };
type Application = Identity & { id: number; role: string; location: string; status: string; isTeamMember: boolean; deletedAt: unknown; onboardingDeliveryToken?: string | null };
type Employee = Identity & { id: number; sourceApplicationId: number | null; employmentStatus: string; role?: string; location?: string };
const emailSchema = z.string().email().max(320);
const nameOf = (name: string) => name.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
const emailOf = (email: string | null) => {
  const value = email?.trim().toLowerCase() ?? "";
  return emailSchema.safeParse(value).success ? value : null;
};
const phoneOf = (phone: string | null) => {
  const value = phone?.trim() ?? "";
  return /^\+?[\d\s().-]+$/.test(value) ? normalizeCanadianPhoneNumber(value) : null;
};
const rawContactMatch = (left: Identity, right: Identity) => employeeContactsMatch(left, right)
  || Boolean(left.email?.trim() && left.email.trim().toLowerCase() === right.email?.trim().toLowerCase())
  || Boolean(left.phone?.trim() && left.phone.trim().toLowerCase() === right.phone?.trim().toLowerCase());
const view = (app: Application, directory: Employee[]) => ({
  id: app.id, name: app.name, email: app.email, phone: app.phone, role: app.role, location: app.location,
  status: app.status, isTeamMember: app.isTeamMember, deletedAt: app.deletedAt ?? null,
  directoryOwnerIds: directory.filter((employee) => employee.sourceApplicationId === app.id).map((employee) => employee.id).sort((a, b) => a - b),
});
const sha = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
/** Durable evidence binds identity only; access and ownership are checked separately at use. */
export function reviewedHiringRecordHash(record: Identity & { id: number }) {
  return sha({ version: 2, record: { id: record.id, name: record.name, email: record.email, phone: record.phone } });
}
export function hasValidReviewedIdentity(record: Identity) {
  return Boolean(typeof record.name === "string" && nameOf(record.name)
    && typeof record.email === "string" && emailOf(record.email)
    && typeof record.phone === "string" && phoneOf(record.phone));
}
/** Archived inert applicants are not conflicts unless linked to an employee. */
export function inspectHiringDuplicates(app: Application, profiles: Application[], directory: Employee[]) {
  const conflicts = profiles.filter((profile) => profile.id !== app.id && rawContactMatch(app, profile)
    && (profile.deletedAt == null || !(profile.isTeamMember === false || (profile.isTeamMember as unknown) === 0)
      || profile.status === "onboarded" || directory.some((employee) => employee.sourceApplicationId === profile.id)))
    .sort((a, b) => a.id - b.id).map((profile) => view(profile, directory));
  const name = nameOf(app.name), email = emailOf(app.email), phone = phoneOf(app.phone);
  const canReview = Boolean(conflicts.length && name && email && phone && conflicts.every((p) =>
    nameOf(p.name) === name && emailOf(p.email) === email && phoneOf(p.phone) === phone
    && (p.isTeamMember === false || (p.isTeamMember as unknown) === 0) && p.status !== "onboarded" && p.directoryOwnerIds.length === 0));
  return { selected: view(app, directory), conflicts, canReview };
}
/** Bind reviewed state, latest offer and relevant directory ownership and contacts. */
export function hiringReviewSnapshot(app: Application, offer: unknown, profiles: Application[], directory: Employee[]) {
  const inspection = inspectHiringDuplicates(app, profiles, directory);
  const ids = new Set([app.id, ...inspection.conflicts.map((p) => p.id)]);
  const owners = directory.filter((employee) => (employee.sourceApplicationId !== null && ids.has(employee.sourceApplicationId)) || rawContactMatch(app, employee))
    .sort((a, b) => a.id - b.id).map((employee) => ({ id: employee.id, sourceApplicationId: employee.sourceApplicationId,
      name: employee.name, email: employee.email, phone: employee.phone, role: employee.role ?? null,
      location: employee.location ?? null, employmentStatus: employee.employmentStatus }));
  return { version: 1, selected: inspection.selected, onboardingDeliveryToken: app.onboardingDeliveryToken ?? null, offer, conflicts: inspection.conflicts, owners };
}
export function hiringReviewEvidence(snapshot: ReturnType<typeof hiringReviewSnapshot>, employeeId: number) {
  return { version: 2, canonicalApplicationId: snapshot.selected.id, employeeId,
    reviewed: snapshot.conflicts.map((record) => ({ applicationId: record.id, recordHash: reviewedHiringRecordHash(record) })) };
}
function secret() {
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error("Duplicate review is unavailable because the signing secret is not configured.");
  return value;
}
function signature(body: string) { return createHmac("sha256", secret()).update(`apy-hiring-review-v1.${body}`).digest("base64url"); }
/** Token contains no applicant data; only a digest of the complete snapshot. */
export function issueHiringReviewToken(actorId: number, snapshot: ReturnType<typeof hiringReviewSnapshot>) {
  const body = Buffer.from(JSON.stringify({ v: 1, actorId, applicationId: snapshot.selected.id, digest: sha(snapshot), exp: Math.floor(Date.now() / 1000) + 600 })).toString("base64url");
  return `${body}.${signature(body)}`;
}
export function verifyHiringReviewToken(token: string, actorId: number, snapshot: ReturnType<typeof hiringReviewSnapshot>) {
  try {
    const [body, sig, extra] = token.split(".");
    if (!body || !sig || extra || !/^[A-Za-z0-9_-]+$/.test(sig)) return false;
    const actual = Buffer.from(sig, "ascii"), expected = Buffer.from(signature(body), "ascii");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return payload.v === 1 && payload.actorId === actorId && payload.applicationId === snapshot.selected.id
      && Number.isSafeInteger(payload.exp) && payload.exp > Math.floor(Date.now() / 1000)
      && payload.digest === sha(snapshot);
  } catch { return false; }
}
