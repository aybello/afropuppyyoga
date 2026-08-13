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

  it("rejects an unsupported role or location", () => {
    expect(() => directTeamMemberSchema.parse({ name: "Taylor James", email: "taylor@example.com", role: "CEO", location: "TOR" })).toThrow();
  });
});
