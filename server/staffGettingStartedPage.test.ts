import { createElement, type ComponentProps, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";

const mocks = vi.hoisted(() => ({
  myTraining: vi.fn(), complete: vi.fn(), mutate: vi.fn(), refetch: vi.fn(),
  useAuth: vi.fn(), myAccess: vi.fn(),
}));
vi.mock("@/lib/trpc", () => ({ trpc: {
  training: {
    myTraining: { useQuery: mocks.myTraining },
    complete: { useMutation: mocks.complete },
  },
  staff: { myAccess: { useQuery: mocks.myAccess } },
} }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: mocks.useAuth }));

import StaffGettingStarted, { StaffGettingStartedView, type GettingStartedData } from "../client/src/pages/StaffGettingStarted";
import StaffPortal from "../client/src/pages/StaffPortal";

const invoiceKey = "invoice-submission-v1";
const fixture = (): GettingStartedData => ({
  staff: { name: "Maya Fictional", role: "Puppy Monitor", location: "GUE" },
  modules: [{ key: "puppy-care" }, { key: "safety" }, { key: invoiceKey }],
  completedKeys: ["puppy-care"],
  adminPreview: false,
});
const render = (page: ReactElement, path = "/staff/get-started") =>
  renderToStaticMarkup(createElement(Router, { ssrPath: path }, page));
const renderView = (props: Partial<ComponentProps<typeof StaffGettingStartedView>> = {}) =>
  render(createElement(StaffGettingStartedView, {
    data: fixture(), loading: false, error: false, saving: false,
    onRetry: vi.fn(), onAcknowledge: vi.fn(), ...props,
  }));
const acknowledgmentButton = (html: string) =>
  (html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) ?? [])
    .find(button => /I understand how to submit an invoice|Invoice guide acknowledged|Saving\.\.\./.test(button));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.myTraining.mockReturnValue({ data: fixture(), isLoading: false, error: null, refetch: mocks.refetch });
  mocks.complete.mockReturnValue({ mutate: mocks.mutate, isPending: false, error: null });
  mocks.useAuth.mockReturnValue({ user: { name: "Maya Fictional" }, loading: false, isAuthenticated: true });
  mocks.myAccess.mockReturnValue({ data: { level: "team_member" }, isLoading: false });
});

