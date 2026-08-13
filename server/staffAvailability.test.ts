import { describe, expect, it } from "vitest";
import { directTeamMemberSchema } from "./routers/staffAvailability";

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

  it("rejects an unsupported role or location", () => {
    expect(() => directTeamMemberSchema.parse({ name: "Taylor James", email: "taylor@example.com", role: "CEO", location: "TOR" })).toThrow();
  });
});
