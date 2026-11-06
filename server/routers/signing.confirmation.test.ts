import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseDocument } from "htmlparser2";
import { Element, isTag } from "domhandler";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  recordCurrentOfferSignature: vi.fn(),
  sendEmail: vi.fn(),
  notifyOwner: vi.fn(),
}));

vi.mock("../db", () => ({ getDb: mocks.getDb }));
vi.mock("../hiringOfferLifecycle", () => ({
  prepareHiringOffer: vi.fn(),
  recordCurrentOfferSignature: mocks.recordCurrentOfferSignature,
  withCurrentHiringOfferDelivery: vi.fn(),
}));
vi.mock("../email", () => ({ sendEmail: mocks.sendEmail }));
vi.mock("../_core/notification", () => ({ notifyOwner: mocks.notifyOwner }));

import { signingRouter } from "./signing";

const record = {
  id: 11,
  applicationId: 22,
  applicantName: "Alexia Example",
  applicantEmail: "recipient@example.test",
  role: "Puppy Monitor",
  location: "Hamilton",
  privateStaffNotes: "PRIVATE_STAFF_NOTE",
  phone: "PRIVATE_PHONE",
};
const input = {
  token: "fictional-token",
  signedName: "Alexia Example",
  confirmedOfferLetterType: "puppy_monitor_hamilton",
  confirmedPuppyMonitorShiftPayCad: 50 as const,
  confirmedDocumentSha256: "a".repeat(64),
};

async function submit() {
  const caller = signingRouter.createCaller({ user: null, req: { headers: {} } } as never);
  expect(await caller.submitSignature(input)).toEqual({ success: true });
  expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
  return mocks.sendEmail.mock.calls[0][0] as { to: string; subject: string; html: string; text: string };
}

function elements(root: ReturnType<typeof parseDocument>): Element[] {
  const result: Element[] = [];
  function visit(node: (typeof root.children)[number]) {
    if (isTag(node)) result.push(node);
    if ("children" in node) node.children.forEach(visit);
  }
  root.children.forEach(visit);
  return result;
}

beforeEach(() => {
  vi.resetAllMocks();
  const db = { insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })) };
  mocks.getDb.mockResolvedValue(db);
  mocks.recordCurrentOfferSignature.mockResolvedValue(record);
  mocks.sendEmail.mockResolvedValue(undefined);
  mocks.notifyOwner.mockResolvedValue(undefined);
});

describe("signature confirmation email", () => {
  it("confirms the current documents without promising new onboarding or revealing staff profile data", async () => {
    const message = await submit();
    expect(message.to).toBe(record.applicantEmail);
    for (const body of [message.html, message.text]) {
      expect(body).toMatch(/received your signed/i);
      expect(body).toMatch(/offer letter and NDA/i);
      expect(body).toContain("Puppy Monitor");
      expect(body).toContain("Hamilton");
      expect(body).not.toMatch(/onboarding|orientation|welcome to the (?:pack|family)|join(?:ing)? (?:the|our) team/i);
      expect(body).not.toContain("PRIVATE_STAFF_NOTE");
      expect(body).not.toContain("PRIVATE_PHONE");
    }
  });

  it("HTML-escapes applicant name, role and location while keeping plain text readable", async () => {
    const applicantName = `A<&>\"'`;
    const role = `</strong><img src=x onerror=alert(1)>&\"'`;
    const location = `</strong><script>alert(2)</script>&\"'`;
    mocks.recordCurrentOfferSignature.mockResolvedValue({ ...record, applicantName, role, location });
    const { html, text } = await submit();
    expect(html).toContain("A&lt;&amp;&gt;&quot;&#39;");
    expect(html).toContain("&lt;/strong&gt;&lt;img src=x onerror=alert(1)&gt;&amp;&quot;&#39;");
    expect(html).toContain("&lt;/strong&gt;&lt;script&gt;alert(2)&lt;/script&gt;&amp;&quot;&#39;");
    const tags = elements(parseDocument(html));
    expect(tags.filter(tag => tag.name === "script")).toHaveLength(0);
    expect(tags.filter(tag => tag.name === "img")).toHaveLength(1); // The static brand logo only.
    expect(tags.some(tag => Object.keys(tag.attribs).some(key => /^on/i.test(key)))).toBe(false);
    expect(text).toContain(applicantName);
    expect(text).toContain(role);
    expect(text).toContain(location);
  });
});
