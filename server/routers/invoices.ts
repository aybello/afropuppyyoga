import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { ownerProcedure, teamMemberProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { createInvoice, deleteInvoice, getAllInvoices, getDb, getInvoiceById, updateInvoice } from "../db";
import { storageGet } from "../storage";
import { invoices } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export const invoicesRouter = router({
  /**
   * Staff submits an invoice PDF.
   * The PDF is uploaded first via POST /api/upload-invoice (multipart).
   * This procedure receives the resulting S3 key and runs AI extraction.
   *
   * Security (Priority 3): Only accepts a storage key that begins with 'invoices/'.
   * The presigned URL is resolved server-side — the client never supplies a URL.
   * This prevents SSRF: an attacker cannot point the AI extractor at an arbitrary URL.
   */
  submit: teamMemberProcedure
    .input(
      z.object({
        // Storage key from /api/upload-invoice — must start with 'invoices/'
        fileKey: z.string().regex(/^invoices\/[a-f0-9]{64}-[^/]+\.pdf$/i, "Invalid invoice key"),
        filename: z.string().max(255),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Resolve the presigned URL server-side — never trust a client-supplied URL
      const { url: fileUrl } = await storageGet(input.fileKey);
      const fileSha256 = input.fileKey.match(/^invoices\/([a-f0-9]{64})-/i)?.[1]?.toLowerCase();
      if (!fileSha256) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid invoice upload." });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [duplicate] = await db.select({ id: invoices.id }).from(invoices).where(eq(invoices.fileSha256, fileSha256)).limit(1);
      if (duplicate) throw new TRPCError({ code: "CONFLICT", message: `This PDF was already submitted as invoice #${duplicate.id}.` });

      // Phase 7 (security hardening): createInvoice now returns the inserted row ID directly
      // (via MySQL insertId), eliminating the race condition where getAllInvoices()[0] could
      // return a different row inserted by a concurrent request.
      const invoiceId = await createInvoice({
        fileUrl,
        fileKey: input.fileKey,
        fileSha256,
        originalFilename: input.filename,
        extractionStatus: "pending",
        status: "pending",
        workflowStatus: "submitted",
        submittedByUserId: ctx.user.id,
        submittedByName: ctx.user.name,
        submittedByEmail: ctx.user.email,
      });

      // Run AI extraction asynchronously (fire and forget with error handling)
      extractInvoiceData(invoiceId, fileUrl, null).catch((err) => {
        console.error("[Invoice] Extraction failed for invoice", invoiceId, err);
      });

      return { success: true, invoiceId };
    }),

  /**
   * Owner-only: get all invoices with computed daysLeft
   */
  list: ownerProcedure.query(async () => {
    const invoiceList = await getAllInvoices();
    const now = new Date();

    return invoiceList.map((inv) => {
      let daysLeft: number | null = null;
      let urgency: "overdue" | "urgent" | "soon" | "ok" | "unknown" = "unknown";

      if (inv.dueDate) {
        const diff = inv.dueDate.getTime() - now.getTime();
        daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));

        if (daysLeft < 0) urgency = "overdue";
        else if (daysLeft <= 3) urgency = "urgent";
        else if (daysLeft <= 7) urgency = "soon";
        else urgency = "ok";
      }

      return {
        ...inv,
        daysLeft,
        urgency,
      };
    });
  }),

  /**
   * Owner-only: mark invoice as paid or pending
   */
  review: ownerProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
    const invoice = await getInvoiceById(input.id);
    if (!invoice || invoice.deletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
    if (invoice.workflowStatus !== "submitted") throw new TRPCError({ code: "CONFLICT", message: "Only submitted invoices can be reviewed." });
    await updateInvoice(input.id, { workflowStatus: "reviewed", reviewedByUserId: ctx.user.id, reviewedAt: new Date() });
    return { success: true };
  }),

  approve: ownerProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
    const invoice = await getInvoiceById(input.id);
    if (!invoice || invoice.deletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
    if (invoice.workflowStatus !== "reviewed") throw new TRPCError({ code: "CONFLICT", message: "Review the invoice before approving it." });
    if (!invoice.totalAmountCents || invoice.totalAmountCents <= 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Confirm a valid invoice total before approval." });
    await updateInvoice(input.id, { workflowStatus: "approved", approvedByUserId: ctx.user.id, approvedAt: new Date() });
    return { success: true };
  }),

  /**
   * Owner-only: record a payment (full or partial) against an invoice.
   * amountPaidCents is the NEW total paid so far (cumulative), not the incremental amount.
   */
  recordPayment: ownerProcedure
    .input(
      z.object({
        id: z.number(),
        /** Total amount paid so far in cents (cumulative) */
        amountPaidCents: z.number().int().min(0),
        /** Optional note about this payment */
        paymentNotes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const invoice = await getInvoiceById(input.id);
      if (!invoice || invoice.deletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      if (invoice.workflowStatus !== "approved" && invoice.workflowStatus !== "paid") throw new TRPCError({ code: "CONFLICT", message: "Approve the invoice before recording payment." });
      const totalAmountCents = invoice.totalAmountCents;
      if (!totalAmountCents || totalAmountCents <= 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Invoice total is missing." });
      if (input.amountPaidCents > totalAmountCents) throw new TRPCError({ code: "BAD_REQUEST", message: "Payment cannot exceed the invoice total." });
      // Auto-determine status based on paid vs total
      let status: "pending" | "partial" | "paid" | "overdue" = "partial";
      if (input.amountPaidCents <= 0) {
        status = "pending";
      } else if (input.amountPaidCents >= totalAmountCents) {
        status = "paid";
      } else {
        status = "partial";
      }

      await updateInvoice(input.id, {
        amountPaidCents: input.amountPaidCents,
        paymentNotes: input.paymentNotes,
        status,
        workflowStatus: status === "paid" ? "paid" : "approved",
        paidByUserId: status === "paid" ? ctx.user.id : null,
        paidAt: status === "paid" ? new Date() : null,
      });
      return { success: true, status };
    }),

  /**
   * Owner-only: delete an invoice
   */
  archive: ownerProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteInvoice(input.id);
      return { success: true };
    }),
});

