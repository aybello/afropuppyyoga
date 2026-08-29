import { describe, expect, it } from "vitest";
import { directTeamMemberSchema, teamMemberActivitySchema, teamMemberProfileUpdateSchema, validateTeamAssignmentChange } from "./routers/staffAvailability";

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

  it("accepts only an explicit staff-profile activity state", () => {
    expect(teamMemberActivitySchema.parse({ id: 42, isActive: false })).toEqual({ id: 42, isActive: false });
    expect(() => teamMemberActivitySchema.parse({ id: 0, isActive: true })).toThrow();
  });
});
