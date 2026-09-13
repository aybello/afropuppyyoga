import { createHash, createHmac, timingSafeEqual } from "crypto";

import { buildClassCancellationEmail } from "./email";
import { rebookingCodeForClassDate } from "./lumaCalendarCoupon";

export type CancellationPreviewInput = {
  eventApiId: string;
  eventName: string;
  eventStartAt: string | Date;
  customMessage?: string;
  audienceFingerprint: string;
};

type PreviewMessage = {
  subject: string;
  text: string;
};

function normalizedCustomMessage(value?: string) {
  return value?.trim() ?? "";
}

function previewPayload(input: CancellationPreviewInput) {
  return JSON.stringify({
    eventApiId: input.eventApiId,
    eventName: input.eventName,
    eventStartAt: new Date(input.eventStartAt).toISOString(),
    customMessage: normalizedCustomMessage(input.customMessage),
    audienceFingerprint: input.audienceFingerprint,
  });
}

export function createCancellationAudienceFingerprint(
  guests: Array<{ name: string; email: string; phone: string | null }>
) {
  const normalized = guests
    .map((guest) => `${guest.name.trim()}\u0000${guest.email.trim().toLowerCase()}\u0000${guest.phone?.trim() ?? ""}`)
    .sort()
    .join("\n");
  return createHash("sha256").update(normalized).digest("hex");
}

export function createCancellationPreviewKey(input: CancellationPreviewInput, secret: string) {
  return createHmac("sha256", secret).update(previewPayload(input)).digest("hex");
}

export function isCurrentCancellationPreviewKey(providedKey: string, input: CancellationPreviewInput, secret: string) {
  const expectedKey = createCancellationPreviewKey(input, secret);
  if (providedKey.length !== expectedKey.length) return false;
  return timingSafeEqual(Buffer.from(providedKey), Buffer.from(expectedKey));
}

export function buildCancellationMessagePreview(input: CancellationPreviewInput): {
  rebookingCode: string;
  email: PreviewMessage;
  smsText: string;
  voiceText: string;
} {
  const rebookingCode = rebookingCodeForClassDate(input.eventStartAt);
  const customMessage = normalizedCustomMessage(input.customMessage);
  const email = buildClassCancellationEmail({
    guestName: "[First name]",
    eventName: input.eventName,
    rebookingCode,
    customMessage: customMessage || undefined,
  });

  const voiceText = customMessage
    ? `${customMessage} Please check your email for the free rebooking code ${rebookingCode}, valid across the AfroPuppyYoga calendar.`
    : `Hello, this is a message from AfroPuppyYoga. We regret to inform you that your upcoming class, ${input.eventName}, has been cancelled. We apologize for the inconvenience. Please check your email for your free rebooking code, valid across the AfroPuppyYoga calendar. Thank you for your understanding.`;

  const smsText = customMessage
    ? `${customMessage}\n\nUse free code ${rebookingCode} for 100% off any future APY class booked through our Luma calendar.`
    : `Hi from AfroPuppyYoga! Your class "${input.eventName}" has been cancelled. Sorry for the inconvenience! Use free code ${rebookingCode} for 100% off any future APY class booked through our Luma calendar. Browse upcoming classes at afropuppyyoga.ca.`;

  return {
    rebookingCode,
    email: { subject: email.subject, text: email.text },
    smsText,
    voiceText,
  };
}
