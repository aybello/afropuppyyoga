import { describe, expect, it } from "vitest";
import { directEmployeeSchema, directTeamMemberSchema, employeeRecordUpdateSchema, getApprovedNewHirePortalAccessPlan, getApyHqReactivationEligibility, getDirectEmployeeContactEligibility, getEmployeeDepartureUpdate, getEmployeeEmploymentReactivationEligibility, getEmployeeReactivationUpdate, getExistingEmployeeAccessProvisioningEligibility, getFormerEmployeeDeletionEligibility, getLegacyEmployeeProfileLinkEligibility, getOnboardedApplicantContactMatchEligibility, getOnboardedApplicantDirectoryEligibility, getOperationsManagerDepartureEligibility, getTeamRemovalUpdate, hasActiveApyHqAccess, hasActiveOperationsManagerAtLocation, hasMatchingActiveTeamContact, hasSameOnboardingAssignment, isPuppyMonitorRole, teamMemberActivitySchema, teamMemberProfileUpdateSchema, validateEmployeeDirectoryAssignmentChange, validateTeamAssignmentChange } from "./routers/staffAvailability";

describe("direct team-member validation", () => {
  it("identifies whether a linked employee is eligible for APY HQ phone access", () => {
    expect(hasActiveApyHqAccess({ isTeamMember: true, deletedAt: null })).toBe(true);
    expect(hasActiveApyHqAccess({ isTeamMember: false, deletedAt: null })).toBe(false);
    expect(hasActiveApyHqAccess({ isTeamMember: true, deletedAt: new Date() })).toBe(false);
    expect(hasActiveApyHqAccess(undefined)).toBe(false);
  });

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

  it("plans APY HQ access automatically when the owner adds a direct employee", () => {
    const employee = directEmployeeSchema.parse({
      name: "Jordan Miles",
      email: "",
      phone: "289-788-1885",
      role: "Yoga Instructor",
      location: "KW",
      startedAt: "2026-09-03",
    });

    expect(getApprovedNewHirePortalAccessPlan(employee)).toEqual({
      employmentStatus: "active",
      applicationStatus: "onboarded",
      isTeamMember: true,
      grantsApyHqAccess: true,
      grantsPortalAccess: true,
      portalAccessLevel: "team_member",
    });
  });

  it("grants role-based portal access only to approved APY employee roles", () => {
    expect(getApprovedNewHirePortalAccessPlan({ role: "Operations Manager" })).toMatchObject({
      isTeamMember: true,
      grantsApyHqAccess: true,
      grantsPortalAccess: true,
      portalAccessLevel: "operations_manager",
    });
    for (const role of ["Yoga Instructor", "Puppy Monitor", "Puppy Specialist", "BDR", "Social Media Specialist"]) {
      expect(getApprovedNewHirePortalAccessPlan({ role })).toMatchObject({
        isTeamMember: true,
        grantsApyHqAccess: true,
        grantsPortalAccess: true,
        portalAccessLevel: "team_member",
      });
    }
    expect(getApprovedNewHirePortalAccessPlan({ role: "Volunteer" })).toMatchObject({
      isTeamMember: false,
      grantsApyHqAccess: false,
      grantsPortalAccess: false,
      portalAccessLevel: "none",
    });
  });

  it("uses active Employee Directory coverage for Puppy Monitor onboarding", () => {
    const activeSameLocationManager = [{ role: "operations_manager", location: "KW", employmentStatus: "active", endedAt: null }];
    expect(hasActiveOperationsManagerAtLocation(activeSameLocationManager, "KW")).toBe(true);
    expect(hasActiveOperationsManagerAtLocation(activeSameLocationManager, "OAK")).toBe(false);
    expect(hasActiveOperationsManagerAtLocation([{ role: "Operations Manager", location: "KW", employmentStatus: "inactive", endedAt: null }], "KW")).toBe(false);
    expect(hasActiveOperationsManagerAtLocation([{ role: "Operations Manager", location: "KW", employmentStatus: "active", endedAt: new Date() }], "KW")).toBe(false);
    expect(isPuppyMonitorRole("puppy_monitor")).toBe(true);
  });

  it("does not allow the sole active Operations Manager to depart while Puppy Monitors remain", () => {
    expect(getOperationsManagerDepartureEligibility({
      employeeId: 1,
      employeeRole: "Operations Manager",
      activeLocationEmployees: [
        { id: 1, role: "Operations Manager" },
        { id: 2, role: "Puppy Monitor" },
      ],
    })).toMatchObject({ eligible: false });
    expect(getOperationsManagerDepartureEligibility({
      employeeId: 1,
      employeeRole: "Operations Manager",
      activeLocationEmployees: [
        { id: 1, role: "Operations Manager" },
        { id: 2, role: "operations_manager" },
        { id: 3, role: "Puppy Monitor" },
      ],
    })).toEqual({ eligible: true });
  });

  it("rejects a transfer when the applicant assignment changed after the dashboard read", () => {
    expect(hasSameOnboardingAssignment(
      { role: "Puppy Monitor", location: "KW" },
      { role: "Puppy Monitor", location: "KW" },
    )).toBe(true);
    expect(hasSameOnboardingAssignment(
      { role: "Puppy Monitor", location: "KW" },
      { role: "Yoga Instructor", location: "KW" },
    )).toBe(false);
    expect(hasSameOnboardingAssignment(
      { role: "Puppy Monitor", location: "KW" },
      { role: "Puppy Monitor", location: "OAK" },
    )).toBe(false);
  });

  it("allows an existing active directory-only employee to be provisioned into APY HQ once", () => {
    expect(getExistingEmployeeAccessProvisioningEligibility({
      employmentStatus: "active",
      sourceApplicationId: null,
    })).toEqual({ eligible: true });
    expect(getExistingEmployeeAccessProvisioningEligibility({
      employmentStatus: "inactive",
      sourceApplicationId: null,
    })).toEqual({
      eligible: false,
      reason: "Only active employees can be given APY HQ access.",
    });
    expect(getExistingEmployeeAccessProvisioningEligibility({
      employmentStatus: "active",
      sourceApplicationId: 42,
    })).toEqual({
      eligible: false,
      reason: "This employee already has an APY HQ profile.",
    });
  });

  it("links one matching onboarding-complete legacy profile when the role and location agree", () => {
    expect(getLegacyEmployeeProfileLinkEligibility({
      matchingProfileCount: 1,
      matchingProfileIsActiveTeamMember: false,
      matchingProfileIsArchived: false,
      matchingProfileStatus: "onboarded",
      roleMatches: true,
      locationMatches: true,
      alreadyLinkedToAnotherEmployee: false,
    })).toEqual({ eligible: true, action: "link_existing_profile" });

    expect(getLegacyEmployeeProfileLinkEligibility({
      matchingProfileCount: 1,
      matchingProfileIsActiveTeamMember: false,
      matchingProfileIsArchived: false,
      matchingProfileStatus: "onboarded",
      roleMatches: false,
      locationMatches: true,
      alreadyLinkedToAnotherEmployee: false,
    })).toMatchObject({ eligible: false });

    expect(getLegacyEmployeeProfileLinkEligibility({
      matchingProfileCount: 2,
      matchingProfileIsActiveTeamMember: false,
      matchingProfileIsArchived: false,
      matchingProfileStatus: "onboarded",
      roleMatches: true,
      locationMatches: true,
      alreadyLinkedToAnotherEmployee: false,
    })).toMatchObject({ eligible: false });

    expect(getLegacyEmployeeProfileLinkEligibility({
      matchingProfileCount: 1,
      matchingProfileIsActiveTeamMember: false,
      matchingProfileIsArchived: false,
      matchingProfileStatus: "accepted",
      roleMatches: true,
      locationMatches: true,
      alreadyLinkedToAnotherEmployee: false,
    })).toMatchObject({ eligible: false });

    expect(getLegacyEmployeeProfileLinkEligibility({
      matchingProfileCount: 1,
      matchingProfileIsActiveTeamMember: false,
      matchingProfileIsArchived: false,
      matchingProfileStatus: "onboarded",
      roleMatches: true,
      locationMatches: true,
      alreadyLinkedToAnotherEmployee: true,
    })).toMatchObject({ eligible: false });
  });

  it("does not create a duplicate APY HQ profile when a contact already belongs to an applicant or staff profile", () => {
    expect(getDirectEmployeeContactEligibility({ hasEmployeeRecord: false, hasApplicantOrApyProfile: true })).toEqual({
      eligible: false,
      reason: "An existing applicant or APY HQ profile already uses this email address or phone number. Use that record instead of creating a duplicate.",
    });
    expect(getDirectEmployeeContactEligibility({ hasEmployeeRecord: true, hasApplicantOrApyProfile: false })).toEqual({
      eligible: false,
      reason: "An Employee Directory record already uses this email address or phone number. Update or restore that record instead of creating a duplicate.",
    });
    expect(getDirectEmployeeContactEligibility({ hasEmployeeRecord: false, hasApplicantOrApyProfile: false })).toEqual({ eligible: true });
  });

  it("allows a signed accepted new hire with no existing directory record and rejects only conflicting matches", () => {
    expect(getOnboardedApplicantContactMatchEligibility({
      matchingEmployeeCount: 0,
      matchingEmployeeSourceApplicationId: null,
    })).toEqual({ eligible: true });
    expect(getOnboardedApplicantContactMatchEligibility({
      matchingEmployeeCount: 1,
      matchingEmployeeSourceApplicationId: null,
    })).toEqual({ eligible: true });
    expect(getOnboardedApplicantContactMatchEligibility({
      matchingEmployeeCount: 1,
      matchingEmployeeSourceApplicationId: 99,
    })).toMatchObject({ eligible: false });
    expect(getOnboardedApplicantContactMatchEligibility({
      matchingEmployeeCount: 2,
      matchingEmployeeSourceApplicationId: null,
    })).toMatchObject({ eligible: false });
  });

  it("permits only a signed Accepted applicant with delivered onboarding documents to be added", () => {
    expect(getOnboardedApplicantDirectoryEligibility({ status: "accepted", onboardingSentAt: new Date(), signingComplete: true, existingEmployee: false })).toEqual({ eligible: true });
    expect(getOnboardedApplicantDirectoryEligibility({ status: "onboarded", onboardingSentAt: new Date(), signingComplete: true, existingEmployee: false })).toEqual({
      eligible: false,
      reason: "Only Accepted applicants can complete onboarding into the Employee Directory.",
    });
    expect(getOnboardedApplicantDirectoryEligibility({ status: "accepted", onboardingSentAt: null, signingComplete: true, existingEmployee: false })).toEqual({
      eligible: false,
      reason: "Send the onboarding documents before marking this applicant onboarded.",
    });
    expect(getOnboardedApplicantDirectoryEligibility({ status: "accepted", onboardingSentAt: new Date(), signingComplete: false, existingEmployee: false })).toEqual({
      eligible: false,
      reason: "Wait for the applicant to sign their Offer Letter and NDA before marking them onboarded.",
    });
    expect(getOnboardedApplicantDirectoryEligibility({ status: "accepted", onboardingSentAt: new Date(), signingComplete: true, existingEmployee: true })).toEqual({
      eligible: false,
      reason: "This applicant already has an Employee Directory record.",
    });
  });

  it("does not restore historic APY HQ access without current onboarding evidence", () => {
    expect(getApyHqReactivationEligibility({
      status: "accepted",
      onboardingSentAt: null,
      signingComplete: false,
      directOwnerProvisioned: false,
    })).toMatchObject({ eligible: false });
    expect(getApyHqReactivationEligibility({
      status: "onboarded",
      onboardingSentAt: new Date(),
      signingComplete: false,
      directOwnerProvisioned: false,
    })).toMatchObject({ eligible: false });
    expect(getApyHqReactivationEligibility({
      status: "onboarded",
      onboardingSentAt: new Date(),
      signingComplete: true,
      directOwnerProvisioned: false,
    })).toEqual({ eligible: true });
    expect(getApyHqReactivationEligibility({
      status: "onboarded",
      onboardingSentAt: null,
      signingComplete: false,
      directOwnerProvisioned: true,
    })).toMatchObject({ eligible: false });
  });

  it("marks a departed employee inactive while retaining their source application and employment history", () => {
    const endedAt = new Date("2026-09-03T12:00:00.000Z");
    expect(getEmployeeDepartureUpdate(endedAt)).toEqual({ employmentStatus: "inactive", endedAt });
  });

  it("reactivates employment without granting APY HQ access", () => {
    expect(getEmployeeReactivationUpdate()).toEqual({ employmentStatus: "active", endedAt: null });
    expect(hasMatchingActiveTeamContact(
      { email: "former@example.com", phone: "+1 289-555-0100" },
      [{ email: "former@example.com", phone: "289-555-9999" }],
    )).toBe(true);
    expect(hasMatchingActiveTeamContact(
      { email: "former@example.com", phone: "+1 289-555-0100" },
      [{ email: "another@example.com", phone: "289-555-0100" }],
    )).toBe(true);
    expect(hasMatchingActiveTeamContact(
      { email: "former@example.com", phone: "+1 289-555-0100" },
      [{ email: "another@example.com", phone: "289-555-9999" }],
    )).toBe(false);
    expect(getEmployeeEmploymentReactivationEligibility({ employmentStatus: "inactive", hasApyHqAccess: false })).toEqual({ eligible: true });
    expect(getEmployeeEmploymentReactivationEligibility({ employmentStatus: "active", hasApyHqAccess: false })).toEqual({
      eligible: false,
      reason: "Only inactive employee records can be reactivated.",
    });
    expect(getEmployeeEmploymentReactivationEligibility({ employmentStatus: "inactive", hasApyHqAccess: true })).toEqual({
      eligible: false,
      reason: "Remove this person from APY HQ Team first so employment can be restored without leaving staff access active.",
    });
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
