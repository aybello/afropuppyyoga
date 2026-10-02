import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");
const navSource = readFileSync(new URL("../client/src/components/Navbar.tsx", import.meta.url), "utf8");
const adminNavSource = readFileSync(new URL("../client/src/components/AdminNav.tsx", import.meta.url), "utf8");
const staffPortalSource = readFileSync(new URL("../client/src/pages/StaffPortal.tsx", import.meta.url), "utf8");
const serverSource = readFileSync(new URL("./_core/index.ts", import.meta.url), "utf8");
const robotsSource = readFileSync(new URL("../client/public/robots.txt", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("../client/src/pages/PrivateRevenueDashboard.tsx", import.meta.url), "utf8");

describe("private dashboard route", () => {
  it("registers the private dashboard inside APY HQ without adding it to public navigation", () => {
    expect(appSource).toContain('path="/staff/revenue-dashboard"');
    expect(appSource).not.toContain('path="/dashboard"');
    expect(staffPortalSource).toContain('href: "/staff/revenue-dashboard"');
    expect(staffPortalSource).toContain('id === "private-revenue-dashboard"');
    expect(navSource).not.toContain('href="/staff/revenue-dashboard"');
    expect(adminNavSource).not.toContain('href: "/staff/revenue-dashboard"');
  });

  it("applies crawler and browser noindex controls", () => {
    expect(serverSource).toContain('app.use("/staff/revenue-dashboard", (_req, res, next)');
    expect(serverSource).toContain('"X-Robots-Tag", "noindex, nofollow, noarchive"');
    expect(robotsSource).toContain("Disallow: /staff/revenue-dashboard");
    expect(pageSource).toContain('setAttribute("content", "noindex, nofollow, noarchive")');
  });

  it("keeps the privacy-first dashboard copy explicit about estimated revenue", () => {
    expect(pageSource).toContain("Estimated revenue");
    expect(pageSource).toContain("Stripe-confirmed");
    expect(pageSource).toContain("row.tickets === null || row.events === 0 ? undefined");
    expect(pageSource).not.toContain("customerEmail");
    expect(pageSource).not.toContain("customerName");
  });
});
