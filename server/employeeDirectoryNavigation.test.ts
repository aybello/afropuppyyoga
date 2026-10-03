import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { employeeDirectoryTabUrl, getEmployeeDirectoryTab, legacyEmployeeTreeUrl } from "../shared/employeeDirectoryNavigation";

const directory = readFileSync(new URL("../client/src/pages/EmployeeDirectory.tsx", import.meta.url), "utf8");
const availability = readFileSync(new URL("../client/src/pages/StaffAvailability.tsx", import.meta.url), "utf8");
const availabilityDialog = readFileSync(new URL("../client/src/components/EmployeeAvailabilityDialog.tsx", import.meta.url), "utf8");

describe("Employee Directory consolidated navigation", () => {
  it("defaults to list and restores tree tab from a shareable URL", () => {
    expect(getEmployeeDirectoryTab("")).toBe("list");
    expect(getEmployeeDirectoryTab("?tab=tree")).toBe("tree");
    expect(getEmployeeDirectoryTab("tab=list")).toBe("list");
    expect(getEmployeeDirectoryTab("tab=unknown")).toBe("list");
  });
  it("changes views within Directory and removes a consumed employee editor deep link", () => {
    expect(employeeDirectoryTabUrl("tree", "employee=12&tab=list")).toBe("/admin/employees?tab=tree");
    expect(employeeDirectoryTabUrl("list", "tab=tree")).toBe("/admin/employees?tab=list");
    expect(employeeDirectoryTabUrl("tree", "other=keep")).toBe("/admin/employees?other=keep&tab=tree");
  });
  it("redirects old team bookmarks to the embedded tree while retaining the requested record", () => {
    expect(legacyEmployeeTreeUrl("?tab=team&employee=42")).toBe("/admin/employees?tab=tree&employee=42");
    expect(legacyEmployeeTreeUrl("tab=team")).toBe("/admin/employees?tab=tree");
    expect(legacyEmployeeTreeUrl("tab=ops")).toBeNull();
    expect(legacyEmployeeTreeUrl("")).toBeNull();
  });
  it("uses accessible in-page tabs, opens the Directory editor and leaves the tree unfiltered", () => {
    expect(directory).toContain('<TabsList aria-label="Employee Directory views"');
    for (const view of ["list", "tree"]) {
      expect(directory).toContain(`<TabsTrigger value="${view}"`);
      expect(directory).toContain(`<TabsContent value="${view}"`);
    }
    expect(directory).toContain('const tab = getEmployeeDirectoryTab(search)');
    expect(directory).toContain('navigate(employeeDirectoryTabUrl(next, search))');
    expect(directory).toContain('<EmployeeTeamTree employees={employees}');
    expect(directory).not.toContain('<EmployeeTeamTree employees={visibleEmployees}');
    expect(directory).toContain('if (record) setEditingEmployee(record)');
    expect(directory).toContain('setAvailabilityEmployeeId(employee.id)');
    expect(directory).not.toContain('href="/admin/staff-availability?tab=team"');
  });
  it("retains the separate weekend board with a direct Directory return and no duplicate tree", () => {
    expect(availability).toContain('<Redirect to={redirect} replace />');
    expect(availability).toContain('href="/admin/employees"');
    expect(availability).toContain('href="/admin/employees?tab=tree"');
    const staffAccess = readFileSync(new URL("../client/src/pages/StaffManagement.tsx", import.meta.url), "utf8");
    expect(staffAccess).toContain('href="/admin/employees?tab=tree"');
    expect(availability).not.toContain('<EmployeeTeamTree');
    expect(availability).toContain('trpc.staffAvailability.getWeekendCoverage.useQuery');
    expect(availability).toContain('trpc.puppySchedule.assignLeadership.useMutation');
    expect(availability).toContain('trpc.puppySchedule.notifyIndividualEventStaff.useMutation');
  });
  it("reuses protected leave actions in the Directory without granting access or sending communications", () => {
    expect(availabilityDialog).toContain('trpc.staffAvailability.addLeave.useMutation');
    expect(availabilityDialog).toContain('trpc.staffAvailability.deleteLeave.useMutation');
    expect(availabilityDialog).toContain('onSaved()');
    expect(availabilityDialog).not.toContain('provisionEmployeeApyHqAccess');
    expect(availabilityDialog).not.toContain('reactivateEmployee');
    expect(availabilityDialog).not.toContain('notifyEventTeam');
  });
});
