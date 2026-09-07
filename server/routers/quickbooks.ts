import { z } from "zod";
import { ownerProcedure, router } from "../_core/trpc";
import {
  buildQuickbooksAnalysisContext,
  disconnectActiveQuickbooksConnection,
  exportActiveQuickbooksTransactionsToGoogleSheet,
  getQuickbooksOverview,
  startQuickbooksAuthorization,
  syncActiveQuickbooksConnection,
} from "../quickbooks";

const analysisInput = z.object({
  question: z.string().trim().min(6).max(600),
  confirmExternalAnalysis: z.literal(true),
});

async function requestClaudeAnalysis(context: unknown, question: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("AI analysis is not configured");
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-opus-5-20250801",
      max_tokens: 1_400,
      system: "You are APY's private financial-analysis assistant. Use only the provided read-only QuickBooks summary. Distinguish reported figures from interpretation, identify data limitations, do not invent transactions, and do not give tax, legal, accounting, or payment-execution instructions. Be concise and use Canadian dollars.",
      messages: [{
        role: "user",
        content: `Question: ${question}\n\nRead-only QuickBooks summary (account numbers and individual transaction descriptions omitted):\n${JSON.stringify(context)}`,
      }],
    }),
  });
  const payload = await response.json().catch(() => ({})) as { content?: Array<{ type?: string; text?: string }>; error?: { message?: string } };
  const text = payload.content?.find(part => part.type === "text")?.text;
  if (!response.ok || !text) throw new Error(payload.error?.message ?? "AI analysis could not be completed");
  return text;
}

export const quickbooksRouter = router({
  overview: ownerProcedure.query(() => getQuickbooksOverview()),
  beginAuthorization: ownerProcedure.mutation(() => startQuickbooksAuthorization()),
  syncNow: ownerProcedure.mutation(async () => syncActiveQuickbooksConnection("manual")),
  exportToGoogleSheet: ownerProcedure.mutation(() => exportActiveQuickbooksTransactionsToGoogleSheet()),
  disconnect: ownerProcedure.input(z.object({ confirmDisconnect: z.literal(true) })).mutation(() => disconnectActiveQuickbooksConnection()),
  exportForAi: ownerProcedure.query(async () => {
    const overview = await getQuickbooksOverview();
    if (!overview.aiExport) throw new Error("Sync QuickBooks data before creating an analysis export");
    return overview.aiExport;
  }),
  analyze: ownerProcedure.input(analysisInput).mutation(async ({ input }) => {
    const context = await buildQuickbooksAnalysisContext();
    return { analysis: await requestClaudeAnalysis(context, input.question) };
  }),
});
