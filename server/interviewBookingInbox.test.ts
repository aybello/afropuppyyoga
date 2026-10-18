import { createRequire } from "node:module";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { BookingEvent } from "./interviewBookingDetection";

const imap = vi.hoisted(() => {
  const client = {
    connect: vi.fn(),
    getMailboxLock: vi.fn(),
    search: vi.fn(),
    fetchOne: vi.fn(),
    logout: vi.fn(),
    close: vi.fn(),
    messageFlagsAdd: vi.fn(),
    messageFlagsRemove: vi.fn(),
    messageFlagsSet: vi.fn(),
    messageMove: vi.fn(),
    messageDelete: vi.fn(),
    append: vi.fn(),
    mailboxCreate: vi.fn(),
    mailboxDelete: vi.fn(),
  };
  return { client, release: vi.fn(), constructor: vi.fn() };
});

vi.mock("imapflow", () => ({ ImapFlow: imap.constructor }));

const require = createRequire(import.meta.url);
const mailauth = require("mailauth/lib/dkim/verify") as {
  dkimVerify: (source: Buffer, options: { curTime: Date }) => Promise<{ results: Signature[] }>;
};
type Signature = {
  signingDomain: string;
  status: { result: string };
  signingHeaders?: { keys: string };
  canonBodyLength?: number;
  canonBodyLengthTotal?: number;
};
const signedKeys = ["sender", "from", "subject", "message-id", "content-type", "to", "date"];
const signature = (overrides: Partial<Signature> = {}): Signature => ({
  signingDomain: "google.com",
  status: { result: "pass" },
  signingHeaders: { keys: signedKeys.join(":") },
  ...overrides,
});

let inbox: typeof import("./interviewBookingInbox");
let verify: ReturnType<typeof vi.spyOn<typeof mailauth, "dkimVerify">>;

// The production module destructures a CommonJS createRequire export at load time.
// Install the spy BEFORE dynamic import; vi.mock alone cannot intercept that require.
// Only cryptographic verification is faked: mailparser and the detector run for real.
beforeAll(async () => {
  vi.resetModules();
  verify = vi.spyOn(mailauth, "dkimVerify");
  inbox = await import("./interviewBookingInbox");
});

beforeEach(() => {
  verify.mockReset().mockResolvedValue({ results: [signature()] });
  Object.values(imap.client).forEach((mock) => mock.mockReset());
  imap.release.mockReset();
  imap.constructor.mockReset().mockImplementation(function () { return imap.client; });
  imap.client.connect.mockResolvedValue(undefined);
  imap.client.getMailboxLock.mockResolvedValue({ release: imap.release });
  imap.client.search.mockResolvedValue([]);
  imap.client.logout.mockResolvedValue(undefined);
  vi.stubEnv("GMAIL_APP_PASSWORD", "offline-test-password");
});

afterEach(() => {
  // No test is allowed to mutate messages, flags, or folders, even on error paths.
  for (const method of ["messageFlagsAdd", "messageFlagsRemove", "messageFlagsSet", "messageMove", "messageDelete", "append", "mailboxCreate", "mailboxDelete"] as const) {
    expect(imap.client[method], `${method} must never be called`).not.toHaveBeenCalled();
  }
  vi.unstubAllEnvs();
});

afterAll(() => { verify.mockRestore(); });

const receivedAt = new Date("2026-10-14T19:43:28Z");
const slotLabel = "Thu Oct 15, 2026 6:40pm - 7:20pm (EDT)";
const eventId = "event-a@google.com";
const mailbox = "afropuppyyoga@gmail.com";
const subject = `Appointment booked: AfroPuppyYoga Meeting (Applicant) @ ${slotLabel} (AfroPuppyYoga)`;
const booking: BookingEvent = { kind: "booked", attendeeEmail: "applicant@example.com", slotLabel, receivedAt, eventId };

