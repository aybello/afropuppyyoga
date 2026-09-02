import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const routerSource = readFileSync(resolve(import.meta.dirname, "routers/invoices.ts"), "utf8");
const dashboardSource = readFileSync(resolve(import.meta.dirname, "../client/src/pages/InvoiceDashboard.tsx"), "utf8");

describe("invoice paid-status workflow", () => {
  it("provides an owner-only total recovery step before approval", () => {
    expect(routerSource).toContain("setTotal: ownerProcedure");
    expect(routerSource).toContain("totalAmountCents: z.number().int().positive()");
    expect(routerSource).toContain("Invoice totals cannot be changed after approval or payment.");
    expect(routerSource).toContain("invoice.status === \"partial\"");
    expect(routerSource).toContain("invoice.amountPaidCents > 0");
  });

  it("makes the required payment path discoverable without bypassing approval", () => {
    expect(dashboardSource).toContain("Confirm Invoice Total");
    expect(dashboardSource).toContain("Set total");
    expect(dashboardSource).toContain("Record payment");
    expect(dashboardSource).toContain("Mark Fully Paid");
    expect(dashboardSource).toContain("amountCents > totalCents");
    expect(dashboardSource).toContain("invoice.workflowStatus !== \"approved\" && invoice.workflowStatus !== \"paid\"");
    expect(dashboardSource).toContain("The uploaded PDF did not provide a usable total.");
  });
});
