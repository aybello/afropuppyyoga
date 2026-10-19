import { describe, expect, it } from "vitest";
import { APY_TEAM_ROLES } from "../shared/apyPermissions";
import {
  getRoleWelcome,
  INVOICE_EXAMPLE,
  INVOICE_GUIDE_STEPS,
  INVOICE_TEMPLATE,
} from "../shared/staffGettingStarted";
import { modulesForRole, TRAINING_MODULES } from "../shared/trainingCatalog";

function welcomeText(role: string) {
  const welcome = getRoleWelcome(role);
  return [welcome.summary, ...welcome.expectations].join(" ");
}

const guideText = INVOICE_GUIDE_STEPS.map(({ title, description }) => `${title}: ${description}`).join(" ");

describe("Get Started role welcome", () => {
  it.each(APY_TEAM_ROLES)("provides short, non-contract orientation for %s", (role) => {
    const welcome = getRoleWelcome(role);
    expect(welcome.summary.trim().length).toBeGreaterThan(0);
    expect(welcome.expectations.length).toBeGreaterThan(0);
    expect(welcome.expectations.length).toBeLessThanOrEqual(3);
    expect(welcome.expectations.every((item) => item.trim().length > 0)).toBe(true);
    expect(welcomeText(role)).not.toMatch(/\$|\b\d+\b|volunteer|unpaid|probation|mandatory|must complete|payment approval|manager permissions/i);
  });

  it.each([
    "Operations Manager",
    "Operations Specialist",
    "Yoga Instructor",
    "Movement Instructor",
    "Puppy Monitor",
    "Social Media Intern",
    "Social Media Specialist",
  ])("normalizes the saved role label for %s", (role) => {
    expect(getRoleWelcome(`  ${role.toUpperCase().replaceAll(" ", "_")}  `)).toEqual(getRoleWelcome(role));
    expect(getRoleWelcome(role.toLowerCase().replaceAll(" ", "-"))).toEqual(getRoleWelcome(role));
  });

  it("keeps operations support distinct from management access and payment authority", () => {
    expect(welcomeText("Operations Manager")).toMatch(/coordinate event readiness/i);
    const specialist = welcomeText("Operations Specialist");
    expect(specialist).toMatch(/guest check-in/i);
    expect(specialist).toMatch(/escalate issues to APY leadership/i);
    expect(specialist).not.toMatch(/operations manager|manage staff|dashboard|approve|refund|payment|teach|lead.*yoga/i);
    expect(getRoleWelcome("Operations Specialist")).not.toEqual(getRoleWelcome("Operations Manager"));
  });

  it("keeps yoga teaching focused on instruction rather than puppy logistics", () => {
    const yoga = welcomeText("Yoga Instructor");
    expect(yoga).toMatch(/lead the yoga session/i);
    expect(yoga).toMatch(/focus on teaching/i);
    expect(yoga).not.toMatch(/manage puppy|count puppies|rotate puppies|guest check-in|clean accidents|room resets/i);
  });

  it("keeps movement gentle and distinct from yoga or dance teaching", () => {
    const movement = welcomeText("Movement Instructor");
    expect(movement).toMatch(/gentle, inclusive guided movement/i);
    expect(movement).toMatch(/rather than yoga instruction or dance choreography/i);
    expect(movement).toMatch(/direct puppy-care concerns to Puppy Monitors/i);
    expect(movement).not.toMatch(/lead.*yoga session|teach yoga|teach dance|manage puppy|clean accidents|guest check-in/i);
  });

  it("keeps Puppy Monitor guidance about care rather than teaching or management", () => {
    const monitor = welcomeText("Puppy Monitor");
    expect(monitor).toMatch(/puppy wellbeing/i);
    expect(monitor).toMatch(/rest and rotation/i);
    expect(monitor).toMatch(/clean and stocked/i);
    expect(monitor).not.toMatch(/teach|instruct|lead.*session|manage staff|approve|refund/i);
  });

  it.each(["Social Media Intern", "Social Media Specialist"])("does not give event-floor duties to %s", (role) => {
    const social = welcomeText(role);
    expect(social).toMatch(/create and edit content/i);
    expect(social).toMatch(/existing approval workflow/i);
    expect(social).toMatch(/community engagement/i);
    expect(social).not.toMatch(/puppy monitor|puppy care|puppy-care|rotation|room reset|venue setup|guest check-in|teach|instruct|lead.*class|arrive/i);
  });

  it.each(["", "Unknown Role", "BDR", "Puppy Specialist"])("uses neutral common guidance for %j, not Puppy Monitor duties", (role) => {
    expect(getRoleWelcome(role)).toEqual(getRoleWelcome("Unknown Role"));
    expect(getRoleWelcome(role)).not.toEqual(getRoleWelcome("Puppy Monitor"));
    const fallback = welcomeText(role);
    expect(fallback).toMatch(/your own signed documents/i);
    expect(fallback).not.toMatch(/puppy|rotation|clean|check-in|teach|social media/i);
  });
});

