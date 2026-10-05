import { APY_PLANNING_DOCUMENT_URL } from "../shared/onboarding";

function escape(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function buildNewRoleOnboardingEmail(opts: {
  applicantName: string;
  role: string;
  location: string;
  orientationDate?: string;
  orientationTime?: string;
  planningDocUrl?: string;
  documents?: Array<{ title: string; url: string }>;
  additionalNotes?: string;
}) {
  const movement = opts.role.toLowerCase().replaceAll("_", " ").trim() === "movement instructor";
  const guidance = movement
    ? "Review your Movement Instructor lessons and shared safety guidance in APY HQ. Lead simple stretches, warm-ups and gentle, beginner-friendly movements, not dance choreography or yoga instruction. Confirm the session plan with Operations and Puppy Monitors."
    : "Review the event-day operations and shared safety lessons in APY HQ. Coordinate setup, team readiness, guest check-in and session flow. Escalate concerns to APY leadership. This role does not include Operations Manager system permissions.";
  const orientation = opts.orientationDate
    ? `Orientation: ${opts.orientationDate}${opts.orientationTime ? ` at ${opts.orientationTime}` : ""}. APY will confirm the venue and arrival details.`
    : "APY will confirm your orientation and event schedule.";
  const planning = opts.planningDocUrl ?? APY_PLANNING_DOCUMENT_URL;
  const resources = [
    { title: "Sign in to APY HQ", url: "https://afropuppyyoga.ca/staff-access" },
    { title: "Open your training", url: "https://afropuppyyoga.ca/staff/training" },
    { title: "Planning document", url: planning },
    ...(opts.documents ?? []),
  ];
  const subject = `Welcome to AfroPuppyYoga: ${opts.role} onboarding`;
  const text = `Hi ${opts.applicantName},\n\nWelcome to AfroPuppyYoga as a ${opts.role} in ${opts.location}.\n\n${orientation}\n\n${guidance}\n\nUse your saved email address or phone number to sign in. Your account is active, but sending these documents does not mark training complete.\n\n${resources.map((resource) => `${resource.title}: ${resource.url}`).join("\n")}${opts.additionalNotes ? `\n\n${opts.additionalNotes}` : ""}\n\nReply to this email with any questions, or call/text 289-788-1885.\n\nThe AfroPuppyYoga Team`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;background:#FEFAF4;padding:28px;color:#3D1A2E;border-radius:16px;">
    <h1 style="color:#8B2252;font-size:24px;">Welcome to AfroPuppyYoga</h1>
    <p>Hi ${escape(opts.applicantName)},</p>
    <p>Welcome as a <strong>${escape(opts.role)}</strong> in <strong>${escape(opts.location)}</strong>.</p>
    <p>${escape(orientation)}</p><p>${escape(guidance)}</p>
    <p>Use your saved email address or phone number to sign in. Your account is active, but sending these documents does not mark training complete.</p>
    <ul>${resources.map((resource) => `<li><a style="color:#8B2252;" href="${escape(resource.url)}">${escape(resource.title)}</a></li>`).join("")}</ul>
    ${opts.additionalNotes ? `<p>${escape(opts.additionalNotes).replace(/\n/g, "<br/>")}</p>` : ""}
    <p>Reply with any questions, or call/text <a href="tel:2897881885">289-788-1885</a>.</p>
    <p>The AfroPuppyYoga Team</p>
  </div>`;
  return { subject, html, text };
}