function calendar(method = "REQUEST"): string {
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", `METHOD:${method}`, "BEGIN:VEVENT",
    `UID:${eventId}`, "DTSTAMP:20261014T194328Z", "DTSTART:20261015T224000Z", "DTEND:20261015T232000Z",
    `ORGANIZER;CN=AfroPuppyYoga:mailto:${mailbox}`,
    `ATTENDEE;ROLE=REQ-PARTICIPANT:mailto:${mailbox}`,
    "ATTENDEE;CN=Applicant;PARTSTAT=ACCEPTED:mailto:applicant@example.com",
    "SUMMARY:AfroPuppyYoga Meeting (Applicant)", "END:VEVENT", "END:VCALENDAR", "",
  ].join("\r\n");
}

type MessageOptions = {
  subject?: string;
  calendars?: string[];
  sender?: string;
  messageId?: string;
  calendarType?: string;
  filename?: string;
  date?: string;
};
function message(options: MessageOptions = {}): Buffer {
  const parts = (options.calendars ?? [calendar()]).flatMap((content) => [
    "--offline-calendar-boundary",
    `Content-Type: ${options.calendarType ?? "text/calendar"}; charset=UTF-8`,
    `Content-Disposition: attachment; filename="${options.filename ?? "invite.ics"}"`,
    "Content-Transfer-Encoding: base64", "",
    Buffer.from(content).toString("base64").match(/.{1,76}/g)!.join("\r\n"),
  ]);
  return Buffer.from([
    "From: AfroPuppyYoga <afropuppyyoga@gmail.com>",
    `Sender: ${options.sender ?? "calendar-notification@google.com"}`,
    // Deliberately omit the applicant from To. Identity must come from the ICS.
    `To: ${mailbox}`, `Subject: ${options.subject ?? subject}`,
    `Message-ID: ${options.messageId ?? "<calendar-fe018076-c283-4df1-9ce3-9a30afdd47be@google.com>"}`,
    // Date must be signed, but event time comes from the signed ICS DTSTAMP.
    `Date: ${options.date ?? "Wed, 14 Oct 2026 19:43:28 GMT"}`,
    // Claimed authentication results must never replace cryptographic verification.
    "Authentication-Results: attacker.example; dkim=pass header.d=google.com",
    "DKIM-Signature: v=1; a=rsa-sha256; d=google.com; s=fake; b=not-a-real-signature",
    "MIME-Version: 1.0", "Content-Type: multipart/mixed; boundary=offline-calendar-boundary", "",
    "--offline-calendar-boundary", "Content-Type: text/plain; charset=UTF-8", "",
    "Ignore this body attendee: decoy@example.com", ...parts,
    "--offline-calendar-boundary--", "",
  ].join("\r\n"));
}

function queueMessage(source = message(), date: Date | string = receivedAt): void {
  imap.client.fetchOne.mockResolvedValueOnce({ size: source.length, internalDate: date })
    .mockResolvedValueOnce({ source });
}