describe("Get Started pure view", () => {
  it("renders four useful sections and live staff links without a provider or new signup gates", () => {
    const onRetry = vi.fn();
    const onAcknowledge = vi.fn();
    const html = renderView({ onRetry, onAcknowledge });
    expect(html.match(/<section\b/g)).toHaveLength(4);
    for (const title of ["welcome", "documents", "training", "invoice"]) {
      expect(html).toContain(`aria-labelledby="${title}-title"`);
    }
    for (const path of ["/staff/documents", "/staff/training", "/submit-invoice"]) {
      expect(html).toContain(`href="${path}"`);
    }
    expect(html).not.toContain("/invoice-submit");
    expect(html).not.toMatch(/<form\b|<input\b|href="[^\"]*(?:signup|sign-up|register|careers|apply)/i);
    expect(html).not.toMatch(/must complete|unlock|mandatory|sign up|create an account/i);
    expect(html).toContain("You do not need to sign it again here");
    expect(html).toContain("You do not need to submit an invoice just to finish reading this guide");
    expect(onRetry).not.toHaveBeenCalled();
    expect(onAcknowledge).not.toHaveBeenCalled();
    expect(mocks.myTraining).not.toHaveBeenCalled();
    expect(mocks.complete).not.toHaveBeenCalled();
  });

  it("uses the supplied employee's own name, role, location and role guidance", () => {
    const html = renderView();
    expect(html).toContain("Welcome, Maya");
    expect(html).toContain("Puppy Monitor · GUE");
    expect(html).toContain("Watch puppy wellbeing");
    expect(html).not.toContain("Chief Ay");
    const other = renderView({ data: { ...fixture(), staff: { name: "Robin Example", role: "Yoga Instructor", location: "OAK" } } });
    expect(other).toContain("Welcome, Robin");
    expect(other).toContain("Yoga Instructor · OAK");
    expect(other).toContain("Lead the yoga session");
    expect(other).not.toContain("Watch puppy wellbeing");
  });

  it("labels the invoice as fictional rather than the employee's compensation or a payment guarantee", () => {
    const html = renderView();
    expect(html).toContain("This example is fictional, not your pay rate");
    expect(html).toMatch(/FICTIONAL EXAMPLE[^<]*NOT FOR SUBMISSION/);
    expect(html).toContain("Name: Alex Example");
    expect(html).toContain("not an actual role rate or a promise of compensation");
    expect(html).toContain("Use your own agreed rate or shift fee");
    expect(html).toContain("Download blank template (.txt)");
    expect(html).toContain("Submission is received for review, not payment approval");
    expect(html).not.toMatch(/your (?:pay )?rate is|guaranteed payment|automatically approved/i);
  });

  it.each(["loading", "error", "missing data"] as const)("shows an honest %s state without stale completion", state => {
    const html = renderView({
      data: state === "missing data" ? undefined : { ...fixture(), completedKeys: [invoiceKey, "puppy-care"] },
      loading: state === "loading", error: state === "error",
    });
    if (state === "loading") {
      expect(html).toContain('role="status"');
      expect(html).toContain("Loading your staff guide");
    } else {
      expect(html).toContain('role="alert"');
      expect(html).toContain("We could not load your staff guide");
      expect(html).toContain("Try again");
      expect(html).toContain('href="/staff-access?returnTo=%2Fstaff%2Fget-started"');
    }
    expect(html).not.toMatch(/lessons acknowledged|Invoice guide acknowledged|Saved to your staff profile/);
    expect(acknowledgmentButton(html)).toBeUndefined();
  });

  it("lets the owner preview the guide without acknowledging for an employee", () => {
    const html = renderView({ data: { ...fixture(), staff: null, adminPreview: true } });
    expect(html).toContain("Owner preview");
    expect(html).toContain("Previewing does not complete anything for an employee");
    expect(html).toContain('href="/submit-invoice"');
    expect(acknowledgmentButton(html)).toBeUndefined();
    expect(html).not.toMatch(/lessons acknowledged|Saved to your staff profile/);
  });

  it("shows saved invoice acknowledgment separately from actual invoice submission or payment", () => {
    const html = renderView({ data: { ...fixture(), completedKeys: ["puppy-care", invoiceKey] } });
    expect(acknowledgmentButton(html)).toContain('disabled=""');
    expect(acknowledgmentButton(html)).toContain("Invoice guide acknowledged");
    expect(html).toContain("Saved to your staff profile");
    expect(html).toContain("This does not mean an invoice was submitted, approved or paid");
    expect(html).toContain("1 of 2 lessons acknowledged");
  });

  it("does not count the invoice or unrelated completion keys as role lessons", () => {
    const html = renderView({ data: { ...fixture(), completedKeys: [invoiceKey, "unassigned-lesson"] } });
    expect(html).toContain("0 of 2 lessons acknowledged");
    const invoiceOnly = renderView({ data: { ...fixture(), modules: [{ key: invoiceKey }], completedKeys: [invoiceKey] } });
    expect(invoiceOnly).toContain("No role lessons are assigned yet");
    expect(invoiceOnly).not.toMatch(/\d of \d lessons acknowledged/);
  });

  it("reports a failed save without claiming success or exposing the raw server error", () => {
    const html = renderView({ saveError: "private database failure" });
    expect(html).toContain('role="alert"');
    expect(html).toContain("Your acknowledgment was not saved. Please try again");
    expect(html).not.toMatch(/private database failure|Invoice guide acknowledged|Saved to your staff profile/);
    expect(acknowledgmentButton(html)).toBeDefined();
    expect(acknowledgmentButton(html)).not.toContain('disabled=""');
  });

  it("disables acknowledgment while saving without prematurely displaying success", () => {
    const html = renderView({ saving: true });
    expect(acknowledgmentButton(html)).toContain('disabled=""');
    expect(acknowledgmentButton(html)).toContain("Saving...");
    expect(html).not.toMatch(/Invoice guide acknowledged|Saved to your staff profile/);
  });
});

describe("Get Started page integration", () => {
  it.each([false, true])("does not write completions on initial render (invoice already saved: %s)", saved => {
    const data = fixture();
    if (saved) data.completedKeys.push(invoiceKey);
    mocks.myTraining.mockReturnValue({ data, isLoading: false, error: null, refetch: mocks.refetch });
    const html = render(createElement(StaffGettingStarted));
    expect(html).toContain("Welcome, Maya");
    expect(mocks.myTraining).toHaveBeenCalledWith(undefined, { retry: false, gcTime: 0 });
    expect(mocks.complete).toHaveBeenCalledWith(expect.objectContaining({ onSuccess: expect.any(Function) }));
    expect(mocks.mutate).not.toHaveBeenCalled();
    expect(mocks.refetch).not.toHaveBeenCalled();
  });

  it("offers Get Started to an ordinary team member without owner finance dashboards", () => {
    const html = render(createElement(StaffPortal), "/staff");
    expect(mocks.myAccess).toHaveBeenCalledWith(undefined, { enabled: true });
    expect(html).toContain('href="/staff/get-started"');
    expect(html).toContain("Get Started");
    expect(html).toContain('href="/submit-invoice"');
    expect(html).not.toMatch(/Invoice Dashboard|Revenue Analytics|QuickBooks Finance|Chief Ay/);
    expect(html).not.toMatch(/href="(?:\/admin\/(?:invoices|revenue|quickbooks)|\/staff\/revenue-dashboard)"/);
  });
});
