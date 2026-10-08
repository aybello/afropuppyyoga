import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NEW_CAREERS_LISTINGS } from "../shared/newCareersListings";
import { JOB_LISTINGS, JobCard } from "../client/src/pages/Careers";
import { getOfferLetterContent } from "../client/src/pages/SignDocuments";
import { APY_TEAM_LOCATIONS, getApyAccessLevel, canManageOperations } from "../shared/apyPermissions";
import { buildEmployeeTeamTree } from "../shared/employeeTeamTree";
import { getEmployeeLoginDetails } from "./employeeLoginDetails";
import { directEmployeeSchema, getApprovedNewHirePortalAccessPlan } from "./routers/staffAvailability";
import { detectOfferLetterType } from "./signingPolicy";
import { modulesForRole } from "../shared/trainingCatalog";
import { buildNewRoleOnboardingEmail } from "./newRoleOnboardingEmail";

afterEach(() => vi.unstubAllGlobals());

describe("confirmed Kitchener and Guelph careers additions", () => {
  it("contains exactly the four requested location and pay combinations", () => {
    expect(NEW_CAREERS_LISTINGS.map((job) => [job.title, job.location, job.pay])).toEqual([
      ["Movement Instructor", "Kitchener", "CA$22/hr"],
      ["Movement Instructor", "Guelph", "CA$22/hr"],
      ["Puppy Monitor", "Guelph", "CA$60/shift"],
      ["Operations Specialist", "Guelph", "CA$20/hr"],
    ]);
    expect(new Set(JOB_LISTINGS.map((job) => job.id)).size).toBe(JOB_LISTINGS.length);
    expect(JOB_LISTINGS.find((job) => job.id === "yoga-instructor-kw")?.pay).toBe("$22/hr");
  });

  it.each(NEW_CAREERS_LISTINGS)("renders $id with an Apply action, approved pay and a working anchor", (job) => {
    vi.stubGlobal("window", { location: { origin: "https://example.com" } });
    const html = renderToStaticMarkup(createElement(JobCard, { job, expanded: true, onApply: () => {}, onToggle: () => {} }));
    expect(html).toContain(`id="${job.id}"`);
    expect(html).toContain(job.title);
    expect(html).toContain(job.location);
    expect(html).toContain(job.pay);
    expect(html).toContain("Apply");
  });

  it.each(NEW_CAREERS_LISTINGS)("supports $id in Directory, login and tree without management permissions", (job) => {
    const parsed = directEmployeeSchema.parse({ name: "Fictional Employee", email: "fictional@example.com", role: job.title, location: job.locationCode, startedAt: "2026-10-05" });
    expect(getApprovedNewHirePortalAccessPlan(parsed).portalAccessLevel).toBe("team_member");
    expect(getEmployeeLoginDetails({ ...parsed, phone: parsed.phone || null }).role).toBe(job.title);
    expect(canManageOperations(getApyAccessLevel(job.title))).toBe(false);
    const tree = buildEmployeeTeamTree([{ ...parsed, id: 1, sourceApplicationId: 2, employmentStatus: "active", hasApyHqAccess: true }]);
    expect(tree.find((branch) => branch.key === job.locationCode)?.roles[0].members).toHaveLength(1);
    if (job.locationCode === "GUE") expect(tree.find((branch) => branch.key === "GUE")?.label).toBe("Guelph");
    expect(APY_TEAM_LOCATIONS).toContain(job.locationCode);
  });

  it("gives movement hires their own CA$22 offer, not yoga pay or dance requirements", () => {
    expect(detectOfferLetterType("Movement Instructor", "GUE")).toBe("movement_instructor");
    expect(detectOfferLetterType("movement_instructor", "KW")).toBe("movement_instructor");
    const html = renderToStaticMarkup(getOfferLetterContent("Fictional Employee", "Movement Instructor", "Guelph", "movement_instructor", null, 22));
    expect(html).toContain("Movement Instructor");
    expect(html).toContain("CA$22.00 per hour");
    expect(html).toContain("gentle, beginner-friendly");
    expect(html).not.toContain("CA$20.00");
    expect(html).not.toContain("teaching yoga classes");
    expect(html).not.toContain("<strong>Yoga Instructor</strong>");
    expect(detectOfferLetterType("Yoga Instructor", "KW")).toBe("yoga_instructor");
    expect(detectOfferLetterType("Operations Specialist", "GUE")).toBe("operations_specialist");
  });

  it("assigns movement training without yoga lessons and Operations training without manager access", () => {
    const movement = modulesForRole("Movement Instructor");
    expect(movement.some((module) => module.role === "Movement Instructor")).toBe(true);
    expect(movement.some((module) => module.role === "Yoga Instructor")).toBe(false);
    expect(modulesForRole("Operations Specialist").some((module) => module.key === "ops-event-day")).toBe(true);
  });

  it("sends movement-specific onboarding with existing sign-in/training links and safely escaped resources", () => {
    const message = buildNewRoleOnboardingEmail({ applicantName: "<script>Example</script>", role: "Movement Instructor", location: "Guelph", orientationDate: "October 10", additionalNotes: "<unsafe>", documents: [{ title: "<Resource>", url: "https://example.com/a?x=1&y=2" }] });
    expect(message.text).toContain("gentle, beginner-friendly movements");
    expect(message.text).toContain("https://afropuppyyoga.ca/staff-access");
    expect(message.text).toContain("https://afropuppyyoga.ca/staff/training");
    expect(message.text).not.toContain("PM Availability");
    expect(message.text).not.toContain("Yoga Instructor Guide");
    expect(message.html).not.toContain("<script>");
    expect(message.html).toContain("&lt;Resource&gt;");
    expect(message.html).toContain("x=1&amp;y=2");
  });
});
