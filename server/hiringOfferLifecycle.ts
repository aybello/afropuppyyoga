import crypto from "node:crypto";
import { and, desc, eq, gt, isNull, ne, sql } from "drizzle-orm";
import { employeeApplicationAssociations, employees, jobApplicationActions, jobApplications, signingTokens } from "../drizzle/schema";
import { canReuseSigningToken, detectOfferLetterType } from "./signingPolicy";
import { withStaffingMutationLock } from "./staffingMutationLock";
import { getPuppyMonitorOfferShiftPay, PUPPY_MONITOR_SHIFT_PAY_CAD } from "../shared/puppyMonitorTerms";
import { getMovementInstructorOfferHourlyPay, MOVEMENT_INSTRUCTOR_HOURLY_PAY_CAD } from "../shared/movementInstructorTerms";
import { getSocialMediaOfferStartHourlyPay, SOCIAL_MEDIA_INTERN_START_HOURLY_PAY_CAD } from "../shared/socialMediaTerms";
import { createOfferDocumentSnapshot } from "./offerDocumentSnapshot";
import { hasHiringOwnershipClaim, hasValidReviewedIdentity, reviewedHiringRecordHash } from "./hiringDuplicateIdentity";
import { employeeContactsMatch } from "./employeeProfileResolution";
import { normalizeCanadianPhoneNumber } from "../shared/phone";
import { signedOfferIdentityMatches } from "./signedOfferIdentity";
import { assertReviewedSigningLegacyClaims, hasLegacySigningOwnershipClaim } from "./reviewedSigningLegacyClaims";

const isSocialMediaOfferType = (type: string) => type === "social_media_intern" || type === "social_media_specialist";

/** Called only inside the staffing lock, shared with reviewed-association creation. */
async function assertUnclaimedApplicant(tx: any, applicationId: number) {
  const associations: Array<typeof employeeApplicationAssociations.$inferSelect> = await tx.select().from(employeeApplicationAssociations).for("update");
  const directory: Array<typeof employees.$inferSelect> = await tx.select().from(employees).for("update");
  const actions: Array<typeof jobApplicationActions.$inferSelect> = await tx.select().from(jobApplicationActions).where(eq(jobApplicationActions.action, "employee_added_after_signature")).for("update");
  if (hasHiringOwnershipClaim(new Set([applicationId]), directory, associations, actions)) {
    throw new Error("This application already belongs to an employee. Manage or restore access from Employee Directory.");
  }
}

