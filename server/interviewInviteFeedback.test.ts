import { describe, expect, it } from "vitest";
import { describeInterviewInviteDelivery, type InterviewInviteDelivery } from "../shared/interviewInviteDelivery";

const emailStatuses = ["sent", "unknown", "failed"] as const;
const smsStatuses = ["queued", "sent", "delivered", "skipped", "failed", "unknown"] as const;

function feedback(email: InterviewInviteDelivery["email"], sms: InterviewInviteDelivery["sms"], trackingWarning?: string) {
  return describeInterviewInviteDelivery({ email, sms, trackingWarning });
}

describe("interview invitation delivery feedback", () => {
  it.each([
    ["sent", "Email accepted for sending."],
    ["unknown", "Email outcome unconfirmed. Check the APY Sent folder before sending again."],
    ["failed", "Email was not sent."],
  ] as const)("describes %s email honestly", (status, expected) => {
    const result = feedback({ status }, { status: "delivered" });
    expect(result.message).toContain(expected);
    expect(result.warning).toBe(status !== "sent");
  });

  it.each([
    ["queued", "Text queued, not yet confirmed delivered."],
    ["sent", "Text sent to the carrier, not yet confirmed delivered."],
    ["delivered", "Text delivery confirmed by the provider."],
    ["skipped", "Text skipped. No eligible saved phone number."],
    ["failed", "Text was not sent. The provider rejected the text."],
    ["unknown", "Text outcome unconfirmed. Check delivery history before sending again."],
  ] as const)("describes %s SMS honestly", (status, expected) => {
    const result = feedback({ status: "sent" }, { status });
    expect(result.message).toContain(expected);
    expect(result.warning).toBe(!["queued", "sent", "delivered"].includes(status));
  });

  it("never upgrades queued SMS to a delivered claim", () => {
    const result = feedback({ status: "sent" }, { status: "queued" });
    expect(result.message).toContain("queued, not yet confirmed delivered");
    expect(result.message).not.toContain("Text delivery confirmed");
    expect(result.warning).toBe(false);
  });

  it("shows the safe reason when a text was not attempted because its delivery record could not be saved", () => {
    const result = feedback({ status: "sent" }, {
      status: "failed",
      reason: "Text was not attempted because its delivery record could not be saved.",
    });
    expect(result.message).toContain("Text was not sent. Text was not attempted because its delivery record could not be saved.");
    expect(result.warning).toBe(true);
  });

  it.each(["skipped", "failed", "unknown"] as const)("warns for %s SMS", (status) => {
    expect(feedback({ status: "sent" }, { status }).warning).toBe(true);
  });

  it("shows supplied safe reasons and warns when an accepted email has a ledger warning", () => {
    const result = feedback(
      { status: "sent", reason: "Email accepted, but tracking could not be finalized. Do not resend." },
      { status: "skipped", reason: "Applicant opted out." },
      "Delivery history could not be refreshed.",
    );

    expect(result).toEqual({
      message: "Email accepted for sending. Text skipped. Applicant opted out. Email accepted, but tracking could not be finalized. Do not resend. Delivery history could not be refreshed.",
      warning: true,
    });
  });

  it("warns for tracking issues even when both channels otherwise succeed", () => {
    const result = feedback({ status: "sent" }, { status: "delivered" }, "Tracking update pending.");
    expect(result.warning).toBe(true);
    expect(result.message).toContain("Tracking update pending.");
  });

  it("uses fixed public copy and does not invent raw provider secrets for every status pair", () => {
    for (const emailStatus of emailStatuses) {
      for (const smsStatus of smsStatuses) {
        const result = feedback({ status: emailStatus }, { status: smsStatus });
        expect(result.message).not.toMatch(/api[_ -]?key|auth[_ -]?token|password|secret|smtp response|providerMessageId/i);
      }
    }
  });
});
