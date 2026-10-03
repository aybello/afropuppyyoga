import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
const mocks = vi.hoisted(() => ({ data: [] as any[], mutate: vi.fn(), invalidate: vi.fn(), error: null as Error | null }));
vi.mock("../client/src/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { role: "admin" }, loading: false }) }));
vi.mock("../client/src/components/AdminNav", () => ({ default: () => null }));
vi.mock("../client/src/lib/trpc", () => ({ trpc: {
  useUtils: () => ({}),
  careers: {
    list: { useQuery: () => ({ data: mocks.data, isLoading: false, error: mocks.error }) },
    listArchived: { useQuery: () => ({ data: [], isLoading: false }) },
    ...Object.fromEntries(["updateStatus", "deleteApplication", "restoreApplication"].map((name) => [name, { useMutation: () => ({ mutate: mocks.mutate, isPending: false }) }])),
  },
  staffAvailability: { addSignedApplicantToDirectory: { useMutation: () => ({ mutate: mocks.mutate, isPending: false }) } },
} }));
import ApplicationsDashboard from "../client/src/pages/ApplicationsDashboard";
const app = { id: 42, name: "Fictional Applicant", email: "fiction@example.com", phone: null, role: "Puppy Monitor", location: "Kitchener", status: "accepted", createdAt: new Date("2026-10-01"), signingStatus: "signed", onboardingSentAt: null, onboardingDeliveryToken: null, employeeId: null };
const render = () => renderToStaticMarkup(createElement(Router, { ssrPath: "/admin/applications" }, createElement(ApplicationsDashboard)));
beforeEach(() => { mocks.data = [app]; mocks.error = null; vi.clearAllMocks(); });
describe("Applications hiring screen", () => {
  it("shows signed applicants by default with an Add employee action before onboarding", () => {
    const html = render();
    expect(html).toContain("Fictional Applicant");
    expect(html).toContain("Add employee</button>");
    expect(html).not.toContain("Send onboarding documents</button>");
    expect(html).toContain("Offer signed, ready to add");
    expect(mocks.mutate).not.toHaveBeenCalled();
  });
  it("offers first-time onboarding documents for an already-added employee", () => {
    mocks.data = [{ ...app, status: "onboarded", employeeId: 7, employeeStatus: "active" }];
    const html = render();
    expect(html).toContain("Send onboarding documents</button>");
    expect(html).toContain('/admin/employees?employee=7');
    expect(html).not.toContain("Add employee</button>");
    expect(html).not.toContain("Resend onboarding documents</button>");
  });
  it("shows resending only after documented delivery and keeps training separate", () => {
    mocks.data = [{ ...app, status: "onboarded", employeeId: 7, employeeStatus: "active", onboardingSentAt: new Date() }];
    const html = render();
    expect(html).toContain("Resend onboarding documents</button>");
    expect(html).toContain("does not mean training is complete");
    expect(html).toContain('/admin/staff-training');
  });
  it("keeps selected applicants without an offer on an actionable path", () => {
    mocks.data = [{ ...app, signingStatus: null }];
    const html = render();
    expect(html).toContain("Send offer</button>");
    expect(html).not.toContain("Add employee</button>");
  });
  it("shows a read error rather than falsely reporting no applications", () => {
    mocks.data = []; mocks.error = new Error("Database unavailable");
    expect(render()).toContain("Applications could not be loaded");
  });
});
