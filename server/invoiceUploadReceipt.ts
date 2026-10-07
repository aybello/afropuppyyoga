import { SignJWT, jwtVerify } from "jose";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

export const INVOICE_FILE_KEY = /^invoices\/[a-f0-9]{64}-[a-f0-9]{32}\.pdf$/;
export const invoiceContactSchema = z.object({
  submitterName: z.string().trim().min(2, "Enter your full name.").max(255),
  submitterEmail: z.string().trim().email("Enter a valid email address.").max(320).transform(value => value.toLowerCase()),
  website: z.string().max(0, "Invalid submission.").optional(),
});
const receiptSchema = invoiceContactSchema.omit({ website: true }).extend({
  fileKey: z.string().regex(INVOICE_FILE_KEY),
  filename: z.string().min(1).max(255),
});
export type InvoiceUploadReceipt = z.infer<typeof receiptSchema>;
const ISSUER = "apy-invoice-upload";
const AUDIENCE = "apy-invoice-submit";

function signingKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Invoice upload signing is not configured");
  return new TextEncoder().encode(secret);
}

export async function createInvoiceUploadReceipt(input: InvoiceUploadReceipt) {
  const details = receiptSchema.parse(input);
  return new SignJWT(details).setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER).setAudience(AUDIENCE).setIssuedAt().setExpirationTime("1h").sign(signingKey());
}

export async function verifyInvoiceUploadReceipt(token: string): Promise<InvoiceUploadReceipt> {
  try {
    const { payload } = await jwtVerify(token, signingKey(), { algorithms: ["HS256"], issuer: ISSUER, audience: AUDIENCE, maxTokenAge: "1h" });
    return receiptSchema.parse(payload);
  } catch {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Your upload has expired or is invalid. Please upload the PDF again." });
  }
}
