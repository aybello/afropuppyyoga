import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { storagePut } from "../storage";
import { createInvoice, deleteInvoice, getAllInvoices, updateInvoice } from "../db";

function randomSuffix() {
  return Math.random().toString(36).substring(2, 10);
}

export const invoicesRouter = router({
  /**
   * Staff submits an invoice PDF.
   * Accepts base64-encoded PDF, uploads to S3, then runs AI extraction.
   * Public so staff don't need to log in.
   */
  submit: publicProcedure
    .input(
      z.object({
        fileBase64: z.string(), // base64-encoded PDF
        filename: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      // Decode base64 to buffer
      const buffer = Buffer.from(input.fileBase64, "base64");

      // Upload to S3
      const fileKey = `invoices/${Date.now()}-${randomSuffix()}.pdf`;
      const { url: fileUrl } = await storagePut(fileKey, buffer, "application/pdf");

      // Create initial DB record
      await createInvoice({
        fileUrl,
        fileKey,
        originalFilename: input.filename,
        extractionStatus: "pending",
        status: "pending",
      });

      // Get the inserted invoice id by fetching the latest
      const allInvoices = await getAllInvoices();
      const newInvoice = allInvoices[0]; // most recent

      // Run AI extraction asynchronously (fire and forget with error handling)
      extractInvoiceData(newInvoice.id, fileUrl, buffer).catch((err) => {
        console.error("[Invoice] Extraction failed for invoice", newInvoice.id, err);
      });

      return { success: true, invoiceId: newInvoice.id };
    }),

  /**
   * Owner-only: get all invoices with computed daysLeft
   */
  list: adminProcedure.query(async () => {
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
  updateStatus: adminProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["pending", "paid", "overdue"]),
      })
    )
    .mutation(async ({ input }) => {
      await updateInvoice(input.id, { status: input.status });
      return { success: true };
    }),

  /**
   * Owner-only: delete an invoice
   */
  delete: adminProcedure
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
async function extractInvoiceData(invoiceId: number, fileUrl: string, _buffer: Buffer) {
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

    const content = response.choices?.[0]?.message?.content;
    if (!content) throw new Error("No content from LLM");

    const extracted = JSON.parse(content);

    await updateInvoice(invoiceId, {
      staffName: extracted.staffName ?? undefined,
      position: extracted.position ?? undefined,
      payAmount: extracted.payAmount ?? undefined,
      dueDate: extracted.dueDate ? new Date(extracted.dueDate) : undefined,
      extractionStatus: "completed",
      extractedData: content,
    });
  } catch (err) {
    console.error("[Invoice] LLM extraction error:", err);
    await updateInvoice(invoiceId, { extractionStatus: "failed" });
  }
}
