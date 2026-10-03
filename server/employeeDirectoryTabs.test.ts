import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";

const mocks = vi.hoisted(() => ({
  search: "", navigate: vi.fn(), data: [] as any[], error: null as Error | null, isLoading: false,
  refetch: vi.fn(), invalidate: vi.fn(), mutate: vi.fn(),
}));
vi.mock("wouter", async (importOriginal) => ({ ...(await importOriginal<typeof import("wouter")>()), useSearch: () => mocks.search, useLocation: () => ["/admin/employees", mocks.navigate] }));
vi.mock("../client/src/components/AdminNav", () => ({ default: () => null }));
vi.mock("../client/src/lib/trpc", () => ({ trpc: {
  useUtils: () => ({ staffAvailability: { listEmployees: { invalidate: mocks.invalidate }, getOrgChart: { invalidate: mocks.invalidate }, getWeekendCoverage: { invalidate: mocks.invalidate } }, puppySchedule: { listWithStaffing: { invalidate: mocks.invalidate } }, staff: { listStaff: { invalidate: mocks.invalidate } } }),
  staffAvailability: {
    listEmployees: { useQuery: () => ({ data: mocks.data, error: mocks.error, isLoading: mocks.isLoading, refetch: mocks.refetch }) },
    getOrgChart: { useQuery: () => ({ data: { leaves: [] }, error: null }) },
    ...Object.fromEntries(["reactivateTeamMember", "updateEmployeeRecord", "createEmployeeRecord", "provisionEmployeeApyHqAccess", "markEmployeeDeparted", "reactivateEmployeeEmployment", "deleteFormerEmployeeRecord"].map((name) => [name, { useMutation: () => ({ mutate: mocks.mutate, isPending: false }) }])),
  },
} }));

import EmployeeDirectory from "../client/src/pages/EmployeeDirectory";

const person = { id: 1, sourceApplicationId: 42, name: "Fictional Employee", email: "test@example.com", phone: null, role: "Puppy Monitor", location: "KW", employmentStatus: "active", hasApyHqAccess: true, startedAt: "2026-10-01", endedAt: null };
const renderDirectory = () => renderToStaticMarkup(createElement(Router, { ssrPath: "/admin/employees" }, createElement(EmployeeDirectory)));

describe("actual Employee Directory tab rendering", () => {
  beforeEach(() => { mocks.search = ""; mocks.data = [person]; mocks.error = null; mocks.isLoading = false; vi.clearAllMocks(); });
  it("shows the existing employee table under List by default", () => {
    const html = renderDirectory();
    expect(html).toContain('aria-label="Employee Directory views"');
    expect(html).toMatch(/role="tab"[^>]*aria-selected="true"[^>]*>.*?List/s);
    expect(html).toContain("All employee records");
    expect(html).toContain("Fictional Employee");
    expect(html).not.toContain('data-employee-id="1"');
    expect(mocks.mutate).not.toHaveBeenCalled();
  });
  it("shows the same records as in-page tree buttons at the tree URL", () => {
    mocks.search = "tab=tree";
    const html = renderDirectory();
    expect(html).toContain("APY Team Tree");
    expect(html).toContain('aria-label="Edit Fictional Employee"');
    expect(html.match(/data-employee-id="1"/g)).toHaveLength(1);
    expect(html).not.toContain('href="/admin/employees?employee=1"');
    expect(html).not.toContain("All employee records");
    expect(html).toContain("Manage availability");
    expect(mocks.mutate).not.toHaveBeenCalled();
  });
  it("includes inactive and unlinked employees in the embedded tree without granting login", () => {
    mocks.search = "tab=tree";
    mocks.data = [person, { ...person, id: 2, name: "Former Employee", employmentStatus: "inactive", hasApyHqAccess: false, sourceApplicationId: null }];
    const html = renderDirectory();
    expect(html.match(/data-employee-id=/g)).toHaveLength(2);
    expect(html).toContain("Former Employee");
    expect(html).toContain("Inactive</span>");
    expect(mocks.mutate).not.toHaveBeenCalled();
  });
  it("shows a retry state rather than an empty tree on an employee read error", () => {
    mocks.search = "tab=tree";
    mocks.error = new Error("Private read failed");
    const html = renderDirectory();
    expect(html).toContain("The employee tree could not be loaded.");
    expect(html).toContain("Try again");
    expect(html).not.toContain('data-employee-id=');
  });
});