/**
 * Uses LLM to extract invoice data from the PDF URL.
 * Sends the PDF as a file_url to the multimodal LLM.
 */
async function extractInvoiceData(invoiceId: number, fileUrl: string, _buffer: Buffer | null) {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are an invoice data extraction assistant. Extract the following fields from the invoice PDF:
- staffName: The name of the person submitting the invoice (the payee/contractor)
- position: Their job title or role (e.g. "Yoga Instructor", "Photographer", "Event Staff")
- payAmount: The total amount to be paid (include currency symbol, e.g. "$250.00" or "CAD 300")
- dueDate: The payment due date in ISO 8601 format (YYYY-MM-DD). If not explicitly stated, look for "due by", "payment due", "net 30" etc.

Return ONLY valid JSON with these exact keys. If a field cannot be found, use null.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Please extract the invoice data from this PDF:",
            },
            {
              type: "file_url",
              file_url: {
                url: fileUrl,
                mime_type: "application/pdf",
              },
            },
          ] as any,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "invoice_data",
          strict: true,
          schema: {
            type: "object",
            properties: {
              staffName: { type: ["string", "null"], description: "Name of the payee" },
              position: { type: ["string", "null"], description: "Job title or role" },
              payAmount: { type: ["string", "null"], description: "Total amount due with currency" },
              dueDate: { type: ["string", "null"], description: "Payment due date in YYYY-MM-DD format" },
            },
            required: ["staffName", "position", "payAmount", "dueDate"],
            additionalProperties: false,
          },
        },
      },
    });

    const rawContent = response.choices?.[0]?.message?.content;
    if (!rawContent) throw new Error("No content from LLM");
    const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);

    const extracted = JSON.parse(content);

    const amountText = extracted.payAmount ? String(extracted.payAmount) : "";
    const parsedAmount = Number.parseFloat(amountText.replace(/[^0-9.]/g, ""));
    const totalAmountCents = Number.isFinite(parsedAmount) ? Math.round(parsedAmount * 100) : null;
    await updateInvoice(invoiceId, {
      staffName: extracted.staffName ?? undefined,
      position: extracted.position ?? undefined,
      payAmount: extracted.payAmount ?? undefined,
      totalAmountCents,
      dueDate: extracted.dueDate ? new Date(extracted.dueDate) : undefined,
      extractionStatus: "completed",
      extractedData: content,
    });
  } catch (err) {
    console.error("[Invoice] LLM extraction error:", err);
    await updateInvoice(invoiceId, { extractionStatus: "failed" });
  }
}
