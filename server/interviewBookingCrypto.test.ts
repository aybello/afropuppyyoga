import { generateKeyPairSync } from "node:crypto";
import { createRequire } from "node:module";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { BookingEvent } from "./interviewBookingDetection";

// Only the IMAP transport is replaced. MIME parsing, signing, verification, and
// booking policy all run for real; no mailbox or external DNS server is contacted.
const imap = vi.hoisted(() => ({
  constructor: vi.fn(),
  connect: vi.fn(),
  getMailboxLock: vi.fn(),
  search: vi.fn(),
  fetchOne: vi.fn(),
  logout: vi.fn(),
  close: vi.fn(),
  release: vi.fn(),
}));
vi.mock("imapflow", () => ({ ImapFlow: imap.constructor }));

const require = createRequire(import.meta.url);
const dns = require("node:dns") as {
  promises: { resolve: (hostname: string, rrtype: string) => Promise<string[][]> };
};
const { dkimSign } = require("mailauth/lib/dkim/sign") as {
  dkimSign: (source: Buffer, options: {
    signatureData: Array<{ signingDomain: string; selector: string; privateKey: string; maxBodyLength?: number }>;
    signTime: Date;
    headerList: string;
  }) => Promise<{ signatures: string; errors: unknown[] }>;
};
type Signature = {
  signingDomain: string;
  status: { result: string; comment?: string };
  signingHeaders: { keys: string };
  canonBodyLength: number;
  canonBodyLengthTotal: number;
  signTime: string;
};
// Deliberately never spy on, mock, or replace this CommonJS verifier export.
const mailauth = require("mailauth/lib/dkim/verify") as {
  dkimVerify: (source: Buffer, options: { curTime: Date }) => Promise<{ results: Signature[] }>;
};
const realDkimVerify = mailauth.dkimVerify;

const signTime = new Date("2026-10-14T19:43:28Z");
const internalDate = new Date("2026-10-14T19:45:00Z");
const headerList = "sender:from:subject:message-id:content-type:to:date:mime-version";
const mailbox = "afropuppyyoga@gmail.com";
const eventId = "offline-crypto-event@google.com";
const slotLabel = "Thu Oct 15, 2026 6:40pm - 7:20pm (EDT)";
const subject = `Appointment booked: AfroPuppyYoga Meeting (Applicant) @ ${slotLabel} (AfroPuppyYoga)`;
const expectedBooking: BookingEvent = {
  kind: "booked",
  attendeeEmail: "applicant@example.com",
  slotLabel,
  receivedAt: signTime,
  eventId,
};

function calendar(): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AfroPuppyYoga//Offline DKIM Test//EN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${eventId}`,
    "DTSTAMP:20261014T194328Z",
    "DTSTART:20261015T224000Z",
    "DTEND:20261015T232000Z",
    `ORGANIZER;CN=AfroPuppyYoga:mailto:${mailbox}`,
    `ATTENDEE;ROLE=REQ-PARTICIPANT:mailto:${mailbox}`,
    "ATTENDEE;CN=Applicant;PARTSTAT=ACCEPTED:mailto:applicant@example.com",
    "SUMMARY:AfroPuppyYoga Meeting (Applicant)",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

function unsignedMessage(): Buffer {
  return Buffer.from([
    `From: AfroPuppyYoga <${mailbox}>`,
    "Sender: calendar-notification@google.com",
    `To: ${mailbox}`,
    `Subject: ${subject}`,
    "Message-ID: <calendar-fe018076-c283-4df1-9ce3-9a30afdd47be@google.com>",
    // Neither Date nor IMAP receipt time is the immutable event timestamp.
    "Date: Wed, 14 Oct 2026 19:44:00 +0000",
    "MIME-Version: 1.0",
    "Content-Type: multipart/mixed; boundary=offline-crypto-boundary",
    // An untrusted authentication claim must not rescue any negative test.
    "Authentication-Results: attacker.example; dkim=pass header.d=google.com",
    "",
    "--offline-crypto-boundary",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    "Your appointment is booked. Body integrity sentinel: original.",
    "--offline-crypto-boundary",
    "Content-Type: text/calendar; charset=UTF-8; method=REQUEST",
    'Content-Disposition: attachment; filename="invite.ics"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(calendar()).toString("base64").match(/.{1,76}/g)!.join("\r\n"),
    "--offline-crypto-boundary--",
    "",
  ].join("\r\n"));
}

