import { describe, expect, it } from "vitest";
import { resolveEmployeeLoginProfile } from "./employeeProfileResolution";

const employee = { id: 7, sourceApplicationId: 42 as number | null, name: "Example Employee", email: "employee@example.com", phone: "+12895550100" };
const profile = { ...employee, id: 42, status: "onboarded", isTeamMember: false, deletedAt: null as Date | null };

describe("employee canonical login profile", () => {
  it("keeps the linked profile and retires redundant same-person profiles", () => {
    const duplicate = { ...profile, id: 41, name: "  Example   Employee " };
    expect(resolveEmployeeLoginProfile(employee, [profile, duplicate], [employee])).toEqual({ canonical: profile, duplicates: [duplicate] });
  });
  it("selects the newest existing onboarded identity for an unlinked employee without creating another", () => {
    const older = { ...profile, id: 41 };
    expect(resolveEmployeeLoginProfile({ ...employee, sourceApplicationId: null }, [older, profile], [employee])).toEqual({ canonical: profile, duplicates: [older] });
  });
  it("treats archived applicants as inert history without changing them", () => {
    const historical = { ...profile, id: 40, name: "Historical Name", status: "new", deletedAt: new Date() };
    expect(resolveEmployeeLoginProfile(employee, [profile, historical], [employee])).toEqual({ canonical: profile, duplicates: [] });
  });
  it.each([
    { name: "Different Person" },
    { email: "different@example.com" },
    { phone: "+14165550100" },
    { status: "accepted" },
  ])("rejects a live conflicting identity or new applicant: %j", (changes) => {
    expect(() => resolveEmployeeLoginProfile(employee, [profile, { ...profile, id: 41, ...changes }], [employee])).toThrow("Another applicant");
  });
  it("never takes a profile linked to a different employee even if that employee changed contacts", () => {
    const duplicate = { ...profile, id: 41 };
    expect(() => resolveEmployeeLoginProfile(employee, [profile, duplicate], [employee, { ...employee, id: 8, sourceApplicationId: 41, email: "other@example.com", phone: null }])).toThrow("already linked");
  });
  it("rejects a missing linked profile", () => {
    expect(() => resolveEmployeeLoginProfile(employee, [], [employee])).toThrow("could not be found");
  });
  it("allows a genuinely new employee profile only when no contact matches exist", () => {
    expect(resolveEmployeeLoginProfile({ ...employee, sourceApplicationId: null }, [], [employee])).toEqual({ canonical: undefined, duplicates: [] });
  });
  it("does not turn a sole archived applicant into an onboarded login", () => {
    expect(() => resolveEmployeeLoginProfile({ ...employee, sourceApplicationId: null }, [{ ...profile, status: "new", deletedAt: new Date() }], [employee])).toThrow("applicant");
  });
});
