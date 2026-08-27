import { describe, expect, it } from "vitest";
import { modulesForRole, TRAINING_MODULES } from "../shared/trainingCatalog";

describe("role-based training catalog", () => {
  it("includes common and role-specific modules", () => {
    const yoga = modulesForRole("Yoga Instructor");
    expect(yoga.some((module) => module.role === "All Staff")).toBe(true);
    expect(yoga.some((module) => module.role === "Yoga Instructor")).toBe(true);
    expect(yoga.some((module) => module.role === "Puppy Monitor")).toBe(false);
  });

  it("supports database-normalized role names and complete lessons", () => {
    expect(modulesForRole("puppy_monitor").map((module) => module.key)).toContain("pm-puppy-care");
    expect(TRAINING_MODULES.every((module) => module.lessons.length >= 4)).toBe(true);
  });

  it("contains the APY-specific onboarding and operations requirements", () => {
    const puppyModules = modulesForRole("Puppy Monitor");
    const lessons = puppyModules.flatMap((module) => module.lessons).join(" ");
    expect(lessons).toContain("two or three shadow classes");
    expect(lessons).toContain("Arrive 60 minutes");
    expect(lessons).toContain("two assigned Puppy Monitors");
    expect(modulesForRole("Operations Manager").flatMap((module) => module.lessons).join(" ")).toContain("Luma check-in");
  });

  it("uses the APY Yoga Instructor Guide for class timing and safety", () => {
    const yogaLessons = modulesForRole("Yoga Instructor").flatMap((module) => module.lessons).join(" ");
    expect(yogaLessons).toContain("minutes 0–10");
    expect(yogaLessons).toContain("two at a time about every five minutes");
    expect(yogaLessons).toContain("Begin Shavasana at about 30 minutes");
    expect(yogaLessons).toContain("end promptly at 40 minutes");
    expect(yogaLessons).toContain("must not be picked up");
    expect(yogaLessons).toContain("group photo");
  });
});
