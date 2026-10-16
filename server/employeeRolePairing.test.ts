import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { APY_TEAM_ROLES, isCentralApyTeamRole } from "../shared/apyPermissions";
import {
  directEmployeeSchema,
  directTeamMemberSchema,
  employeeRecordUpdateSchema,
  teamMemberProfileUpdateSchema,
} from "./routers/staffAvailability";

const base = {
  name: "Example Person",
  email: "person@example.com",
  phone: "289-555-0100",
};

/** Each schema with the extra fields it requires beyond name/contact/assignment. */
const schemas = [
  { label: "employee record update", schema: employeeRecordUpdateSchema, extra: { id: 7 } },
  { label: "new employee", schema: directEmployeeSchema, extra: { startedAt: "2026-01-05" } },
  { label: "new team profile", schema: directTeamMemberSchema, extra: {} },
  { label: "team profile update", schema: teamMemberProfileUpdateSchema, extra: { id: 7 } },
];

describe("role and location pairing rules", () => {
  for (const { label, schema, extra } of schemas) {
    describe(label, () => {
      it("rejects a site position saved as APY-wide", () => {
        // Regression: a move away from BDR or Social Media Specialist used to
        // leave the person at CENTRAL, producing "Puppy Monitor at CENTRAL".
        for (const role of APY_TEAM_ROLES.filter((value) => !isCentralApyTeamRole(value))) {
          const result = schema.safeParse({ ...base, ...extra, role, location: "CENTRAL" });
          expect(result.success, `${role} at CENTRAL should be rejected`).toBe(false);
        }
      });

      it("rejects an APY-wide position tied to one site", () => {
        for (const role of ["BDR", "Social Media Specialist"]) {
          const result = schema.safeParse({ ...base, ...extra, role, location: "KW" });
          expect(result.success, `${role} at KW should be rejected`).toBe(false);
        }
      });

      it("accepts every valid pairing, including Guelph", () => {
        for (const role of APY_TEAM_ROLES) {
          const location = isCentralApyTeamRole(role) ? "CENTRAL" : "GUE";
          const result = schema.safeParse({ ...base, ...extra, role, location });
          expect(result.success, `${role} at ${location} should be accepted`).toBe(true);
        }
      });

      it("accepts a move between two sites", () => {
        for (const location of ["KW", "OAK", "HAM", "GUE"]) {
          const result = schema.safeParse({ ...base, ...extra, role: "Operations Specialist", location });
          expect(result.success, `Operations Specialist at ${location}`).toBe(true);
        }
      });
    });
  }
});

describe("Employee Directory position controls", () => {
  const directory = readFileSync(new URL("../client/src/pages/EmployeeDirectory.tsx", import.meta.url), "utf8");

  it("offers every position as a destination in the editor", () => {
    expect(directory).toContain("APY_TEAM_ROLES.map(");
  });

  it("keeps the saved site valid in both the add and edit dialogs", () => {
    // Two role dropdowns recompute the location, and the open-editor repair
    // applies the same shared rule, so all three must route through it.
    const uses = directory.match(/location: resolveLocationForRole\(/g) ?? [];
    expect(uses).toHaveLength(3);
    // No dialog may still pin CENTRAL only in the forward direction.
    expect(directory).not.toContain('isCentralApyTeamRole(event.target.value) ? "CENTRAL"');
  });

  it("repairs a legacy pairing when the editor opens so the owner is never blocked", () => {
    expect(directory).toContain("function withEditableAssignment(");
    const opens = directory.match(/setEditingEmployee\(withEditableAssignment\(/g) ?? [];
    expect(opens).toHaveLength(3);
  });

  it("reports what a position change did to upcoming duties", () => {
    expect(directory).toContain("result.retiredClassAssignments + result.releasedLeadershipCoverage");
    expect(directory).toContain("result.roleChanged");
  });
});

describe("every route that changes a position", () => {
  const router = readFileSync(new URL("./routers/staffAvailability.ts", import.meta.url), "utf8");

  it("retires duties the new position cannot cover, from both editors", () => {
    // Employee Directory and the team profile editor both write role, so a
    // stale duty must be impossible regardless of which one the owner uses.
    const retirements = router.match(/await retireDutiesOutsideNewRole\(/g) ?? [];
    expect(retirements).toHaveLength(2);
  });

  it("records who moved the person, from both editors", () => {
    const audits = router.match(/action: "employee_role_changed"/g) ?? [];
    expect(audits).toHaveLength(2);
  });

  it("only acts when the position actually changed", () => {
    const guards = router.match(/const roleChanged = normalizeApyRole\(/g) ?? [];
    expect(guards).toHaveLength(2);
  });
});
