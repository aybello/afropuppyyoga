import { describe, expect, it } from "vitest";
import { buildGoogleSheetsExportPayload, decryptQuickbooksSecret, encryptQuickbooksSecret, normalizeQuickbooksEntity } from "./quickbooks";

describe("QuickBooks import safety", () => {
  it("encrypts OAuth tokens without storing plaintext", () => {
    const original = "token-value-for-test";
    const encrypted = encryptQuickbooksSecret(original);
    expect(encrypted).not.toContain(original);
    expect(decryptQuickbooksSecret(encrypted)).toBe(original);
  });

  it("normalizes expenses, income, and transfers without importing raw account numbers", () => {
    const expense = normalizeQuickbooksEntity("Purchase", {
      Id: "purchase-1", TxnDate: "2026-09-05", TotalAmt: 48.25,
      CurrencyRef: { value: "CAD" }, EntityRef: { name: "Studio supplier" },
      Line: [{ AccountBasedExpenseLineDetail: { AccountRef: { name: "Studio supplies" } } }],
    });
    const income = normalizeQuickbooksEntity("Deposit", { Id: "deposit-1", TxnDate: "2026-09-05", TotalAmt: 250, DepositToAccountRef: { name: "Operating" } });
    const transfer = normalizeQuickbooksEntity("Transfer", { Id: "transfer-1", TxnDate: "2026-09-05", TotalAmt: 50 });

    expect(expense).toMatchObject({ direction: "expense", amountCents: 4825, categoryName: "Studio supplies" });
    expect(income).toMatchObject({ direction: "income", amountCents: 25000 });
    expect(transfer).toMatchObject({ direction: "transfer", amountCents: 5000 });
  });

  it("rejects incomplete QuickBooks entities instead of inventing transaction records", () => {
    expect(normalizeQuickbooksEntity("Purchase", { Id: "missing-date" })).toBeNull();
    expect(normalizeQuickbooksEntity("Purchase", { TxnDate: "2026-09-05" })).toBeNull();
  });

  it("builds a repeat-safe private Sheet snapshot with source identifiers and no raw account numbers", () => {
    const payload = buildGoogleSheetsExportPayload({
      exportedAt: new Date("2026-09-07T12:00:00.000Z"),
      rows: [{
        sourceType: "Purchase",
        sourceTransactionId: "purchase-42",
        transactionDate: "2026-09-05",
        direction: "expense",
        amountCents: 4825,
        currency: "CAD",
        categoryName: "Studio supplies",
        accountName: "Operating",
        payeeName: "Studio supplier",
        description: "Supplies",
        sourceUpdatedAt: new Date("2026-09-06T15:00:00.000Z"),
      }],
    });

    expect(payload).toMatchObject({
      sheetName: "QuickBooks Transactions",
      replaceSnapshot: true,
      headers: ["Source type", "Source transaction ID", "Date", "Direction", "Amount (CAD)", "Category", "Account", "Payee", "Description", "Source updated at"],
    });
    expect(payload.rows).toEqual([["Purchase", "purchase-42", "2026-09-05", "expense", 48.25, "Studio supplies", "Operating", "Studio supplier", "Supplies", "2026-09-06T15:00:00.000Z"]]);
    expect(JSON.stringify(payload)).not.toMatch(/\b\d{8,}\b/);
  });
});
