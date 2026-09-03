import { describe, expect, it } from "vitest";
import { directEmployeeSchema, directTeamMemberSchema, employeeRecordUpdateSchema, getEmployeeDepartureUpdate, getFormerEmployeeDeletionEligibility, getOnboardedApplicantDirectoryEligibility, getTeamRemovalUpdate, teamMemberActivitySchema, teamMemberProfileUpdateSchema, validateEmployeeDirectoryAssignmentChange, validateTeamAssignmentChange } from "./routers/staffAvailability";

describe("direct team-member validation", () => {
  it("accepts an Operations Manager assigned to Oakville", () => {
    const member = directTeamMemberSchema.parse({
      name: "Taylor James",
      email: "taylor@example.com",
      phone: "289-788-1885",
      role: "Operations Manager",
      location: "OAK",
    });

    expect(member.role).toBe("Operations Manager");
    expect(member.location).toBe("OAK");
  });

  it("accepts central BDR and Social Media Specialist positions", () => {
    const bdr = directTeamMemberSchema.parse({
      name: "Morgan Lee",
      email: "morgan@example.com",
      role: "BDR",
      location: "CENTRAL",
    });
    const social = directTeamMemberSchema.parse({
      name: "Avery King",
      email: "avery@example.com",
      role: "Social Media Specialist",
      location: "CENTRAL",
    });

    expect(bdr.role).toBe("BDR");
    expect(social.location).toBe("CENTRAL");
  });

  it("accepts a phone-only team member and requires at least one contact method", () => {
    const phoneOnly = directTeamMemberSchema.parse({
      name: "Jordan Miles",
      email: "",
      phone: "289-788-1885",
      role: "Puppy Monitor",
      location: "KW",
    });

    expect(phoneOnly.email).toBe("");
    expect(phoneOnly.phone).toBe("289-788-1885");
    expect(() => directTeamMemberSchema.parse({ name: "Jordan Miles", email: "", phone: "", role: "Puppy Monitor", location: "KW" })).toThrow();
  });

  it("accepts a direct employee record without creating an APY HQ team profile", () => {
    const employee = directEmployeeSchema.parse({
      name: "Jordan Miles",
      email: "",
      phone: "289-788-1885",
      role: "Yoga Instructor",
      location: "KW",
      startedAt: "2026-09-03",
    });

    expect(employee).toMatchObject({
      name: "Jordan Miles",
      role: "Yoga Instructor",
      location: "KW",
      startedAt: "2026-09-03",
    });
  });

  it("permits only an onboarding-complete applicant without an existing directory record to be added", () => {
    expect(getOnboardedApplicantDirectoryEligibility({ status: "onboarded", existingEmployee: false })).toEqual({ eligible: true });
    expect(getOnboardedApplicantDirectoryEligibility({ status: "accepted", existingEmployee: false })).toEqual({
      eligible: false,
      reason: "Only onboarding-complete applicants can be added to the Employee Directory.",
    });
    expect(getOnboardedApplicantDirectoryEligibility({ status: "onboarded", existingEmployee: true })).toEqual({
      eligible: false,
      reason: "This applicant already has an Employee Directory record.",
    });
  });

  it("marks a departed employee inactive while retaining their source application and employment history", () => {
    const endedAt = new Date("2026-09-03T12:00:00.000Z");
    expect(getEmployeeDepartureUpdate(endedAt)).toEqual({ employmentStatus: "inactive", endedAt });
  });

  it("allows permanent deletion only for former directory records that have no active APY HQ profile", () => {
    expect(getFormerEmployeeDeletionEligibility({ employmentStatus: "inactive", linkedActiveTeamProfile: false })).toEqual({ eligible: true });
    expect(getFormerEmployeeDeletionEligibility({ employmentStatus: "active", linkedActiveTeamProfile: false })).toEqual({
      eligible: false,
      reason: "Only former or removed Employee Directory records can be deleted permanently.",
    });
    expect(getFormerEmployeeDeletionEligibility({ employmentStatus: "inactive", linkedActiveTeamProfile: true })).toEqual({
      eligible: false,
      reason: "Remove this person from APY HQ Team first so staffing coverage and portal access are handled safely.",
    });
  });

  it("rejects an unsupported role or location", () => {
    expect(() => directTeamMemberSchema.parse({ name: "Taylor James", email: "taylor@example.com", role: "CEO", location: "TOR" })).toThrow();
  });

  it("validates editable team profiles with the same secure contact rules", () => {
    const profile = teamMemberProfileUpdateSchema.parse({
      id: 42,
      name: "Taylor James",
      email: "",
      phone: "289-788-1885",
      role: "Yoga Instructor",
      location: "OAK",
    });

    expect(profile.id).toBe(42);
    expect(profile.phone).toBe("289-788-1885");
    expect(() => teamMemberProfileUpdateSchema.parse({
      id: 42,
      name: "Taylor James",
      email: "",
      phone: "",
      role: "Yoga Instructor",
      location: "OAK",
    })).toThrow("Add either an email address or phone number");
  });

  it("does not leave Puppy Monitors without an Operations Manager after an edit", () => {
    expect(() => validateTeamAssignmentChange({
      currentRole: "Operations Manager",
      currentLocation: "KW",
      nextRole: "Yoga Instructor",
      nextLocation: "OAK",
      hasOperationsManagerAtNextLocation: true,
      hasOtherOperationsManagerAtCurrentLocation: false,
      hasActivePuppyMonitorsAtCurrentLocation: true,
    })).toThrow("Assign another Operations Manager");

    expect(() => validateTeamAssignmentChange({
      currentRole: "Operations Manager",
      currentLocation: "KW",
      nextRole: "Yoga Instructor",
      nextLocation: "KW",
      hasOperationsManagerAtNextLocation: true,
      hasOtherOperationsManagerAtCurrentLocation: true,
      hasActivePuppyMonitorsAtCurrentLocation: true,
    })).not.toThrow();
  });

  it("does not permit removing the sole Operations Manager from a location with active Puppy Monitors", () => {
    expect(() => validateTeamAssignmentChange({
      currentRole: "Operations Manager",
      currentLocation: "KW",
      nextRole: "Inactive",
      nextLocation: "KW",
      hasOperationsManagerAtNextLocation: false,
      hasOtherOperationsManagerAtCurrentLocation: false,
      hasActivePuppyMonitorsAtCurrentLocation: true,
    })).toThrow("Assign another Operations Manager");
  });

  it("accepts only an explicit staff-profile activity state", () => {
    expect(teamMemberActivitySchema.parse({ id: 42, isActive: false })).toEqual({ id: 42, isActive: false });
    expect(() => teamMemberActivitySchema.parse({ id: 0, isActive: true })).toThrow();
  });

  it("removes a person from APY HQ instead of leaving an inactive team profile", () => {
    const removedAt = new Date("2026-08-20T12:00:00.000Z");
    expect(getTeamRemovalUpdate(removedAt)).toEqual({ isTeamMember: false, deletedAt: removedAt });
  });

  it("validates editable employee-directory records and preserves the phone-or-email rule", () => {
    expect(employeeRecordUpdateSchema.parse({
      id: 7,
      name: "Taylor James",
      email: "taylor@example.com",
      phone: "",
      role: "Operations Manager",
      location: "OAK",
    }).location).toBe("OAK");

    expect(() => employeeRecordUpdateSchema.parse({
      id: 7,
      name: "Taylor James",
      email: "",
      phone: "",
      role: "Operations Manager",
      location: "OAK",
    })).toThrow("Add either an email address or phone number");

    expect(() => employeeRecordUpdateSchema.parse({
      id: 7,
      name: "Taylor James",
      email: "taylor@example.com",
      role: "CEO",
      location: "OAK",
    })).toThrow();

    expect(() => employeeRecordUpdateSchema.parse({
      id: 7,
      name: "Taylor James",
      email: "taylor@example.com",
      role: "BDR",
      location: "OAK",
    })).toThrow("APY-wide");
  });

  it("does not let a linked active profile move the sole Operations Manager away from active Puppy Monitors", () => {
    expect(() => validateEmployeeDirectoryAssignmentChange({
      linkedActiveTeamProfile: true,
      currentRole: "Operations Manager",
      currentLocation: "KW",
      nextRole: "Operations Manager",
      nextLocation: "OAK",
      hasOperationsManagerAtNextLocation: true,
      hasOtherOperationsManagerAtCurrentLocation: false,
      hasActivePuppyMonitorsAtCurrentLocation: true,
    })).toThrow("Assign another Operations Manager");

    expect(() => validateEmployeeDirectoryAssignmentChange({
      linkedActiveTeamProfile: true,
      currentRole: "Operations Manager",
      currentLocation: "KW",
      nextRole: "Yoga Instructor",
      nextLocation: "KW",
      hasOperationsManagerAtNextLocation: false,
      hasOtherOperationsManagerAtCurrentLocation: false,
      hasActivePuppyMonitorsAtCurrentLocation: true,
    })).toThrow("Assign another Operations Manager");

    expect(() => validateEmployeeDirectoryAssignmentChange({
      linkedActiveTeamProfile: true,
      currentRole: "Operations Manager",
      currentLocation: "KW",
      nextRole: "Operations Manager",
      nextLocation: "KW",
      hasOperationsManagerAtNextLocation: true,
      hasOtherOperationsManagerAtCurrentLocation: false,
      hasActivePuppyMonitorsAtCurrentLocation: true,
    })).not.toThrow();

    expect(() => validateEmployeeDirectoryAssignmentChange({
      linkedActiveTeamProfile: false,
      currentRole: "Operations Manager",
      currentLocation: "KW",
      nextRole: "Operations Manager",
      nextLocation: "OAK",
      hasOperationsManagerAtNextLocation: true,
      hasOtherOperationsManagerAtCurrentLocation: false,
      hasActivePuppyMonitorsAtCurrentLocation: true,
    })).not.toThrow();
  });
});
