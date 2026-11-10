import { describe, expect, it } from "vitest";
import { filterCareers } from "../client/src/pages/careerFilters";
import { JOB_LISTINGS } from "../client/src/pages/Careers";

describe("career discovery filters", () => {
  it("shows every existing job by default without altering the source list", () => {
    expect(filterCareers(JOB_LISTINGS, "all", "all")).toEqual(JOB_LISTINGS);
    expect(new Set(JOB_LISTINGS.map(job => job.id)).size).toBe(JOB_LISTINGS.length);
  });

  it("finds Guelph jobs while keeping their existing compensation", () => {
    const guelph = filterCareers(JOB_LISTINGS, "GUE", "all");
    expect(guelph.map(job => [job.title, job.pay])).toEqual([
      ["Movement Instructor", "CA$22/hr"],
      ["Puppy Monitor", "CA$60/shift"],
      ["Operations Specialist", "CA$20/hr"],
    ]);
  });

  it("includes roles offered in more than one city in both locations", () => {
    for (const city of ["HAM", "KW"]) {
      expect(filterCareers(JOB_LISTINGS, city, "Puppy Specialist").map(job => job.id)).toEqual(["puppy-specialist"]);
    }
  });

  it("combines role and location and has an empty state for no match", () => {
    expect(filterCareers(JOB_LISTINGS, "OAK", "Yoga Instructor").map(job => job.id)).toEqual(["yoga-instructor-oakville"]);
    expect(filterCareers(JOB_LISTINGS, "OAK", "Social Media Intern")).toEqual([]);
    expect(filterCareers(JOB_LISTINGS, "REMOTE", "Social Media Intern")[0]?.pay).toBe("CA$19/hr");
  });
});