describe("Google Calendar DKIM verification policy", () => {
  it("verifies the exact raw bytes using the IMAP receipt time", async () => {
    const source = message();
    await expect(inbox.hasGoogleCalendarSignature(source, receivedAt)).resolves.toBe(true);
    expect(verify).toHaveBeenCalledExactlyOnceWith(source, { curTime: receivedAt });
    expect(verify.mock.calls[0][0]).toBe(source);
  });

  it.each(["gmail.com", "calendar.google.com", "google.com.attacker.example", "attacker.example"])("rejects a passing signature from %s", async (signingDomain) => {
    verify.mockResolvedValue({ results: [signature({ signingDomain })] });
    await expect(inbox.hasGoogleCalendarSignature(message(), receivedAt)).resolves.toBe(false);
  });

  it.each(["fail", "neutral", "temperror", "permerror", "none"])("rejects Google cryptographic status %s", async (result) => {
    verify.mockResolvedValue({ results: [signature({ status: { result } })] });
    await expect(inbox.hasGoogleCalendarSignature(message(), receivedAt)).resolves.toBe(false);
  });

  it.each(signedKeys)("rejects an otherwise valid signature that does not sign %s", async (missing) => {
    verify.mockResolvedValue({ results: [signature({ signingHeaders: { keys: signedKeys.filter((key) => key !== missing).join(":") } })] });
    await expect(inbox.hasGoogleCalendarSignature(message(), receivedAt)).resolves.toBe(false);
  });

  it("rejects absent signing headers and an empty signature result", async () => {
    verify.mockResolvedValueOnce({ results: [signature({ signingHeaders: undefined })] })
      .mockResolvedValueOnce({ results: [] });
    await expect(inbox.hasGoogleCalendarSignature(message(), receivedAt)).resolves.toBe(false);
    await expect(inbox.hasGoogleCalendarSignature(message(), receivedAt)).resolves.toBe(false);
  });

  it("accepts mixed-case, whitespace-separated signed header keys", async () => {
    verify.mockResolvedValue({ results: [signature({ signingHeaders: { keys: "Sender : FROM : Subject : Message-ID : Content-Type : To : date" } })] });
    await expect(inbox.hasGoogleCalendarSignature(message(), receivedAt)).resolves.toBe(true);
  });

  it("requires all signed keys on one passing Google signature, not combined across signatures", async () => {
    verify.mockResolvedValue({ results: [
      signature({ signingHeaders: { keys: "sender:from:subject" } }),
      signature({ signingHeaders: { keys: "message-id:content-type:to:date" } }),
      signature({ signingDomain: "gmail.com" }),
    ] });
    await expect(inbox.hasGoogleCalendarSignature(message(), receivedAt)).resolves.toBe(false);
  });

  it("accepts a qualifying Google signature even alongside unrelated failures", async () => {
    verify.mockResolvedValue({ results: [signature({ status: { result: "fail" } }), signature({ signingDomain: "gmail.com" }), signature()] });
    await expect(inbox.hasGoogleCalendarSignature(message(), receivedAt)).resolves.toBe(true);
  });

  it.each([0, 100, 1001])("rejects a passing signature covering %i bytes of a 1000-byte canonical body", async (canonBodyLength) => {
    verify.mockResolvedValue({ results: [signature({ canonBodyLength, canonBodyLengthTotal: 1000 })] });
    await expect(inbox.hasGoogleCalendarSignature(message(), receivedAt)).resolves.toBe(false);
  });

  it("accepts a passing signature covering the entire canonical body", async () => {
    verify.mockResolvedValue({ results: [signature({ canonBodyLength: 1000, canonBodyLengthTotal: 1000 })] });
    await expect(inbox.hasGoogleCalendarSignature(message(), receivedAt)).resolves.toBe(true);
  });

  it("cannot combine complete body coverage with a different passing signature", async () => {
    verify.mockResolvedValue({ results: [
      signature({ canonBodyLength: 100, canonBodyLengthTotal: 1000 }),
      signature({ canonBodyLength: 1000, canonBodyLengthTotal: 1000, status: { result: "fail" } }),
    ] });
    await expect(inbox.hasGoogleCalendarSignature(message(), receivedAt)).resolves.toBe(false);
  });
});

