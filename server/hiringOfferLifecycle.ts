import crypto from "node:crypto";
import { and, desc, eq, isNull, ne } from "drizzle-orm";
import { jobApplications, signingTokens } from "../drizzle/schema";
import { canReuseSigningToken, detectOfferLetterType } from "./signingPolicy";
import { withStaffingMutationLock } from "./staffingMutationLock";

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
    if (latest?.signed === 1) throw new Error("This applicant has already signed their offer.");
    const reuse = canReuseSigningToken(latest ?? null, applicant);
    const token = reuse ? latest.token : crypto.randomBytes(48).toString("hex");
    const expiresAt = reuse ? latest.expiresAt : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const offerLetterType = detectOfferLetterType(applicant.role, applicant.location);
    if (!reuse) await tx.insert(signingTokens).values({ applicationId, applicantName: applicant.name, applicantEmail: applicant.email,
      role: applicant.role, location: applicant.location, offerLetterType, token, signed: 0, expiresAt });
    return { applicant, reuse, token, expiresAt, offerLetterType };
  });
}
export async function recordCurrentOfferSignature(db: any, token: string, signedName: string, signedIp: string) {
  return withStaffingMutationLock(db, async (tx) => {
    const [record]: Array<typeof signingTokens.$inferSelect> = await tx.select().from(signingTokens).where(eq(signingTokens.token, token)).limit(1);
    if (!record || record.expiresAt < new Date()) throw new Error("Invalid or expired signing link. Please contact AfroPuppyYoga.");
    if (record.signed === 1) throw new Error("These documents have already been signed.");
    const [appRecord] = await tx.select().from(jobApplications).where(eq(jobApplications.id, record.applicationId)).limit(1);
    const app = assertOpenApplicant(appRecord);
    const [latest] = await tx.select().from(signingTokens).where(eq(signingTokens.applicationId, record.applicationId))
      .orderBy(desc(signingTokens.createdAt), desc(signingTokens.id)).limit(1);
    if (latest?.id !== record.id || !canReuseSigningToken(record, app)) throw new Error("This offer has been replaced or the applicant details changed. Please request the current signing link.");
    const [changed] = await tx.update(jobApplications).set({ status: "accepted" }).where(and(
      eq(jobApplications.id, app.id), ne(jobApplications.status, "onboarded"), ne(jobApplications.status, "rejected"),
      eq(jobApplications.isTeamMember, false), isNull(jobApplications.deletedAt), isNull(jobApplications.onboardingDeliveryToken)));
    if (changed.affectedRows !== 1) throw new Error("This application changed. Please request a current signing link.");
    await tx.update(signingTokens).set({ signed: 1, signedName, signedIp, signedAt: new Date() }).where(and(eq(signingTokens.id, record.id), eq(signingTokens.signed, 0)));
    return record;
  });
}
