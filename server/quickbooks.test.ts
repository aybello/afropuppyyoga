import { describe, expect, it } from "vitest";
import { decryptQuickbooksSecret, encryptQuickbooksSecret, normalizeQuickbooksEntity } from "./quickbooks";

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
});