let inbox: typeof import("./interviewBookingInbox");
let privateKey: string;
let dnsKey: string;
let resolve: ReturnType<typeof vi.spyOn<typeof dns.promises, "resolve">>;
let expectedDnsName: string;

beforeAll(async () => {
  const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
  privateKey = keys.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const publicKey = keys.publicKey.export({ type: "spki", format: "der" }).toString("base64");
  dnsKey = `v=DKIM1; k=rsa; p=${publicKey}`;
  expect(vi.isMockFunction(realDkimVerify)).toBe(false);
  // The inbox destructures require('mailauth/lib/dkim/verify') at import time.
  // Import the actual module, rather than mocking its verification decision.
  vi.resetModules();
  inbox = await import("./interviewBookingInbox");
});

beforeEach(() => {
  expectedDnsName = "offline._domainkey.google.com";
  resolve = vi.spyOn(dns.promises, "resolve").mockResolvedValue([[dnsKey]]);
  Object.values(imap).forEach((mock) => mock.mockReset());
  imap.constructor.mockImplementation(function () { return imap; });
  imap.connect.mockResolvedValue(undefined);
  imap.getMailboxLock.mockResolvedValue({ release: imap.release });
  imap.search.mockResolvedValue([]);
  imap.logout.mockResolvedValue(undefined);
});

afterEach(() => {
  try {
    expect(mailauth.dkimVerify).toBe(realDkimVerify);
    expect(vi.isMockFunction(mailauth.dkimVerify)).toBe(false);
    expect(resolve).toHaveBeenCalled();
    // Every lookup is served by the spy, and only this test's selector/domain
    // may be queried. In particular, no live Google key lookup can occur.
    for (const call of resolve.mock.calls) {
      expect(call).toEqual([expectedDnsName, "TXT"]);
    }
  } finally {
    resolve.mockRestore();
    vi.unstubAllEnvs();
  }
});

afterAll(() => { vi.resetModules(); });

async function sign(source = unsignedMessage(), options: {
  signingDomain?: "google.com" | "gmail.com";
  headerList?: string;
  maxBodyLength?: number;
} = {}): Promise<Buffer> {
  const signed = await dkimSign(source, {
    signatureData: [{
      signingDomain: options.signingDomain ?? "google.com",
      selector: "offline",
      privateKey,
      ...(options.maxBodyLength === undefined ? {} : { maxBodyLength: options.maxBodyLength }),
    }],
    signTime,
    headerList: options.headerList ?? headerList,
  });
  expect(signed.errors).toEqual([]);
  expect(signed.signatures).toMatch(/^DKIM-Signature:/);
  return Buffer.concat([Buffer.from(signed.signatures), source]);
}

async function verifiedSignature(source: Buffer): Promise<Signature> {
  const result = await mailauth.dkimVerify(source, { curTime: internalDate });
  expect(result.results).toHaveLength(1);
  return result.results[0];
}