describe("Get Started invoice content", () => {
  it("explains the public form's actual fields, accepted file and size limit", () => {
    expect(INVOICE_GUIDE_STEPS.every((step) => step.title.trim() && step.description.trim())).toBe(true);
    expect(guideText).toContain("/submit-invoice");
    expect(guideText).not.toContain("/invoice-submit");
    expect(guideText).toContain("no login");
    expect(guideText).toContain("full name and email address");
    expect(guideText).toContain("PDF only, up to 16MB");
    expect(guideText).toContain("non-empty PDF");
    expect(guideText).toMatch(/invoice number and date, services, dates worked/i);
    expect(guideText).toContain("never include passwords, sign-in codes or card details");
    expect(guideText).not.toMatch(/\b(?:CSV|DOCX|JPEG|PNG)\b/);
  });

  it("distinguishes receipt from approval/payment and avoids duplicate submissions", () => {
    expect(guideText).toContain('"Invoice received"');
    expect(guideText).toContain("submitted for review, not approval or payment");
    expect(guideText).toContain("Do not resubmit the same invoice after success");
    expect(guideText).toContain("Submit another invoice is for a different invoice");
    expect(guideText).toMatch(/correction.*afropuppyyoga@gmail\.com/);
    expect(guideText).toContain("unsure whether it was received");
    expect(guideText).toContain("rather than sending a duplicate");
    expect(guideText).not.toMatch(/paid within|payment (?:date|deadline)|automatically approved|guaranteed/i);
  });

  it("uses an explicitly fictional example, not an actual compensation rate", () => {
    expect(INVOICE_EXAMPLE).toContain("FICTIONAL EXAMPLE: NOT FOR SUBMISSION");
    expect(INVOICE_EXAMPLE).toContain("Name: Alex Example");
    expect(INVOICE_EXAMPLE).toContain("Email: Example@example.com");
    expect(INVOICE_EXAMPLE).toContain("2 hours x CA$25/hour = CA$50");
    expect(INVOICE_EXAMPLE).toContain("not an actual role rate or a promise of compensation");
    expect(INVOICE_EXAMPLE).toContain("Never submit this example");
    expect(INVOICE_EXAMPLE).not.toMatch(/yoga instructor|movement instructor|puppy monitor|operations (?:manager|specialist)|social media/i);
  });

  it("offers a blank placeholder template without real compensation or sample identity", () => {
    expect(typeof INVOICE_TEMPLATE).toBe("string");
    expect(INVOICE_TEMPLATE).toContain("Name: [Your full name]");
    expect(INVOICE_TEMPLATE).toContain("Email: [Your email address]");
    expect(INVOICE_TEMPLATE).toContain("Service date(s): [Date(s) worked]");
    expect(INVOICE_TEMPLATE).toContain("Agreed rate or shift fee: [Your agreed amount and currency]");
    expect(INVOICE_TEMPLATE).toContain("Payment contact:");
    expect(INVOICE_TEMPLATE).toContain("never passwords or sign-in codes");
    expect(INVOICE_TEMPLATE).not.toMatch(/\d|\$|Alex Example|example@|<[^>]+>/i);
    expect(INVOICE_TEMPLATE).toContain("save as a PDF");
  });

  it.each([guideText, INVOICE_EXAMPLE, INVOICE_TEMPLATE])("keeps agreed compensation and tax obligations separate from illustration", (content) => {
    expect(content).toMatch(/agreed rate or shift fee/i);
    expect(content).toMatch(/only if applicable under your actual obligations/i);
    expect(content).toMatch(/not tax advice/i);
    expect(content).not.toMatch(/\b(?:HST|GST|13%|register for tax|tax exempt)\b/i);
  });
});

describe("invoice training module", () => {
  it("has a unique key, All Staff assignment and a direct guide reference", () => {
    const keys = TRAINING_MODULES.map((module) => module.key);
    expect(new Set(keys).size).toBe(keys.length);
    const invoiceModules = TRAINING_MODULES.filter((module) => module.key === "invoice-submission-v1");
    expect(invoiceModules).toHaveLength(1);
    const invoice = invoiceModules[0];
    expect(invoice.role).toBe("All Staff");
    expect(invoice.lessons.length).toBeGreaterThanOrEqual(4);
    const lessons = invoice.lessons.join(" ");
    expect(lessons).toContain("/staff/get-started#invoice");
    expect(lessons).toContain("/submit-invoice");
    expect(lessons).not.toContain("/invoice-submit");
    expect(lessons).toContain("full name and email address");
    expect(lessons).toContain("PDF only, up to 16MB");
    expect(lessons).toContain("no login");
    expect(lessons).toContain('"Invoice received"');
    expect(lessons).toContain("not approval or payment");
    expect(lessons).toContain("Do not resubmit the same invoice after success");
    expect(lessons).toContain("afropuppyyoga@gmail.com");
  });

  it.each(APY_TEAM_ROLES)("assigns invoice training exactly once to %s and its saved role label", (role) => {
    for (const label of [role, role.toLowerCase().replaceAll(" ", "_")]) {
      const invoiceModules = modulesForRole(label).filter((module) => module.key === "invoice-submission-v1");
      expect(invoiceModules).toHaveLength(1);
    }
  });
});
