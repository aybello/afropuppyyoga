import { describe, expect, it } from "vitest";
import { modulesForRole, TRAINING_MODULES } from "./trainingCatalog";

describe("role-based training catalog", () => {
  it("includes common and role-specific modules", () => {
    const yoga = modulesForRole("Yoga Instructor");
    expect(yoga.some((module) => module.role === "All Staff")).toBe(true);
    expect(yoga.some((module) => module.role === "Yoga Instructor")).toBe(true);
    expect(yoga.some((module) => module.role === "Puppy Monitor")).toBe(false);
  });

  it("supports database-normalized role names", () => {
    expect(modulesForRole("puppy_monitor").map((module) => module.key)).toContain("pm-puppy-care");
    expect(TRAINING_MODULES.every((module) => module.lessons.length >= 4)).toBe(true);
  });
});