describe("offline Google Calendar cryptographic integration", () => {
  it("accepts a fully signed Google MIME source after real RSA-2048 verification", async () => {
    const source = await sign();
    const signature = await verifiedSignature(source);
    expect(signature.status.result).toBe("pass");
    expect(signature.signingDomain).toBe("google.com");
    expect(signature.signTime).toBe(signTime.toISOString());
    expect(signature.canonBodyLength).toBeGreaterThan(0);
    expect(signature.canonBodyLength).toBe(signature.canonBodyLengthTotal);
    expect(signature.signingHeaders.keys.toLowerCase().split(":").map((key) => key.trim()))
      .toEqual(expect.arrayContaining(headerList.split(":")));
    await expect(inbox.hasGoogleCalendarSignature(source, internalDate)).resolves.toBe(true);
    await expect(inbox.parseVerifiedCalendarSource(source, internalDate)).resolves.toEqual(expectedBooking);
  });

  it.each(["Subject", "body"] as const)("rejects a %s changed after signing", async (part) => {
    const original = await sign();
    expect((await verifiedSignature(original)).status.result).toBe("pass");
    const source = Buffer.from(original.toString("utf8").replace(
      part === "Subject" ? `Subject: ${subject}` : "Body integrity sentinel: original.",
      part === "Subject" ? `Subject: ${subject.replace("6:40pm", "7:40pm")}` : "Body integrity sentinel: tampered.",
    ));
    expect(source.equals(original)).toBe(false);
    const signature = await verifiedSignature(source);
    expect(signature.status.result).not.toBe("pass");
    await expect(inbox.hasGoogleCalendarSignature(source, internalDate)).resolves.toBe(false);
    await expect(inbox.parseVerifiedCalendarSource(source, internalDate)).resolves.toBeNull();
  });

  it("rejects a cryptographically passing gmail.com signature on otherwise valid calendar MIME", async () => {
    expectedDnsName = "offline._domainkey.gmail.com";
    const source = await sign(undefined, { signingDomain: "gmail.com" });
    const signature = await verifiedSignature(source);
    expect(signature.status.result).toBe("pass");
    expect(signature.signingDomain).toBe("gmail.com");
    await expect(inbox.hasGoogleCalendarSignature(source, internalDate)).resolves.toBe(false);
    await expect(inbox.parseVerifiedCalendarSource(source, internalDate)).resolves.toBeNull();
  });

  it.each(["sender", "date"])("rejects a passing Google signature that does not sign %s", async (missing) => {
    // The raw header still exists, so this isolates signed-header policy rather
    // than the parser's separate raw-header presence check.
    const source = await sign(undefined, {
      headerList: headerList.split(":").filter((key) => key !== missing).join(":"),
    });
    const signature = await verifiedSignature(source);
    expect(signature.status.result).toBe("pass");
    expect(signature.signingHeaders.keys.toLowerCase().split(":").map((key) => key.trim())).not.toContain(missing);
    await expect(inbox.hasGoogleCalendarSignature(source, internalDate)).resolves.toBe(false);
    await expect(inbox.parseVerifiedCalendarSource(source, internalDate)).resolves.toBeNull();
  });

  it("rejects a passing partial-body signature when canonical body coverage is incomplete", async () => {
    const source = await sign(undefined, { maxBodyLength: 64 });
    const signature = await verifiedSignature(source);
    expect(signature.status.result).toBe("pass");
    expect(signature.canonBodyLength).toBe(64);
    expect(signature.canonBodyLengthTotal).toBeGreaterThan(signature.canonBodyLength);
    await expect(inbox.hasGoogleCalendarSignature(source, internalDate)).resolves.toBe(false);
    await expect(inbox.parseVerifiedCalendarSource(source, internalDate)).resolves.toBeNull();
  });

  it("rejects a prepended duplicate Subject even though the original signed header still verifies", async () => {
    const signed = await sign();
    const injected = Buffer.concat([
      Buffer.from(`Subject: ${subject.replace("6:40pm", "7:40pm")}\r\n`),
      signed,
    ]);
    // DKIM selects the bottom-most Subject named in h=, leaving a prepended
    // duplicate unsigned. The raw-header cardinality check must close that gap.
    const signature = await verifiedSignature(injected);
    expect(signature.status.result).toBe("pass");
    await expect(inbox.hasGoogleCalendarSignature(injected, internalDate)).resolves.toBe(true);
    await expect(inbox.parseVerifiedCalendarSource(injected, internalDate)).resolves.toBeNull();
  });

  it("keeps the signed DTSTAMP event time unchanged on redelivery with a later IMAP internalDate", async () => {
    const source = await sign();
    const laterInternalDate = new Date("2026-10-18T10:00:00Z");
    vi.stubEnv("GMAIL_APP_PASSWORD", "offline-test-password");
    imap.search.mockResolvedValue([17]);
    for (const date of [internalDate, laterInternalDate]) {
      imap.fetchOne.mockResolvedValueOnce({ size: source.length, internalDate: date })
        .mockResolvedValueOnce({ source });
    }
    const original = await inbox.fetchInterviewBookingEvents();
    const redelivered = await inbox.fetchInterviewBookingEvents();
    expect(original).toEqual([expectedBooking]);
    expect(redelivered).toEqual(original);
    expect(redelivered[0].receivedAt.toISOString()).toBe("2026-10-14T19:43:28.000Z");
    expect(redelivered[0].receivedAt).not.toEqual(internalDate);
    expect(redelivered[0].receivedAt).not.toEqual(laterInternalDate);
    expect(inbox.calendarIdentity(calendar())?.eventTimestamp).toEqual(signTime);
    expect(imap.fetchOne.mock.calls).toEqual([
      ["17", { size: true, internalDate: true }, { uid: true }],
      ["17", { source: true }, { uid: true }],
      ["17", { size: true, internalDate: true }, { uid: true }],
      ["17", { source: true }, { uid: true }],
    ]);
    expect(imap.getMailboxLock).toHaveBeenCalledWith("[Gmail]/All Mail", { readOnly: true });
    expect(imap.release).toHaveBeenCalledTimes(2);
    expect(imap.logout).toHaveBeenCalledTimes(2);
  });
});
