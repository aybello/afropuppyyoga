import { describe, expect, it, vi } from "vitest";
import { employeeApplicationAssociations, employees, jobApplicationActions, jobApplications } from "../drizzle/schema";
import { activateEmployeeWithAccess, prepareActiveEmployeeEdit } from "./employeeActivation";

const profile = { id: 42, name: "Example Person", email: "person@example.com", phone: "+14165550100", role: "Puppy Monitor", location: "KW", status: "onboarded", isTeamMember: true, deletedAt: null };
const employee = { ...profile, id: 7, sourceApplicationId: 42, employmentStatus: "active" };
const actor = { id: 1, name: "Manager", email: "manager@example.com" };
function harness() {
  const db: any = {
    select: vi.fn(() => {
      let rows: unknown[] = [];
      const chain: any = { from: (table: unknown) => {
        rows = table === employees ? [employee] : table === jobApplications ? [profile] : table === jobApplicationActions ? [] : table === employeeApplicationAssociations ? [{ applicationId: 42, employeeId: 8 }] : [];
        return chain;
      }, where: () => chain, limit: async () => rows, then: (resolve: any) => resolve(rows) };
      return chain;
    }),
    update: vi.fn(), insert: vi.fn(),
  };
  return db;
}
describe("association protection during activation and edit", () => {
  it("blocks activating a canonical profile owned by another employee before writing", async () => {
    const db = harness();
    await expect(activateEmployeeWithAccess(db, 7, actor, true)).rejects.toThrow("already linked to another employee");
    expect(db.update).not.toHaveBeenCalled(); expect(db.insert).not.toHaveBeenCalled();
  });
  it("blocks editing an employee whose canonical profile is owned by another employee", async () => {
    const db = harness();
    await expect(prepareActiveEmployeeEdit(db, employee as any, employee)).rejects.toThrow("already linked to another employee");
    expect(db.update).not.toHaveBeenCalled();
  });
});
