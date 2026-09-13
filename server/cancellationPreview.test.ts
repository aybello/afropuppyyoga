import { describe, expect, it } from "vitest";

import {
  buildCancellationMessagePreview,
  createCancellationPreviewKey,
  isCurrentCancellationPreviewKey,
} from "./cancellationPreview";

const previewInput = {
  eventApiId: "evt-kitchener-dachshunds",
  eventName: "AfroPuppyYoga | Kitchener | Dachshunds",
  eventStartAt: "2026-09-12T15:00:00.000Z",
  customMessage: "",
  audienceFingerprint: "approved-audience-v1",
};

describe("preview-gated cancellation delivery", () => {
  it("renders the exact recipient-visible email and SMS copy with the Ontario class-date code before delivery", () => {
    const preview = buildCancellationMessagePreview(previewInput);

    expect(preview.rebookingCode).toBe("SEP12");
    expect(preview.email.subject).toBe("Important: Your AfroPuppyYoga class has been cancelled");
    expect(preview.email.text).toContain('Your free rebooking code: SEP12');
    expect(preview.email.text).toContain("100% off any upcoming APY class");
    expect(preview.smsText).toContain("SEP12");
    expect(preview.smsText).toContain("100% off any future APY class");
    expect(preview.voiceText).toContain("has been cancelled");
  });

  it("rejects a confirmation when the reviewed class, message, or approved audience has changed", () => {
    const secret = "test-preview-secret";
    const previewKey = createCancellationPreviewKey(previewInput, secret);

    expect(isCurrentCancellationPreviewKey(previewKey, previewInput, secret)).toBe(true);
    expect(isCurrentCancellationPreviewKey(previewKey, { ...previewInput, customMessage: "Please contact us." }, secret)).toBe(false);
    expect(isCurrentCancellationPreviewKey(previewKey, { ...previewInput, audienceFingerprint: "approved-audience-v2" }, secret)).toBe(false);
    expect(isCurrentCancellationPreviewKey(previewKey, { ...previewInput, eventApiId: "evt-other" }, secret)).toBe(false);
  });
});
