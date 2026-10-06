import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "fs";
const mocks = vi.hoisted(() => ({ state: [] as unknown[], index: 0, phoneOptions: null as any, emailOptions: null as any, verify: vi.fn(), navigate: vi.fn() }));
vi.mock("react", async (original) => ({ ...(await original<typeof import("react")>()), useState: (value: unknown) => { const i = mocks.index++; return [mocks.state[i] ?? value, vi.fn()]; } }));
vi.mock("wouter", () => ({ useLocation: () => ["/staff-access", mocks.navigate] }));
vi.mock("../client/src/lib/trpc", () => ({ trpc: { staff: {
  requestPhoneAccessCode: { useMutation: (options: any) => { mocks.phoneOptions = options; return { mutate: vi.fn(), reset: vi.fn(), isPending: false }; } },
  requestEmailAccessLink: { useMutation: (options: any) => { mocks.emailOptions = options; return { mutate: vi.fn(), reset: vi.fn(), isPending: false }; } },
  verifyPhoneAccessCode: { useMutation: () => ({ mutate: mocks.verify, reset: vi.fn(), isPending: false }) },
} } }));
import StaffAccess from "../client/src/pages/StaffAccess";
function render() { mocks.index = 0; return renderToStaticMarkup(createElement(StaffAccess)); }
beforeEach(() => { vi.clearAllMocks(); mocks.state = []; });
describe("staff sign-in screen", () => {
  it("does not advertise the owner's actual phone as the input example", () => {
    const html = render();
    expect(html).not.toContain("289"); expect(html).not.toContain("1885");
    expect(html).toContain("Enter your own mobile number"); expect(html).toContain("Email me a link"); expect(html).toContain("Managers use their own staff account");
    expect(html).toContain("<details"); expect(html).toContain("Owner sign-in only");
  });
  it("shows the submitted phone when awaiting a code without claiming an unrecognized account was sent one", () => {
    mocks.state = ["phone", "+12265550123", "", "+12265550123", "", "", true, false];
    const html = render(); expect(html).toContain("+12265550123"); expect(html).toContain("is saved on an active account"); expect(html).toContain("Change number");
  });
  it("offers an email form for staff who already have login access", () => {
    mocks.state = ["email"]; const html = render(); expect(html).toContain('type="email"'); expect(html).toContain("Enter your own email address"); expect(html).toContain("Send sign-in link");
  });
  it("shows only the submitted email and correct link expiry on success", () => {
    mocks.state = ["email", "", "manager@example.com", "", "manager@example.com", "", false, true]; const html = render(); expect(html).toContain("manager@example.com"); expect(html).toContain("15 minutes"); expect(html).toContain("If");
  });
  it("binds code verification to the submitted request rather than a later edited phone", () => {
    const source = readFileSync("client/src/pages/StaffAccess.tsx", "utf8");
    expect(source).toContain("phone: submittedPhone, code"); expect(source).toContain("setSubmittedPhone(input.phone.trim())");
  });
});
