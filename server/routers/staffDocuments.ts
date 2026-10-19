import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { signingTokens } from "../../drizzle/schema";
import { getDb, getSigningTokenByToken } from "../db";
import { router, publicProcedure, teamMemberProcedure } from "../_core/trpc";
import { getMySignedOfferApplicationIds } from "../mySignedOfferOwnership";
import { buildSignedOfferPdf } from "../signedOfferPdf";

function validSignature(record: { signed: number; signedName: string | null; signedAt: Date | null }) {
  return record.signed === 1 && Boolean(record.signedName?.trim()) && Boolean(record.signedAt && Number.isFinite(new Date(record.signedAt).getTime()));
}
async function download(record: typeof signingTokens.$inferSelect) {
  if (!validSignature(record)) throw new TRPCError({ code: "NOT_FOUND", message: "No signed document is available." });
  const pdf = await buildSignedOfferPdf(record);
  // No names or user-controlled values in the attachment filename.
  return { filename: `APY-signed-offer-and-NDA-${record.id}.pdf`, base64: pdf.toString("base64"), mimeType: "application/pdf" as const };
}
export const staffDocumentsRouter = router({
  mySignedOffers: teamMemberProcedure.query(async ({ ctx }) => {
    ctx.res.setHeader("Cache-Control", "private, no-store");
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const ids = await getMySignedOfferApplicationIds(db, ctx.user, ctx.apyAccess);
    if (!ids.length) return [];
    const records = await db.select().from(signingTokens).where(and(inArray(signingTokens.applicationId, ids), eq(signingTokens.signed, 1)))
      .orderBy(desc(signingTokens.signedAt), desc(signingTokens.id));
    return records.filter(validSignature).map(record => ({
      id: record.id, role: record.role, location: record.location, signedAt: record.signedAt,
      signedName: record.signedName, hasOriginalSnapshot: Boolean(record.signedDocumentSnapshot),
    }));
  }),
  downloadMySignedOffer: teamMemberProcedure.input(z.object({ id: z.number().int().positive() }).strict()).mutation(async ({ ctx, input }) => {
    ctx.res.setHeader("Cache-Control", "private, no-store");
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const ids = await getMySignedOfferApplicationIds(db, ctx.user, ctx.apyAccess);
    if (!ids.length) throw new TRPCError({ code: "NOT_FOUND", message: "No signed document is available." });
    const [record] = await db.select().from(signingTokens).where(and(eq(signingTokens.id, input.id),
      inArray(signingTokens.applicationId, ids), eq(signingTokens.signed, 1))).limit(1);
    if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "No signed document is available." });
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