describe("calendarIdentity", () => {
  it.each(["REQUEST", "CANCEL"])("extracts one %s event with parameterized organizer and attendees", (method) => {
    expect(inbox.calendarIdentity(calendar(method))).toEqual({
      eventId, organizer: mailbox, attendees: [mailbox, "applicant@example.com"],
      summary: "AfroPuppyYoga Meeting (Applicant)", method, eventTimestamp: receivedAt,
    });
  });

  it.each(["\r\n", "\n"])("unfolds space/tab continuations with %j line endings", (newline) => {
    const folded = calendar()
      .replace(`UID:${eventId}`, "UID:event-a@\r\n google.com")
      .replace(`mailto:${mailbox}`, "mailto:afropuppy\r\n\tyoga@gmail.com")
      .replace("mailto:applicant@example.com", "mailto:applicant@\r\n example.com")
      .replace("SUMMARY:AfroPuppyYoga Meeting", "SUMMARY:AfroPuppyYoga \r\n Meeting")
      .replace(/\r\n/g, newline);
    expect(inbox.calendarIdentity(folded)).toEqual(inbox.calendarIdentity(calendar()));
  });

  it("rejects missing and multiple VEVENT blocks", () => {
    expect(inbox.calendarIdentity("BEGIN:VCALENDAR\r\nMETHOD:REQUEST\r\nEND:VCALENDAR")).toBeNull();
    const event = calendar().match(/BEGIN:VEVENT[\s\S]*END:VEVENT/)![0];
    expect(inbox.calendarIdentity(calendar().replace("END:VCALENDAR", `${event}\r\nEND:VCALENDAR`))).toBeNull();
  });

  it("rejects missing or duplicate METHOD declarations", () => {
    expect(inbox.calendarIdentity(calendar().replace("METHOD:REQUEST\r\n", ""))).toBeNull();
    expect(inbox.calendarIdentity(calendar().replace("METHOD:REQUEST", "METHOD:REQUEST\r\nMETHOD:CANCEL"))).toBeNull();
  });

  it("rejects a missing DTSTAMP", () => {
    expect(inbox.calendarIdentity(calendar().replace("DTSTAMP:20261014T194328Z\r\n", ""))).toBeNull();
  });

  it.each(["20261014T194328Z", "20261015T194328Z"])("rejects duplicate DTSTAMP declarations even when the second is %s", (timestamp) => {
    const content = calendar().replace("DTSTAMP:20261014T194328Z", `DTSTAMP:20261014T194328Z\r\nDTSTAMP:${timestamp}`);
    expect(inbox.calendarIdentity(content)).toBeNull();
  });

  it.each([
    "", "not-a-date", "20261014", "20261014T194328", "20261014T194328+0000",
    "2026-10-14T19:43:28Z", "20261014T194328.000Z", "20261014t194328z",
    "20260230T194328Z", "20260229T194328Z", "20261314T194328Z", "20261000T194328Z",
    "20261014T244328Z", "20261014T196028Z", "20261014T194360Z",
  ])("rejects DTSTAMP values that are not valid UTC YYYYMMDDTHHMMSSZ (%j)", (timestamp) => {
    expect(inbox.calendarIdentity(calendar().replace("DTSTAMP:20261014T194328Z", `DTSTAMP:${timestamp}`))).toBeNull();
  });

  it.each(["UID", "ORGANIZER", "SUMMARY"] as const)("does not choose an arbitrary duplicate %s value", (key) => {
    const original = calendar().split("\r\n").find((line) => line.startsWith(`${key}:`) || line.startsWith(`${key};`))!;
    const identity = inbox.calendarIdentity(calendar().replace(original, `${original}\r\n${original}`));
    const property = { UID: "eventId", ORGANIZER: "organizer", SUMMARY: "summary" }[key] as "eventId" | "organizer" | "summary";
    expect(identity?.[property]).toBe("");
  });
});

