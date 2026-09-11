import { createHash } from "node:crypto";

export type BreederClassCancellationPreviewInput = {
  id: number;
  breederId: number;
  breederName: string;
  contactName?: string | null;
  classDate: string;
  dayOfWeek: string;
  location: string;
  breed: string;
  startTime: string;
  endTime: string;
  emailAvailable: boolean;
  smsAvailable: boolean;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function formatClassDate(classDate: string) {
  return new Date(`${classDate}T12:00:00`).toLocaleDateString("en-CA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime(time: string) {
  const [hourText, minute = "00"] = time.split(":");
  const hour = Number(hourText);
  const meridiem = hour < 12 ? "AM" : "PM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${minute} ${meridiem}`;
}

function buildConfirmationKey(input: BreederClassCancellationPreviewInput) {
  return createHash("sha256")
    .update(JSON.stringify({
      id: input.id,
      breederId: input.breederId,
      classDate: input.classDate,
      location: input.location,
      breed: input.breed,
      startTime: input.startTime,
      endTime: input.endTime,
      emailAvailable: input.emailAvailable,
      smsAvailable: input.smsAvailable,
    }))
    .digest("hex");
}

/**
 * Produces the owner-visible, recipient-private class cancellation preview for
 * a breeder. It intentionally contains no Luma, rebooking, or customer copy.
 */
export function buildBreederClassCancellationPreview(input: BreederClassCancellationPreviewInput) {
  const firstName = (input.contactName?.trim() || input.breederName).split(/\s+/)[0] || "there";
  const classDate = formatClassDate(input.classDate);
  const classTime = `${formatTime(input.startTime)}–${formatTime(input.endTime)}`;
  const classLabel = `${input.location} AfroPuppyYoga class with ${input.breed} on ${classDate}`;
  const smsClassLabel = `${input.location} AfroPuppyYoga ${input.breed} class on ${classDate}`;
  const subject = `Class update — ${input.location} · ${classDate}`;
  const emailText = `Hi ${firstName},\n\nWe are sorry to let you know that the ${classLabel} has been cancelled. The scheduled time was ${classTime}. We understand that changes like this affect your planning, and we sincerely apologize for the inconvenience.\n\nPlease do not plan to bring puppies for this class. We appreciate your partnership and will be in touch about future opportunities.\n\nWith appreciation,\nThe AfroPuppyYoga Team\nafropuppyyoga@gmail.com`;
  const smsText = `Hi ${firstName}, we are sorry, but the ${smsClassLabel} at ${classTime} has been cancelled. Please do not plan to bring puppies for this class. We apologize for the inconvenience. — AfroPuppyYoga`;
  const safeEmailText = escapeHtml(emailText).replaceAll("\n", "<br/>");
  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#3D1A2A;line-height:1.6"><div style="background:#8B2252;color:#fff;padding:28px;border-radius:16px 16px 0 0"><p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#FFD6E7">Class update</p><h1 style="margin:0;font-family:Georgia,serif;font-size:27px;line-height:1.25">We are sorry, ${escapeHtml(firstName)}.</h1></div><div style="padding:28px;background:#FFFDFC;border:1px solid #F5D0DF;border-top:0;border-radius:0 0 16px 16px"><p style="margin:0 0 18px">${safeEmailText}</p><div style="background:#FDF6F0;border:1px solid #F5D0DF;border-radius:12px;padding:16px 18px"><strong style="color:#8B1A4A">Cancelled class</strong><br/>${escapeHtml(classDate)}<br/>${escapeHtml(input.location)} · ${escapeHtml(input.breed)}<br/>${escapeHtml(classTime)}</div></div></div>`;

  return {
    subject,
    html,
    emailText,
    smsText,
    channels: {
      email: input.emailAvailable ? "ready" as const : "unavailable" as const,
      sms: input.smsAvailable ? "ready" as const : "unavailable" as const,
    },
    confirmationKey: buildConfirmationKey(input),
  };
}
