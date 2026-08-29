import { describe, expect, it } from "vitest";
import { APP_STATUS } from "./careers";

describe("job application interview statuses", () => {
  it("keeps an interview request separate from a confirmed interview schedule", () => {
    expect(APP_STATUS).toContain("interview_requested");
    expect(APP_STATUS).toContain("interview_scheduled");
    expect(APP_STATUS.indexOf("interview_requested")).not.toBe(APP_STATUS.indexOf("interview_scheduled"));
  });
});
