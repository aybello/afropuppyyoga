import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "server/routers/careers.ts"), "utf8");

describe("rejection and onboarding race protection", () => {
  it("locks and rechecks the current application before sending a rejection email", () => {
    const start = source.indexOf("sendRejectionEmail: staffProcedure");
    const end = source.indexOf("requestVideo: staffProcedure", start);
    const rejectionRoute = source.slice(start, end);

    expect(rejectionRoute).toContain('.for("update")');
    expect(rejectionRoute).toContain("assertApplicantCanBeRejected(applicant)");
    expect(rejectionRoute.indexOf("assertApplicantCanBeRejected(applicant)"))
      .toBeLessThan(rejectionRoute.indexOf("await sendEmail"));
    expect(rejectionRoute).toContain("isNull(jobApplications.onboardingDeliveryToken)");
  });
});