/** Signing authority only, never hiring or access authority. Called with the staffing mutex held. */
async function reviewedSigningOwnership(tx: any, app: typeof jobApplications.$inferSelect): Promise<boolean> {
  const associations: Array<typeof employeeApplicationAssociations.$inferSelect> = await tx.select().from(employeeApplicationAssociations).for("update");
  const directory: Array<typeof employees.$inferSelect> = await tx.select().from(employees).for("update");
  const actions: Array<typeof jobApplicationActions.$inferSelect> = await tx.select().from(jobApplicationActions).where(eq(jobApplicationActions.action, "employee_added_after_signature")).for("update");
  const targets = associations.filter(entry => entry.applicationId === app.id);
  if (!targets.length) {
    if (directory.some(employee => employee.sourceApplicationId === app.id)
        || hasLegacySigningOwnershipClaim(actions, new Set([app.id]))) {
      throw new Error("This application already belongs to an employee. Manage or restore access from Employee Directory.");
    }
    return false;
  }
  const denied = () => new Error("This application already belongs to an employee; reviewed ownership could not be verified.");
  const validId = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
  if (targets.length !== 1 || app.status !== "accepted" || (app.isTeamMember !== false && (app.isTeamMember as unknown) !== 0)
      || app.deletedAt != null || app.onboardingDeliveryToken != null || !hasValidReviewedIdentity(app)) throw denied();
  const claim = targets[0];
  if (!validId(claim.employeeId) || !validId(claim.canonicalApplicationId) || claim.canonicalApplicationId === app.id
      || typeof claim.recordHash !== "string" || !/^[a-f0-9]{64}$/.test(claim.recordHash) || claim.recordHash !== reviewedHiringRecordHash(app)) throw denied();
  const owners = directory.filter(employee => employee.id === claim.employeeId);
  if (owners.length !== 1) throw denied();
  const owner = owners[0];
  if (owner.sourceApplicationId !== claim.canonicalApplicationId || owner.employmentStatus !== "active" || owner.endedAt != null
      || typeof owner.name !== "string" || !owner.name.trim() || typeof owner.role !== "string" || !owner.role.trim()
      || typeof owner.location !== "string" || !owner.location.trim()
      || (owner.email != null && typeof owner.email !== "string") || (owner.phone != null && typeof owner.phone !== "string")) throw denied();
  const profiles: Array<typeof jobApplications.$inferSelect> = await tx.select().from(jobApplications).for("update");
  const canonicalProfiles = profiles.filter(record => record.id === claim.canonicalApplicationId);
  if (canonicalProfiles.length !== 1) throw denied();
  const profile = canonicalProfiles[0];
  if (profile.id !== claim.canonicalApplicationId || profile.status !== "onboarded"
      || (profile.isTeamMember !== true && (profile.isTeamMember as unknown) !== 1) || profile.deletedAt != null
      || typeof profile.name !== "string" || !profile.name.trim()
      || typeof profile.role !== "string" || !profile.role.trim() || typeof profile.location !== "string" || !profile.location.trim()
      || !hasValidReviewedIdentity(profile) || !hasValidReviewedIdentity(owner)) throw denied();
  const sameIdentity = (left: typeof app, right: typeof app | typeof owner) =>
    left.name.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ") === right.name.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ")
    && left.email!.trim().toLowerCase() === right.email!.trim().toLowerCase()
    && normalizeCanadianPhoneNumber(left.phone!) === normalizeCanadianPhoneNumber(right.phone!);
  if (!sameIdentity(app, profile) || !sameIdentity(app, owner)) throw denied();
  // Canonical document delivery is independent of this historical offer. A
  // token cannot distinguish a legacy completion from a pending resend.
  if (directory.some(other => other.id !== owner.id && (other.sourceApplicationId === app.id || other.sourceApplicationId === profile.id
      || employeeContactsMatch(other, app) || employeeContactsMatch(other, profile) || employeeContactsMatch(other, owner)))) throw denied();
  const relevant = associations.filter(entry => entry.applicationId === app.id || entry.applicationId === profile.id
    || entry.employeeId === owner.id || entry.canonicalApplicationId === profile.id);
  const seen = new Set<number>();
  for (const entry of relevant) {
    if (!validId(entry.applicationId) || entry.employeeId !== owner.id || entry.canonicalApplicationId !== profile.id
        || seen.has(entry.applicationId) || typeof entry.recordHash !== "string" || !/^[a-f0-9]{64}$/.test(entry.recordHash)) throw denied();
    seen.add(entry.applicationId);
    if (associations.filter(other => other.applicationId === entry.applicationId).length !== 1) throw denied();
    if (directory.some(other => other.id !== owner.id && other.sourceApplicationId === entry.applicationId)) throw denied();
    // Check all linked records, even if a reassignment changed both contacts
    // and would therefore not appear in the contact-conflict scan below.
    // The canonical hash reflects its raw pre-onboarding identity, so only
    // noncanonical records must still match their durable raw hash.
    if (entry.applicationId !== profile.id) {
      const linkedProfiles = profiles.filter(record => record.id === entry.applicationId);
      if (linkedProfiles.length !== 1 || !hasValidReviewedIdentity(linkedProfiles[0])
          || !sameIdentity(linkedProfiles[0], app)
          || entry.recordHash !== reviewedHiringRecordHash(linkedProfiles[0])) throw denied();
    }
  }
  // Legacy evidence may only corroborate durable associations, never confer authority.
  assertReviewedSigningLegacyClaims(actions, associations, seen, owner.id, profile.id);
  // A single matching contact identifies a potential conflict, not a person.
  // Only a current exact identity with durable reviewed ownership may coexist.
  for (const candidate of profiles) {
    if (candidate.id === app.id || candidate.id === profile.id) continue;
    const rawMatch = (left: string | null, right: string | null) =>
      typeof left === "string" && typeof right === "string" && Boolean(left.trim()) && left.trim().toLowerCase() === right.trim().toLowerCase();
    if (!employeeContactsMatch(candidate, app) && !rawMatch(candidate.email, app.email) && !rawMatch(candidate.phone, app.phone)) continue;
    const inert = candidate.deletedAt != null && (candidate.isTeamMember === false || (candidate.isTeamMember as unknown) === 0)
      && candidate.status !== "onboarded" && !directory.some(other => other.sourceApplicationId === candidate.id)
      && !associations.some(entry => entry.applicationId === candidate.id)
      && !hasLegacySigningOwnershipClaim(actions, new Set([candidate.id]));
    if (inert) continue;
    const candidateClaims = associations.filter(entry => entry.applicationId === candidate.id);
    if (!hasValidReviewedIdentity(candidate) || !sameIdentity(candidate, app) || candidateClaims.length !== 1
        || candidateClaims[0].employeeId !== owner.id || candidateClaims[0].canonicalApplicationId !== profile.id
        || candidateClaims[0].recordHash !== reviewedHiringRecordHash(candidate)) throw denied();
  }
  return true;
}
function assertOpenApplicant(app: typeof jobApplications.$inferSelect | undefined) {
  if (!app || app.deletedAt) throw new Error("Application not found or archived.");
  if (app.status === "onboarded" || app.isTeamMember) throw new Error("This person is already an employee. Manage them in Employee Directory.");
  if (app.status === "rejected") throw new Error("This application is rejected. Review its status before sending an offer.");
  if (app.onboardingDeliveryToken) throw new Error("Resolve the pending onboarding delivery first.");
  if (!app.email) throw new Error("This applicant does not have an email address.");
  return { ...app, email: app.email };
}
export async function prepareHiringOffer(db: any, applicationId: number) {
  return withStaffingMutationLock(db, async (tx) => {
    const [record] = await tx.select().from(jobApplications).where(eq(jobApplications.id, applicationId)).limit(1);
    const applicant = assertOpenApplicant(record);
    const [latest] = await tx.select().from(signingTokens).where(eq(signingTokens.applicationId, applicationId))
      .orderBy(desc(signingTokens.createdAt), desc(signingTokens.id)).limit(1);
    await assertUnclaimedApplicant(tx, applicationId);
    if (latest?.signed === 1) throw new Error("This applicant has already signed their offer.");
    const offerLetterType = detectOfferLetterType(applicant.role, applicant.location);
    const tokenCanBeReused = canReuseSigningToken(latest ?? null, applicant);
    const isSocialMediaTemplateRepair = Boolean(
      tokenCanBeReused && latest && latest.offerLetterType !== offerLetterType &&
      (offerLetterType === "social_media_intern" || offerLetterType === "social_media_specialist") &&
      latest.offerLetterType.startsWith("puppy_monitor_")
    );
    const reuse = tokenCanBeReused &&
      (latest?.offerLetterType === offerLetterType || isSocialMediaTemplateRepair);
    const token = reuse ? latest.token : crypto.randomBytes(48).toString("hex");
    const expiresAt = reuse ? latest.expiresAt : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    if (isSocialMediaTemplateRepair) {
      const [repaired] = await tx.update(signingTokens).set({
        offerLetterType,
        puppyMonitorShiftPayCad: offerLetterType.startsWith("puppy_monitor_") ? PUPPY_MONITOR_SHIFT_PAY_CAD : null,
        movementInstructorHourlyPayCad: offerLetterType === "movement_instructor" ? MOVEMENT_INSTRUCTOR_HOURLY_PAY_CAD : null,
        socialMediaHourlyPayCad: isSocialMediaOfferType(offerLetterType) ? SOCIAL_MEDIA_INTERN_START_HOURLY_PAY_CAD : null,
      }).where(and(eq(signingTokens.id, latest.id), eq(signingTokens.signed, 0)));
      if (repaired.affectedRows !== 1) throw new Error("This unsigned offer changed. Please request a current signing link.");
    }
    if (!reuse) await tx.insert(signingTokens).values({ applicationId, applicantName: applicant.name, applicantEmail: applicant.email,
      role: applicant.role, location: applicant.location, offerLetterType,
      puppyMonitorShiftPayCad: offerLetterType.startsWith("puppy_monitor_") ? PUPPY_MONITOR_SHIFT_PAY_CAD : null,
      movementInstructorHourlyPayCad: offerLetterType === "movement_instructor" ? MOVEMENT_INSTRUCTOR_HOURLY_PAY_CAD : null,
      socialMediaHourlyPayCad: isSocialMediaOfferType(offerLetterType) ? SOCIAL_MEDIA_INTERN_START_HOURLY_PAY_CAD : null,
      token, signed: 0, expiresAt });
    return { applicant, reuse, token, expiresAt, offerLetterType };
  });
}
/** Serialize dispatch with association creation; preparation alone cannot authorize a later send. */
export async function withCurrentHiringOfferDelivery<T>(db: any, applicationId: number, token: string, expected: Pick<typeof jobApplications.$inferSelect, "name" | "email" | "phone" | "role" | "location">, deliver: () => Promise<T>): Promise<T> {
  return withStaffingMutationLock(db, async (tx) => {
    const [record] = await tx.select().from(jobApplications).where(eq(jobApplications.id, applicationId)).limit(1);
    const applicant = assertOpenApplicant(record);
    const [latest] = await tx.select().from(signingTokens).where(eq(signingTokens.applicationId, applicationId))
      .orderBy(desc(signingTokens.createdAt), desc(signingTokens.id)).limit(1);
    await assertUnclaimedApplicant(tx, applicationId);
    if (!latest || latest.token !== token || !canReuseSigningToken(latest, applicant)
      || (["name", "email", "phone", "role", "location"] as const).some(field => applicant[field] !== expected[field])) {
      throw new Error("This offer has been replaced, signed, or the applicant details changed. Refresh before sending.");
    }
    return deliver();
  });
}
export async function recordCurrentOfferSignature(db: any, token: string, signedName: string, signedIp: string, confirmedOfferLetterType: string | undefined, confirmedPuppyMonitorShiftPayCad?: number, confirmedMovementInstructorHourlyPayCad?: number, confirmedSocialMediaHourlyPayCad?: number, confirmedDocumentSha256?: string) {
  return withStaffingMutationLock(db, async (tx) => {
    const [record]: Array<typeof signingTokens.$inferSelect> = await tx.select().from(signingTokens).where(eq(signingTokens.token, token)).for("update");
    if (!record || record.token !== token || !(record.expiresAt instanceof Date) || !(record.expiresAt > new Date())) throw new Error("Invalid or expired signing link. Please contact AfroPuppyYoga.");
    if (record.signed === 1) throw new Error("These documents have already been signed.");
    if (record.signed !== 0) throw new Error("Invalid or expired signing link. Please contact AfroPuppyYoga.");
    if (record.offerLetterType !== confirmedOfferLetterType) {
      throw new Error("Please refresh this signing page and review the current Offer Letter before signing.");
    }
    const snapshot = createOfferDocumentSnapshot(record);
    // The public router requires the digest. Optional only for existing internal callers.
    if (confirmedDocumentSha256 !== undefined && confirmedDocumentSha256 !== snapshot.sha256) {
      throw new Error("Please refresh this signing page and review the current documents before signing.");
    }
    if (record.offerLetterType?.startsWith("puppy_monitor_")) {
      const savedPayment = getPuppyMonitorOfferShiftPay(record.puppyMonitorShiftPayCad);
      if ((savedPayment === 60 && confirmedPuppyMonitorShiftPayCad !== savedPayment) ||
          (confirmedPuppyMonitorShiftPayCad !== undefined && confirmedPuppyMonitorShiftPayCad !== savedPayment)) {
        throw new Error("Please refresh this signing page and review the current Puppy Monitor payment before signing.");
      }
    }
    if (record.offerLetterType === "movement_instructor") {
      const savedPayment = getMovementInstructorOfferHourlyPay(record.movementInstructorHourlyPayCad);
      if ((savedPayment === 22 && confirmedMovementInstructorHourlyPayCad !== savedPayment) ||
          (confirmedMovementInstructorHourlyPayCad !== undefined && confirmedMovementInstructorHourlyPayCad !== savedPayment)) {
        throw new Error("Please refresh this signing page and review the current Movement Instructor payment before signing.");
      }
    }
    if (isSocialMediaOfferType(record.offerLetterType ?? "")) {
      const savedPayment = getSocialMediaOfferStartHourlyPay(record.socialMediaHourlyPayCad);
      if ((savedPayment !== null && confirmedSocialMediaHourlyPayCad !== savedPayment) ||
          (confirmedSocialMediaHourlyPayCad !== undefined && confirmedSocialMediaHourlyPayCad !== savedPayment)) {
        throw new Error("Please refresh this signing page and review the current compensation before signing.");
      }
    }
    const [appRecord] = await tx.select().from(jobApplications).where(eq(jobApplications.id, record.applicationId)).for("update");
    const app = assertOpenApplicant(appRecord);
    const applicationOffers: Array<typeof signingTokens.$inferSelect> = await tx.select().from(signingTokens).where(eq(signingTokens.applicationId, record.applicationId))
      .orderBy(desc(signingTokens.createdAt), desc(signingTokens.id)).for("update");
    const associated = await reviewedSigningOwnership(tx, app);
    const latest = applicationOffers[0];
    if (app.id !== record.applicationId || latest?.id !== record.id || !canReuseSigningToken(record, app)) throw new Error("This offer has been replaced or the applicant details changed. Please request the current signing link.");
    if (associated && applicationOffers.some(offer => offer.signed === 1 && !signedOfferIdentityMatches(offer, app))) {
      throw new Error("This application already belongs to an employee; reviewed ownership could not be verified.");
    }
    if (associated && (confirmedDocumentSha256 !== snapshot.sha256 || detectOfferLetterType(app.role, app.location) !== record.offerLetterType
        || (!record.offerLetterType.startsWith("puppy_monitor_") && record.puppyMonitorShiftPayCad != null)
        || (record.offerLetterType !== "movement_instructor" && record.movementInstructorHourlyPayCad != null)
        || (!isSocialMediaOfferType(record.offerLetterType) && record.socialMediaHourlyPayCad != null)
        || record.signedDocumentSnapshot != null || record.signedName != null || record.signedAt != null || record.signedIp != null)) {
      throw new Error("Please refresh this signing page and review the current documents before signing.");
    }
    if (!associated) {
      const [changed] = await tx.update(jobApplications).set({ status: "accepted" }).where(and(
        eq(jobApplications.id, app.id), ne(jobApplications.status, "onboarded"), ne(jobApplications.status, "rejected"),
        eq(jobApplications.isTeamMember, false), isNull(jobApplications.deletedAt), isNull(jobApplications.onboardingDeliveryToken)));
      if (changed.affectedRows !== 1) throw new Error("This application changed. Please request a current signing link.");
    }
    const [signature] = await tx.update(signingTokens).set({ signed: 1, signedName, signedIp, signedAt: new Date(), signedDocumentSnapshot: JSON.stringify(snapshot) }).where(and(
      eq(signingTokens.id, record.id), eq(signingTokens.applicationId, record.applicationId), eq(signingTokens.signed, 0),
      sql`BINARY ${signingTokens.token} = BINARY ${token}`, gt(signingTokens.expiresAt, sql`CURRENT_TIMESTAMP(3)`)));
    if (signature.affectedRows !== 1) throw new Error("This offer changed. Please refresh the signing page.");
    if (associated) {
      await tx.insert(jobApplicationActions).values({
        applicationId: record.applicationId,
        action: "offer_signed",
        fromStatus: "accepted",
        toStatus: "accepted",
        actorName: signedName,
        details: JSON.stringify({ signingTokenId: record.id, signedIp }),
      });
    }
    // This marker stays server-internal; communications are attempted after commit.
    return { ...record, associatedAuditRecorded: associated };
  });
}
