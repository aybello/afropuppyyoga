import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/trpc", () => ({ trpc: { invoices: { submit: { useMutation: () => ({ isPending: false, mutateAsync: vi.fn() }) } } } }));
import InvoiceSubmit from "../client/src/pages/InvoiceSubmit";
import Footer from "../client/src/components/Footer";

describe("public invoice page", () => {
  it("renders without auth, exposes name/email/PDF fields and does not promise approved payment", () => {
    const html = renderToStaticMarkup(createElement(InvoiceSubmit));
    expect(html).toContain("No login needed"); expect(html).toContain('name="submitterName"'); expect(html).toContain('name="submitterEmail"');
    expect(html).toContain("Choose a PDF or drop it here"); expect(html).toContain("Submit Invoice");
    expect(html).toContain("Invoices are reviewed before payment"); expect(html).not.toContain("Team sign-in required"); expect(html).not.toContain("View Dashboard");
    const source = readFileSync("client/src/pages/InvoiceSubmit.tsx", "utf8");
    expect(source).not.toContain("useAuth"); expect(source).not.toContain("staff.myAccess"); expect(source).not.toContain("iframe");
    expect(source).toContain("receiptRef"); expect(source).toContain("submissionLock");
  });
  it("provides a public footer and navigation entry while retaining a direct route", () => {
    const html = renderToStaticMarkup(createElement(Footer));
    expect(html).toContain('href="/submit-invoice"'); expect(html).toContain("Submit Invoice");
    expect(readFileSync("client/src/components/Navbar.tsx", "utf8")).toContain('{ label: "Submit Invoice", href: "/submit-invoice", isPage: true }');
    expect(readFileSync("client/src/App.tsx", "utf8")).toContain('<Route path={"/submit-invoice"} component={InvoiceSubmit} />');
  });
  it("limits invoice intake before PDF parsing and handles any batch position", () => {
    const source = readFileSync("server/_core/index.ts", "utf8");
    expect(source).toContain('app.use("/api/upload-invoice", invoiceIntakeLimiter)');
    expect(source).toContain('procedures.includes("invoices.submit")');
    expect(source).toContain('procedures.length !== 1');
    expect(source).toContain('max: 30');
    expect(source.indexOf('app.use("/api/upload-invoice", invoiceIntakeLimiter)')).toBeLessThan(source.indexOf("app.use(uploadRouter)"));
  });
});