describe("full-source MIME parsing with an isolated DKIM verifier", () => {
  it("decodes a base64 ICS attachment and uses its signed DTSTAMP as event time", async () => {
    const source = message();
    await expect(inbox.parseVerifiedCalendarSource(source, receivedAt)).resolves.toEqual(booking);
    expect(verify).toHaveBeenCalledExactlyOnceWith(source, { curTime: receivedAt });
  });

  it("keeps the signed ICS event time when delivery and the signed Date header are later", async () => {
    const deliveredAt = new Date("2026-10-17T20:00:00Z");
    const source = message({ date: "Sat, 17 Oct 2026 19:59:00 GMT" });
    await expect(inbox.parseVerifiedCalendarSource(source, deliveredAt)).resolves.toEqual(booking);
    expect(verify).toHaveBeenCalledExactlyOnceWith(source, { curTime: deliveredAt });
  });

  it.each(signedKeys)("rejects a missing required raw %s header", async (key) => {
    const source = message();
    const separator = source.indexOf("\r\n\r\n");
    const headers = source.subarray(0, separator).toString().split("\r\n");
    const retained = headers.filter((line) => !line.toLowerCase().startsWith(`${key}:`));
    const incomplete = Buffer.concat([Buffer.from(retained.join("\r\n")), source.subarray(separator)]);
    await expect(inbox.parseVerifiedCalendarSource(incomplete, receivedAt)).resolves.toBeNull();
  });

  it.each(signedKeys)("rejects duplicate required raw %s headers even with identical values and different casing", async (key) => {
    const source = message();
    const separator = source.indexOf("\r\n\r\n");
    const headers = source.subarray(0, separator).toString().split("\r\n");
    const original = headers.find((line) => line.toLowerCase().startsWith(`${key}:`))!;
    headers.push(`${key.toUpperCase()}${original.slice(original.indexOf(":"))}`);
    const ambiguous = Buffer.concat([Buffer.from(headers.join("\r\n")), source.subarray(separator)]);
    await expect(inbox.parseVerifiedCalendarSource(ambiguous, receivedAt)).resolves.toBeNull();
  });

  it.each([
    ["missing", calendar().replace("DTSTAMP:20261014T194328Z\r\n", "")],
    ["duplicate", calendar().replace("DTSTAMP:20261014T194328Z", "DTSTAMP:20261014T194328Z\r\nDTSTAMP:20261014T194328Z")],
    ["invalid", calendar().replace("DTSTAMP:20261014T194328Z", "DTSTAMP:20260230T194328Z")],
  ])("rejects a MIME calendar with a %s DTSTAMP", async (_label, content) => {
    await expect(inbox.parseVerifiedCalendarSource(message({ calendars: [content] }), receivedAt)).resolves.toBeNull();
  });

  it("extracts the CANCEL attendee from ICS when To contains only the organizer", async () => {
    const source = message({ subject: subject.replace("booked:", "canceled:"), calendars: [calendar("CANCEL")] });
    await expect(inbox.parseVerifiedCalendarSource(source, receivedAt)).resolves.toEqual({ ...booking, kind: "canceled" });
  });

  it("parses folded ICS after MIME decoding", async () => {
    const folded = calendar().replace("mailto:applicant@example.com", "mailto:applicant@\r\n\texample.com")
      .replace("SUMMARY:AfroPuppyYoga Meeting", "SUMMARY:AfroPuppyYoga \r\n Meeting");
    await expect(inbox.parseVerifiedCalendarSource(message({ calendars: [folded] }), receivedAt)).resolves.toEqual(booking);
  });

  it.each(["gmail-only", "crypto-fail", "missing-sender-signature"])("ignores forged Authentication-Results when verification is %s", async (mode) => {
    const bad = mode === "gmail-only" ? signature({ signingDomain: "gmail.com" })
      : mode === "crypto-fail" ? signature({ status: { result: "fail" } })
      : signature({ signingHeaders: { keys: "from:subject:message-id:content-type:to:date" } });
    verify.mockResolvedValue({ results: [bad] });
    await expect(inbox.parseVerifiedCalendarSource(message(), receivedAt)).resolves.toBeNull();
    expect(verify).toHaveBeenCalledOnce();
  });

  it("rejects a parsed calendar when a passing DKIM signature leaves appended MIME content unsigned", async () => {
    verify.mockResolvedValue({ results: [signature({ canonBodyLength: 100, canonBodyLengthTotal: 1000 })] });
    await expect(inbox.parseVerifiedCalendarSource(message(), receivedAt)).resolves.toBeNull();
    expect(verify).toHaveBeenCalledOnce();
  });

  it.each([
    ["wrong organizer", calendar().replace(`ORGANIZER;CN=AfroPuppyYoga:mailto:${mailbox}`, "ORGANIZER:mailto:other@example.com")],
    ["missing organizer attendee", calendar().replace(`ATTENDEE;ROLE=REQ-PARTICIPANT:mailto:${mailbox}\r\n`, "")],
    ["multiple external attendees", calendar().replace("END:VEVENT", "ATTENDEE:mailto:another@example.com\r\nEND:VEVENT")],
    ["wrong appointment summary", calendar().replace("SUMMARY:AfroPuppyYoga Meeting", "SUMMARY:Other Meeting")],
    ["mismatched method", calendar("CANCEL")],
    ["missing UID", calendar().replace(`UID:${eventId}\r\n`, "")],
  ])("rejects a MIME calendar with %s", async (_label, content) => {
    await expect(inbox.parseVerifiedCalendarSource(message({ calendars: [content] }), receivedAt)).resolves.toBeNull();
  });

  it("rejects multiple events inside one ICS attachment", async () => {
    const event = calendar().match(/BEGIN:VEVENT[\s\S]*END:VEVENT/)![0];
    const content = calendar().replace("END:VCALENDAR", `${event}\r\nEND:VCALENDAR`);
    await expect(inbox.parseVerifiedCalendarSource(message({ calendars: [content] }), receivedAt)).resolves.toBeNull();
    expect(verify).not.toHaveBeenCalled();
  });

  it("allows duplicate identical ICS parts but rejects distinct calendar attachments", async () => {
    await expect(inbox.parseVerifiedCalendarSource(message({ calendars: [calendar(), calendar()] }), receivedAt)).resolves.toEqual(booking);
    verify.mockClear();
    await expect(inbox.parseVerifiedCalendarSource(message({ calendars: [calendar(), calendar().replace(eventId, "event-b@google.com")] }), receivedAt)).resolves.toBeNull();
    expect(verify).not.toHaveBeenCalled();
  });

  it("recognizes a .ICS filename even with a generic attachment content type", async () => {
    await expect(inbox.parseVerifiedCalendarSource(message({ calendarType: "application/octet-stream", filename: "INVITE.ICS" }), receivedAt)).resolves.toEqual(booking);
  });

  it.each([
    { sender: "attacker@example.com" },
    { messageId: "<forged@gmail.com>" },
    { subject: `Re: ${subject}` },
    { subject: "Appointment booked: Other Meeting @ tomorrow" },
    { calendars: [] },
    { calendarType: "application/octet-stream", filename: "invite.txt" },
  ])("rejects untrusted identity, unrelated subject, or missing calendar (%j)", async (options) => {
    await expect(inbox.parseVerifiedCalendarSource(message(options), receivedAt)).resolves.toBeNull();
  });

  it("rejects invalid receipt dates and oversized raw source before verification", async () => {
    await expect(inbox.parseVerifiedCalendarSource(message(), new Date("invalid"))).resolves.toBeNull();
    await expect(inbox.parseVerifiedCalendarSource(Buffer.alloc(512_001), receivedAt)).resolves.toBeNull();
    expect(verify).not.toHaveBeenCalled();
  });

  it("propagates verifier errors instead of treating unverified mail as a booking", async () => {
    verify.mockRejectedValue(new Error("offline verification failure"));
    await expect(inbox.parseVerifiedCalendarSource(message(), receivedAt)).rejects.toThrow("offline verification failure");
  });
});

