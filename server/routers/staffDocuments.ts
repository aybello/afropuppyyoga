import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { signingTokens, users, type User } from "../../drizzle/schema";
import { getDb, getSigningTokenByToken } from "../db";
import { router, publicProcedure, teamMemberProcedure } from "../_core/trpc";
import { filterGuardedSignedOffers, getMySignedOfferApplicationIds } from "../mySignedOfferOwnership";
import { buildSignedOfferPdf } from "../signedOfferPdf";
import type { ApyAccess } from "../apyAccess";
import { withStaffingMutationLock } from "../staffingMutationLock";

function validSignature(record: { signed: number; signedName: string | null; signedAt: Date | null }) {
  return record.signed === 1 && Boolean(record.signedName?.trim()) && Boolean(record.signedAt && Number.isFinite(new Date(record.signedAt).getTime()));
}
function matchesReviewedIdentity(record: typeof signingTokens.$inferSelect, identities: Map<number, { name: string; email: string }>) {
  const expected = identities.get(record.applicationId);
  if (!expected) return true; // canonical and legacy ownership retain their prior policy
  const normalizeName = (value: string) => value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
  return typeof record.applicantName === "string" && typeof record.applicantEmail === "string"
    && normalizeName(record.applicantName) === normalizeName(expected.name)
    && record.applicantEmail.trim().toLowerCase() === expected.email.trim().toLowerCase();
}
async function download(record: typeof signingTokens.$inferSelect) {
  if (!validSignature(record)) throw new TRPCError({ code: "NOT_FOUND", message: "No signed document is available." });
  const pdf = await buildSignedOfferPdf(record);
  // No names or user-controlled values in the attachment filename.
  return { filename: `APY-signed-offer-and-NDA-${record.id}.pdf`, base64: pdf.toString("base64"), mimeType: "application/pdf" as const };
}

async function withMySignedOfferRead<T>(
  user: User,
  access: ApyAccess,
  select: (tx: any, ids: number[], identities: Map<number, { name: string; email: string }>, guardedReviewedIds: Set<number>) => Promise<T>,
) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return withStaffingMutationLock(db, async tx => {
    const identities = new Map<number, { name: string; email: string }>();
    const guardedReviewedIds = new Set<number>();
    let currentUser = user;
    if (access.teamMember) {
      // Middleware ran before this transaction. Re-read the authenticated login,
      // not its cached contacts, and never turn a role change into owner access.
      const [freshUser] = await tx.select().from(users).where(and(eq(users.id, user.id), eq(users.openId, user.openId))).limit(1);
      if (!freshUser || freshUser.role !== user.role || freshUser.role === "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Unable to verify ownership of signed offer documents." });
      }
      currentUser = freshUser;
    }
    // This helper revalidates the unique active canonical member, its current
    // role and ownership claims on the same handle as the document read below.
    // The mutex serializes cooperating staffing writers; it cannot protect
    // against out-of-band SQL or revoke bytes already selected/returned.
    const ids = await getMySignedOfferApplicationIds(tx, currentUser, access, identities, guardedReviewedIds);
    return select(tx, ids, identities, guardedReviewedIds);
  });
}

export const staffDocumentsRouter = router({
  mySignedOffers: teamMemberProcedure.query(async ({ ctx }) => {
    ctx.res.setHeader("Cache-Control", "private, no-store");
    return withMySignedOfferRead(ctx.user, ctx.apyAccess, async (tx, ids, identities, guardedReviewedIds) => {
      if (!ids.length) return [];
      const records: Array<typeof signingTokens.$inferSelect> = await tx.select().from(signingTokens).where(and(inArray(signingTokens.applicationId, ids), eq(signingTokens.signed, 1)))
        .orderBy(desc(signingTokens.signedAt), desc(signingTokens.id));
      const guarded = await filterGuardedSignedOffers(tx, records, guardedReviewedIds);
      return guarded.filter(record => validSignature(record) && matchesReviewedIdentity(record, identities)).map(record => ({
        id: record.id, role: record.role, location: record.location, signedAt: record.signedAt,
        signedName: record.signedName, hasOriginalSnapshot: Boolean(record.signedDocumentSnapshot),
      }));
    });
  }),
  downloadMySignedOffer: teamMemberProcedure.input(z.object({ id: z.number().int().positive() }).strict()).mutation(async ({ ctx, input }) => {
    ctx.res.setHeader("Cache-Control", "private, no-store");
    const record = await withMySignedOfferRead(ctx.user, ctx.apyAccess, async (tx, ids, identities, guardedReviewedIds) => {
      if (!ids.length) throw new TRPCError({ code: "NOT_FOUND", message: "No signed document is available." });
      const [selected]: Array<typeof signingTokens.$inferSelect> = await tx.select().from(signingTokens).where(and(eq(signingTokens.id, input.id),
        inArray(signingTokens.applicationId, ids), eq(signingTokens.signed, 1))).limit(1);
      if (!selected || !validSignature(selected) || !matchesReviewedIdentity(selected, identities)
          || !(await filterGuardedSignedOffers(tx, [selected], guardedReviewedIds)).length) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No signed document is available." });
      }
      // No further database reads during PDF generation. Detach dates as well
      // as scalar fields before releasing the lock; freeze the selected values.
      return Object.freeze(structuredClone(selected));
    });
    return download(record);
  }),
  // Same bearer proof and seven-day expiry as the existing signing page, never an ID-only public download.
  downloadFromSigningLink: publicProcedure.input(z.object({ token: z.string().min(32).max(128) }).strict()).mutation(async ({ ctx, input }) => {
    ctx.res.setHeader("Cache-Control", "private, no-store");
    const record = await getSigningTokenByToken(input.token);
    if (!record || new Date(record.expiresAt) < new Date()) {
      throw new TRPCError({ code: "NOT_FOUND", message: "This signing link is unavailable. Sign in to APY HQ to access your documents." });
    }
    return download(record);
  }),
});
