/** Read-only APY mailbox scan. No mail flags, folders, or messages are changed. */
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { createRequire } from "node:module";
import { APY_MAILBOX, parseCalendarMessage, type BookingEvent, type CalendarMessage } from "./interviewBookingDetection";

const require = createRequire(import.meta.url);
const { dkimVerify } = require("mailauth/lib/dkim/verify") as {
  dkimVerify: (source: Buffer, options: { curTime: Date }) => Promise<{
    results: Array<{ signingDomain: string; status: { result: string }; signingHeaders?: { keys: string }; canonBodyLength?: number; canonBodyLengthTotal?: number }>;
  }>;
};
export const BOOKING_SCAN_DAYS = 90;
const ALL_MAIL = "[Gmail]/All Mail";
const MAX_SOURCE_BYTES = 512_000;
export type FetchOptions = { days?: number; maxMessages?: number };

/** Verify raw bytes independently. Never trust an email's Authentication-Results header. */
export async function hasGoogleCalendarSignature(source: Buffer, receivedAt: Date): Promise<boolean> {
  const result = await dkimVerify(source, { curTime: receivedAt });
  return result.results.some((signature) => {
    if (signature.signingDomain !== "google.com" || signature.status.result !== "pass") return false;
    if (signature.canonBodyLength !== undefined && signature.canonBodyLengthTotal !== undefined && signature.canonBodyLength !== signature.canonBodyLengthTotal) return false;
    const keys = (signature.signingHeaders?.keys ?? "").toLowerCase().split(":").map((key) => key.trim());
    return ["sender", "from", "subject", "message-id", "content-type", "to"].every((key) => keys.includes(key));
  });
}

/** Calendar attachments are MIME-decoded by mailparser before their folded lines are read. */
export function calendarIdentity(content: string): CalendarMessage["calendar"] | null {
  const unfolded = content.replace(/\r?\n[ \t]/g, "");
  const blocks = Array.from(unfolded.matchAll(/BEGIN:VEVENT\r?\n([\s\S]*?)\r?\nEND:VEVENT/g));
  if (blocks.length !== 1) return null;
  const lines = blocks[0][1].split(/\r?\n/);
  const value = (key: string) => {
    const values = lines.filter((line) => line.startsWith(`${key}:`) || line.startsWith(`${key};`));
    return values.length === 1 ? values[0].slice(values[0].indexOf(":") + 1).trim() : "";
  };
  const attendees = lines.filter((line) => line.startsWith("ATTENDEE:") || line.startsWith("ATTENDEE;"))
    .map((line) => line.slice(line.indexOf(":") + 1).replace(/^mailto:/i, "").trim());
  const methods = unfolded.split(/\r?\n/).filter((line) => line.startsWith("METHOD:"));
  if (methods.length !== 1) return null;
  return { eventId: value("UID"), organizer: value("ORGANIZER").replace(/^mailto:/i, ""),
    attendees, summary: value("SUMMARY"), method: methods[0].slice(7).trim() };
}

export async function parseVerifiedCalendarSource(source: Buffer, receivedAt: Date): Promise<BookingEvent | null> {
  if (!Number.isFinite(receivedAt.getTime()) || source.length > MAX_SOURCE_BYTES) return null;
  const parsed = await simpleParser(source, { skipHtmlToText: true, skipTextToHtml: true, skipImageLinks: true });
  const subject = parsed.subject ?? "";
  if (!/^Appointment (booked|canceled): AfroPuppyYoga Meeting /.test(subject)) return null;
  const attachments = parsed.attachments.filter((attachment) => attachment.contentType === "text/calendar" || /\.ics$/i.test(attachment.filename ?? ""));
  // Google sends duplicate identical .ics parts in some messages. Distinct identities remain ambiguous.
  const identities = Array.from(new Set(attachments.map((attachment) => attachment.content.toString("utf8"))));
  if (identities.length !== 1) return null;
  const calendar = calendarIdentity(identities[0]);
  if (!calendar) return null;
  const sender = parsed.headers.get("sender") as { value?: Array<{ address?: string }> } | undefined;
  const verifiedGoogleSignature = await hasGoogleCalendarSignature(source, receivedAt);
  return parseCalendarMessage({ subject, receivedAt, calendar, verifiedGoogleSignature,
    messageId: parsed.messageId, sender: (sender?.value ?? []).map((entry) => entry.address ?? ""),
    to: [], from: parsed.from?.value.map((entry) => entry.address ?? "") });
}

export async function fetchInterviewBookingEvents(options: FetchOptions = {}): Promise<BookingEvent[]> {
  const days = options.days ?? BOOKING_SCAN_DAYS;
  const maxMessages = options.maxMessages ?? 400;
  if (!Number.isInteger(days) || days < 1 || days > 365 || !Number.isInteger(maxMessages) || maxMessages < 1) throw new Error("Invalid scan bounds");
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!pass) throw new Error("GMAIL_APP_PASSWORD environment variable is not set");
  const client = new ImapFlow({ host: "imap.gmail.com", port: 993, secure: true,
    auth: { user: APY_MAILBOX, pass }, logger: false, connectionTimeout: 15_000, socketTimeout: 30_000 });
  const events: BookingEvent[] = [];
  try {
    await client.connect();
    const lock = await client.getMailboxLock(ALL_MAIL, { readOnly: true });
    try {
      const uids = (await client.search({ gmraw: `subject:"AfroPuppyYoga Meeting" newer_than:${days}d` }, { uid: true })) || [];
      // Never reconcile against silently truncated results.
      if (uids.length > maxMessages) throw new Error("Too many calendar notices for a complete scan. Statuses unchanged.");
      for (const uid of uids) {
        const metadata = await client.fetchOne(String(uid), { size: true, internalDate: true }, { uid: true });
        if (!metadata || !metadata.internalDate || !metadata.size || metadata.size > MAX_SOURCE_BYTES) continue;
        const received = new Date(metadata.internalDate);
        if (!Number.isFinite(received.getTime())) continue;
        const message = await client.fetchOne(String(uid), { source: true }, { uid: true });
        if (!message || !message.source) continue;
        const event = await parseVerifiedCalendarSource(message.source, received);
        if (event) events.push(event);
      }
    } finally { lock.release(); }
  } finally { await client.logout().catch(() => { client.close(); }); }
  return events;
}