describe("read-only IMAP booking scan", () => {
  it("opens All Mail read-only and fetches metadata before the complete MIME source", async () => {
    const source = message();
    imap.client.search.mockResolvedValue([17]);
    queueMessage(source);
    await expect(inbox.fetchInterviewBookingEvents()).resolves.toEqual([booking]);
    expect(imap.constructor).toHaveBeenCalledOnce();
    expect(imap.client.connect).toHaveBeenCalledOnce();
    expect(imap.client.getMailboxLock).toHaveBeenCalledExactlyOnceWith("[Gmail]/All Mail", { readOnly: true });
    expect(imap.client.search).toHaveBeenCalledExactlyOnceWith({ gmraw: 'subject:"AfroPuppyYoga Meeting" newer_than:90d' }, { uid: true });
    expect(imap.client.fetchOne.mock.calls).toEqual([
      ["17", { size: true, internalDate: true }, { uid: true }],
      ["17", { source: true }, { uid: true }],
    ]);
    expect(verify).toHaveBeenCalledExactlyOnceWith(source, { curTime: receivedAt });
    expect(imap.release).toHaveBeenCalledOnce();
    expect(imap.client.logout).toHaveBeenCalledOnce();
    expect(imap.client.close).not.toHaveBeenCalled();
  });

  it("does not turn a later IMAP delivery date into a later booking event time", async () => {
    const deliveredAt = new Date("2026-10-17T20:00:00Z");
    const source = message();
    imap.client.search.mockResolvedValue([17]);
    queueMessage(source, deliveredAt);
    await expect(inbox.fetchInterviewBookingEvents()).resolves.toEqual([booking]);
    expect(verify).toHaveBeenCalledExactlyOnceWith(source, { curTime: deliveredAt });
  });

  it("returns both booked and canceled notices from real MIME parsing", async () => {
    imap.client.search.mockResolvedValue([1, 2]);
    queueMessage();
    queueMessage(message({ subject: subject.replace("booked:", "canceled:"), calendars: [calendar("CANCEL")] }));
    await expect(inbox.fetchInterviewBookingEvents({ days: 7 })).resolves.toEqual([booking, { ...booking, kind: "canceled" }]);
    expect(imap.client.search).toHaveBeenCalledWith({ gmraw: 'subject:"AfroPuppyYoga Meeting" newer_than:7d' }, { uid: true });
  });

  it("rejects more than 400 results before any metadata or source fetch", async () => {
    imap.client.search.mockResolvedValue(Array.from({ length: 401 }, (_, index) => index + 1));
    await expect(inbox.fetchInterviewBookingEvents()).rejects.toThrow("Too many calendar notices for a complete scan. Statuses unchanged.");
    expect(imap.client.fetchOne).not.toHaveBeenCalled();
    expect(verify).not.toHaveBeenCalled();
    expect(imap.release).toHaveBeenCalledOnce();
    expect(imap.client.logout).toHaveBeenCalledOnce();
  });

  it("scans all 400 results at the default boundary without truncating", async () => {
    imap.client.search.mockResolvedValue(Array.from({ length: 400 }, (_, index) => index + 1));
    imap.client.fetchOne.mockResolvedValue(false);
    await expect(inbox.fetchInterviewBookingEvents()).resolves.toEqual([]);
    expect(imap.client.fetchOne).toHaveBeenCalledTimes(400);
    expect(imap.client.fetchOne).toHaveBeenLastCalledWith("400", { size: true, internalDate: true }, { uid: true });
  });

  it("honors a custom maximum without silently truncating", async () => {
    imap.client.search.mockResolvedValue([1, 2]);
    await expect(inbox.fetchInterviewBookingEvents({ maxMessages: 1 })).rejects.toThrow("Too many calendar notices");
    expect(imap.client.fetchOne).not.toHaveBeenCalled();
  });

  it.each([
    ["missing metadata", false],
    ["missing internal date", { size: 100 }],
    ["null internal date", { size: 100, internalDate: null }],
    ["invalid internal date string", { size: 100, internalDate: "not-a-date" }],
    ["invalid Date object", { size: 100, internalDate: new Date("invalid") }],
    ["missing size", { internalDate: receivedAt }],
    ["zero size", { size: 0, internalDate: receivedAt }],
    ["oversized metadata", { size: 512_001, internalDate: receivedAt }],
  ])("skips %s without fetching the source", async (_label, metadata) => {
    imap.client.search.mockResolvedValue([17]);
    imap.client.fetchOne.mockResolvedValue(metadata);
    await expect(inbox.fetchInterviewBookingEvents()).resolves.toEqual([]);
    expect(imap.client.fetchOne).toHaveBeenCalledExactlyOnceWith("17", { size: true, internalDate: true }, { uid: true });
    expect(verify).not.toHaveBeenCalled();
    expect(imap.release).toHaveBeenCalledOnce();
    expect(imap.client.logout).toHaveBeenCalledOnce();
  });

  it("continues past invalid metadata and preserves a later valid event", async () => {
    imap.client.search.mockResolvedValue([16, 17]);
    imap.client.fetchOne.mockResolvedValueOnce({ size: 100, internalDate: "invalid" });
    queueMessage();
    await expect(inbox.fetchInterviewBookingEvents()).resolves.toEqual([booking]);
    expect(imap.client.fetchOne.mock.calls.map(([uid, query]) => [uid, query])).toEqual([
      ["16", { size: true, internalDate: true }], ["17", { size: true, internalDate: true }], ["17", { source: true }],
    ]);
  });

  it("accepts valid internal date strings and the metadata size limit", async () => {
    imap.client.search.mockResolvedValue([17]);
    imap.client.fetchOne.mockResolvedValueOnce({ size: 512_000, internalDate: receivedAt.toISOString() })
      .mockResolvedValueOnce({ source: message() });
    await expect(inbox.fetchInterviewBookingEvents()).resolves.toEqual([booking]);
  });

  it.each([false, {}])("skips absent source responses (%j)", async (response) => {
    imap.client.search.mockResolvedValue([17]);
    imap.client.fetchOne.mockResolvedValueOnce({ size: 100, internalDate: receivedAt }).mockResolvedValueOnce(response);
    await expect(inbox.fetchInterviewBookingEvents()).resolves.toEqual([]);
    expect(verify).not.toHaveBeenCalled();
  });

  it("rejects oversized source bytes even when metadata underreports their size", async () => {
    imap.client.search.mockResolvedValue([17]);
    imap.client.fetchOne.mockResolvedValueOnce({ size: 100, internalDate: receivedAt })
      .mockResolvedValueOnce({ source: Buffer.alloc(512_001) });
    await expect(inbox.fetchInterviewBookingEvents()).resolves.toEqual([]);
    expect(verify).not.toHaveBeenCalled();
  });

  it.each([{ matches: [] }, { matches: false }])("handles no search matches ($matches)", async ({ matches }) => {
    imap.client.search.mockResolvedValue(matches);
    await expect(inbox.fetchInterviewBookingEvents()).resolves.toEqual([]);
    expect(imap.client.fetchOne).not.toHaveBeenCalled();
    expect(imap.release).toHaveBeenCalledOnce();
    expect(imap.client.logout).toHaveBeenCalledOnce();
  });

  it("releases the lock and logs out if verification fails", async () => {
    imap.client.search.mockResolvedValue([17]);
    queueMessage();
    verify.mockRejectedValue(new Error("verification failed"));
    await expect(inbox.fetchInterviewBookingEvents()).rejects.toThrow("verification failed");
    expect(imap.release).toHaveBeenCalledOnce();
    expect(imap.client.logout).toHaveBeenCalledOnce();
  });

  it.each(["search", "fetchOne"] as const)("releases the lock and logs out if %s fails", async (method) => {
    imap.client.search.mockResolvedValue([17]);
    imap.client[method].mockRejectedValue(new Error("offline scan failed"));
    await expect(inbox.fetchInterviewBookingEvents()).rejects.toThrow("offline scan failed");
    expect(imap.release).toHaveBeenCalledOnce();
    expect(imap.client.logout).toHaveBeenCalledOnce();
  });

  it("logs out without releasing an unacquired lock", async () => {
    imap.client.getMailboxLock.mockRejectedValue(new Error("lock failed"));
    await expect(inbox.fetchInterviewBookingEvents()).rejects.toThrow("lock failed");
    expect(imap.release).not.toHaveBeenCalled();
    expect(imap.client.logout).toHaveBeenCalledOnce();
  });

  it("closes the client if logout fails, still returning the completed read-only result", async () => {
    imap.client.logout.mockRejectedValue(new Error("logout failed"));
    await expect(inbox.fetchInterviewBookingEvents()).resolves.toEqual([]);
    expect(imap.release).toHaveBeenCalledOnce();
    expect(imap.client.close).toHaveBeenCalledOnce();
  });

  it.each([{ days: 0 }, { days: 366 }, { days: 1.5 }, { days: NaN }, { maxMessages: 0 }, { maxMessages: 1.5 }])("rejects invalid scan bounds before constructing a client (%j)", async (options) => {
    await expect(inbox.fetchInterviewBookingEvents(options)).rejects.toThrow("Invalid scan bounds");
    expect(imap.constructor).not.toHaveBeenCalled();
  });

  it("fails without a configured password before constructing a client", async () => {
    vi.stubEnv("GMAIL_APP_PASSWORD", "");
    await expect(inbox.fetchInterviewBookingEvents()).rejects.toThrow("GMAIL_APP_PASSWORD environment variable is not set");
    expect(imap.constructor).not.toHaveBeenCalled();
  });
});
