import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const schemaSource = readFileSync(resolve(import.meta.dirname, "../drizzle/schema.ts"), "utf8");
const routerSource = readFileSync(resolve(import.meta.dirname, "./routers/breeders.ts"), "utf8");
const reconciliationMigration = readFileSync(
  resolve(import.meta.dirname, "../drizzle/0055_reconcile_breeder_confirmation_pending.sql"),
  "utf8",
);

describe("breeder confirmation pending status reconciliation", () => {
  it("keeps the schema and the legacy-table reconciliation aligned with the protected confirmation lifecycle", () => {
    expect(schemaSource).toContain('mysqlEnum("confStatus", ["pending", "sent", "failed"])');
    expect(routerSource).toContain('status: "pending"');
    expect(reconciliationMigration).toContain("MODIFY COLUMN `confStatus` enum('pending','sent','failed') NOT NULL DEFAULT 'pending'");
  });
});
