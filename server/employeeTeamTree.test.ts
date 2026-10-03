import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Router } from "wouter";
import { APY_TEAM_ROLES } from "../shared/apyPermissions";
import { buildEmployeeTeamTree, type EmployeeTreeMember } from "../shared/employeeTeamTree";
import EmployeeTeamTree from "../client/src/components/EmployeeTeamTree";

function employee(overrides: Partial<EmployeeTreeMember> = {}): EmployeeTreeMember {
  return { id: 1, sourceApplicationId: null, name: "Example Employee", role: "Puppy Monitor", location: "KW", employmentStatus: "inactive", hasApyHqAccess: false, ...overrides };
}
const flatten = (rows: ReturnType<typeof buildEmployeeTeamTree>) => rows.flatMap((location) => location.roles.flatMap((branch) => branch.members));
const renderTree = (props: Parameters<typeof EmployeeTeamTree>[0]) => renderToStaticMarkup(
  createElement(Router, { ssrPath: "/admin/staff-availability" }, createElement(EmployeeTeamTree, props)),
);

describe("complete Employee Directory team tree", () => {
  it("includes all Directory records exactly once regardless of employment or profile linkage", () => {
    const directory = [employee(), employee({ id: 2, employmentStatus: "active" }), employee({ id: 3, sourceApplicationId: 77 }), employee({ id: 4, sourceApplicationId: 88, employmentStatus: "active", hasApyHqAccess: true })];
    const before = JSON.stringify(directory);
    expect(flatten(buildEmployeeTeamTree(directory)).map((person) => person.id).sort()).toEqual([1, 2, 3, 4]);
    expect(JSON.stringify(directory)).toBe(before);
    expect(directory.filter((person) => person.hasApyHqAccess)).toHaveLength(1);
  });

  it("maps all six roles under the saved location and does not force central-role employees into another branch", () => {
    const directory = ["KW", "OAK", "HAM", "CENTRAL"].flatMap((location, locationIndex) => APY_TEAM_ROLES.map((role, roleIndex) => employee({ id: locationIndex * 10 + roleIndex + 1, role, location })));
    const tree = buildEmployeeTeamTree(directory);
    expect(flatten(tree)).toHaveLength(directory.length);
    for (const person of directory) {
      const branch = tree.find((location) => location.key === person.location)?.roles.find((role) => role.role === person.role);
      expect(branch?.members).toContain(person);
    }
  });

  it("shows all managers, instructors and Puppy Specialists, even when inactive", () => {
    const directory = [employee({ id: 1, role: "Operations Manager" }), employee({ id: 2, role: "Operations Manager" }), employee({ id: 3, role: "Yoga Instructor" }), employee({ id: 4, role: "Yoga Instructor" }), employee({ id: 5, role: "Puppy Specialist" })];
    const roles = buildEmployeeTeamTree(directory).find((branch) => branch.key === "KW")!.roles;
    expect(roles.find((branch) => branch.role === "Operations Manager")!.members).toHaveLength(2);
    expect(roles.find((branch) => branch.role === "Yoga Instructor")!.members).toHaveLength(2);
    expect(roles.find((branch) => branch.role === "Puppy Specialist")!.members).toHaveLength(1);
  });

  it("normalizes known display aliases and retains unknown or missing roles/locations visibly", () => {
    const tree = buildEmployeeTeamTree([employee({ role: " puppy_monitor ", location: " Kitchener " }), employee({ id: 2, role: "Legacy Role", location: "Waterloo" }), employee({ id: 3, role: "", location: "" })]);
    expect(tree.find((branch) => branch.key === "KW")?.roles[0].role).toBe("Puppy Monitor");
    expect(tree.find((branch) => branch.label === "Waterloo")?.roles[0].role).toBe("Legacy Role");
    expect(tree.find((branch) => branch.label === "Location not set")?.roles[0].role).toBe("Role not set");
    expect(flatten(tree)).toHaveLength(3);
  });

  it("keeps records with the same name separate and applies saved role/location changes on the next read", () => {
    const directory = [employee(), employee({ id: 2 })];
    expect(flatten(buildEmployeeTeamTree(directory))).toHaveLength(2);
    const moved = [employee({ role: "Yoga Instructor", location: "HAM" })];
    const tree = buildEmployeeTeamTree(moved);
    expect(tree.find((branch) => branch.key === "HAM")!.roles[0].members[0].id).toBe(1);
    expect(tree.find((branch) => branch.key === "KW")!.roles).toEqual([]);
  });

  it("renders every employee ID once with saved status, correct record links, and no false login grant", () => {
    const html = renderTree({
      employees: [employee({ name: "Inactive Person" }), employee({ id: 2, name: "Active Person", employmentStatus: "active", sourceApplicationId: 42, hasApyHqAccess: true })],
      leaves: [{ staffId: 42, startDate: "2026-10-01", endDate: "2026-10-04" }], today: "2026-10-03",
    });
    expect(html.match(/data-employee-id="1"/g)).toHaveLength(1);
    expect(html.match(/data-employee-id="2"/g)).toHaveLength(1);
    expect(html).toContain("Inactive Person");
    expect(html).toContain("Inactive</span>");
    expect(html).toContain("Active</span>");
    expect(html).toContain("No portal access");
    expect(html).toContain("Login enabled · On leave");
    expect(html).toContain('/admin/employees?employee=1');
    expect(html).toContain("Puppy Monitors: 1 active");
    expect(html).not.toContain("Activate employee");
  });

  it("keeps inactive employees out of the active monitor target and preserves empty locations", () => {
    const html = renderTree({ employees: [employee()], today: "2026-10-03" });
    expect(html).toContain("Puppy Monitors: 0 active");
    expect(html).toContain("No employees assigned here.");
    expect(buildEmployeeTeamTree([]).map((branch) => branch.key)).toEqual(["CENTRAL", "KW", "OAK", "HAM"]);
  });

  it("uses the same Directory query and invalidates both views after changes", () => {
    const page = readFileSync(new URL("../client/src/pages/StaffAvailability.tsx", import.meta.url), "utf8");
    const directory = readFileSync(new URL("../client/src/pages/EmployeeDirectory.tsx", import.meta.url), "utf8");
    expect(page).toContain("const employeeDirectory = trpc.staffAvailability.listEmployees.useQuery()");
    expect(page).toContain("const employees = employeeDirectory.data ?? []");
    expect(page).toContain("<EmployeeTeamTree employees={employees}");
    expect(page).toContain("employeeDirectory.error");
    expect(page).toContain("utils.staffAvailability.listEmployees.invalidate()");
    expect(directory).toContain("utils.staffAvailability.listEmployees.invalidate()");
    expect(directory).toContain("utils.staffAvailability.getOrgChart.invalidate()");
    expect(directory).toContain('get("employee")');
  });
});
