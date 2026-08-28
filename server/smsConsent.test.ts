import { describe, expect, it } from "vitest";
import { classifySmsConsentKeyword } from "./smsConsent";

describe("SMS consent keywords", () => {
  it.each(["STOP", " stop ", "StopAll", "UNSUBSCRIBE", "cancel", "END", "quit"])("suppresses on %s", (keyword) => expect(classifySmsConsentKeyword(keyword)).toBe("stop"));
  it.each(["START", " unstop ", "Yes"])("reactivates on %s", (keyword) => expect(classifySmsConsentKeyword(keyword)).toBe("start"));
  it("ignores conversational replies", () => expect(classifySmsConsentKeyword("please cancel my booking")).toBeNull());
});
