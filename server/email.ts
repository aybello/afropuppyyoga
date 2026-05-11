/**
 * APY Email Utility
 * Sends branded emails via Gmail SMTP using an app password.
 * Set GMAIL_APP_PASSWORD in environment variables.
 */
import nodemailer from "nodemailer";

const GMAIL_USER = "afropuppyyogaofficial@gmail.com";
const REPLY_TO = "afropuppyyogaofficial@gmail.com";
const APY_LOGO = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663446228701/pFRlGBKuUoljEWjn.png";

function getTransporter() {
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!pass) {
    throw new Error("GMAIL_APP_PASSWORD environment variable is not set");
  }
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: GMAIL_USER,
      pass,
    },
  });
}

export interface EmailAttachment {
  filename: string;
  path: string; // URL or local path
  contentType: string;
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
}

export async function sendEmail(opts: EmailOptions): Promise<void> {
  const transporter = getTransporter();
  await transporter.sendMail({
    from: `"The AfroPuppyYoga Team" <${GMAIL_USER}>`,
    replyTo: REPLY_TO,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    attachments: opts.attachments,
  });
}

// ─── Shared Layout Helpers ───────────────────────────────────────────────────

/**
 * Wraps email content in the APY branded layout.
 * heroContent: the solid-pink hero section HTML (title + subtitle)
 * bodyContent: the white body section HTML
 */
function wrapInBrandedLayout(heroContent: string, bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AfroPuppyYoga</title>
</head>
<body style="margin:0;padding:0;background-color:#FDF6F0;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FDF6F0;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(194,24,91,0.08);">

          <!-- HEADER: logo on blush -->
          <tr>
            <td style="background:#FFF0F5;padding:24px 32px 18px;text-align:center;border-bottom:1px solid #F8D7E3;">
              <img src="${APY_LOGO}" alt="AfroPuppyYoga" width="52" height="52" style="display:block;margin:0 auto 8px;border-radius:12px;" />
              <p style="margin:0;font-family:Georgia,serif;font-size:17px;font-weight:bold;color:#8B1A4A;letter-spacing:0.5px;">AfroPuppyYoga</p>
              <p style="margin:3px 0 0;font-size:10px;color:#C47A9A;letter-spacing:2px;text-transform:uppercase;">Canada's #1 Puppy Yoga Studio</p>
            </td>
          </tr>

          <!-- HERO: solid pink with white text -->
          <tr>
            <td style="background:#C2185B;padding:32px 32px 24px;text-align:center;">
              ${heroContent}
            </td>
          </tr>

          <!-- BODY: white background -->
          <tr>
            <td style="padding:32px 32px 24px;background:#FFFFFF;">
              ${bodyContent}
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#FFF0F5;padding:18px 32px;border-top:1px solid #F8D7E3;text-align:center;">
              <p style="margin:0 0 4px;font-size:12px;font-weight:bold;color:#8B1A4A;">AfroPuppyYoga</p>
              <p style="margin:0 0 5px;font-size:11px;color:#C4A0B0;">Kitchener-Waterloo &amp; Hamilton, Ontario</p>
              <p style="margin:0;font-size:11px;">
                <a href="https://afropuppyyoga.ca" style="color:#C2185B;text-decoration:none;">afropuppyyoga.ca</a>
                &nbsp;&middot;&nbsp;
                <a href="https://instagram.com/afropuppyyoga" style="color:#C2185B;text-decoration:none;">@afropuppyyoga</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function pillButton(href: string, label: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
    <tr>
      <td align="center">
        <a href="${href}" style="display:inline-block;background:#C2185B;color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;padding:14px 40px;border-radius:50px;text-decoration:none;letter-spacing:0.3px;">${label}</a>
      </td>
    </tr>
  </table>`;
}

function fallbackLink(href: string): string {
  return `<p style="margin:0 0 16px;font-size:11px;color:#9E7B8A;text-align:center;line-height:1.6;">
    Button not working? Copy and paste this link:<br/>
    <a href="${href}" style="color:#C2185B;word-break:break-all;">${href}</a>
  </p>`;
}

function bodyText(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;color:#3D1A2A;line-height:1.7;">${text}</p>`;
}

function signoff(name: string): string {
  return `<p style="margin:24px 0 0;font-family:Georgia,serif;font-size:15px;color:#1A0A12;">With warmth,<br/><strong>${name}</strong></p>`;
}

// ─── Email Templates ─────────────────────────────────────────────────────────

export function buildInterviewInviteEmail(opts: {
  applicantName: string;
  role: string;
  location: string;
  bookingLink: string;
  additionalNotes?: string;
}): { subject: string; html: string; text: string } {
  const subject = `Interview Invitation — ${opts.role} at AfroPuppyYoga`;
  const firstName = opts.applicantName.split(" ")[0];

  const hero = `
    <p style="margin:0 0 6px;font-size:12px;font-weight:bold;color:#FFD6E7;letter-spacing:1.5px;text-transform:uppercase;">Interview Invitation</p>
    <h1 style="margin:0 0 10px;font-family:Georgia,serif;font-size:27px;color:#FFFFFF;line-height:1.25;">We'd love to meet you,<br/>${firstName}!</h1>
    <p style="margin:0;font-size:14px;color:#FFE4EF;line-height:1.5;"><strong style="color:#fff;">${opts.role}</strong> &middot; <strong style="color:#fff;">${opts.location}</strong></p>
  `;

  const body = `
    ${bodyText(`Thank you for applying to join the AfroPuppyYoga family! We've reviewed your application and we're excited to invite you for an interview.`)}
    ${bodyText(`Please use the link below to book your interview at a time that works best for you:`)}
    ${pillButton(opts.bookingLink, "📅 Book Your Interview")}
    ${fallbackLink(opts.bookingLink)}
    ${opts.additionalNotes ? `<table width="100%" cellpadding="0" cellspacing="0" style="background:#FDF6F0;border-radius:12px;border:1px solid #F5D0DF;margin:0 0 16px;"><tr><td style="padding:16px 20px;"><p style="margin:0 0 6px;font-size:12px;font-weight:bold;color:#8B1A4A;text-transform:uppercase;letter-spacing:1px;">Additional Notes</p><p style="margin:0;font-size:14px;color:#3D1A2A;line-height:1.6;">${opts.additionalNotes}</p></td></tr></table>` : ""}
    ${bodyText(`If you have any questions or need to reschedule, feel free to reply to this email. We look forward to speaking with you!`)}
    ${signoff("The AfroPuppyYoga Team")}
  `;

  const html = wrapInBrandedLayout(hero, body);

  const text = `Hi ${opts.applicantName},\n\nThank you for applying to join AfroPuppyYoga as a ${opts.role} (${opts.location}). We'd love to meet you!\n\nPlease use the link below to book your interview:\n${opts.bookingLink}\n${opts.additionalNotes ? `\nAdditional Notes: ${opts.additionalNotes}\n` : ""}\nIf you have any questions, feel free to reply. Looking forward to speaking with you!\n\nWith warmth,\nThe AfroPuppyYoga Team\nafropuppyyogaofficial@gmail.com`;

  return { subject, html, text };
}

export function buildOfferLetterEmail(opts: {
  applicantName: string;
  role: string;
  location: string;
  startDate?: string;
  additionalNotes?: string;
}): { subject: string; html: string; text: string } {
  const subject = `Welcome to the AfroPuppyYoga Family! 🐾 — ${opts.role} Offer`;
  const firstName = opts.applicantName.split(" ")[0];

  const hero = `
    <p style="margin:0 0 6px;font-size:12px;font-weight:bold;color:#FFD6E7;letter-spacing:1.5px;text-transform:uppercase;">🎉 Offer of Employment</p>
    <h1 style="margin:0 0 10px;font-family:Georgia,serif;font-size:27px;color:#FFFFFF;line-height:1.25;">You're officially part<br/>of the pack, ${firstName}!</h1>
    <p style="margin:0;font-size:14px;color:#FFE4EF;line-height:1.5;"><strong style="color:#fff;">${opts.role}</strong> &middot; <strong style="color:#fff;">${opts.location}</strong></p>
  `;

  const body = `
    ${bodyText(`On behalf of the entire AfroPuppyYoga team, we are absolutely thrilled to offer you the position of <strong>${opts.role}</strong> at our <strong>${opts.location}</strong> location!`)}
    ${bodyText(`You stood out to us with your energy, passion, and alignment with our mission — blending wellness, culture, and puppy love in a way that's truly one of a kind. We can't wait to have you on the team.`)}

    ${opts.startDate ? `<table width="100%" cellpadding="0" cellspacing="0" style="background:#FDF6F0;border-radius:12px;border:1px solid #F5D0DF;margin:0 0 20px;"><tr><td style="padding:16px 20px;"><p style="margin:0 0 4px;font-size:12px;font-weight:bold;color:#8B1A4A;text-transform:uppercase;letter-spacing:1px;">Proposed Start Date</p><p style="margin:0;font-size:15px;color:#1A0A12;font-weight:bold;">📅 ${opts.startDate}</p></td></tr></table>` : ""}
    ${opts.additionalNotes ? `${bodyText(opts.additionalNotes)}` : ""}

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#FDF6F0;border-radius:12px;border:1px solid #F5D0DF;margin:0 0 20px;">
      <tr><td style="padding:16px 20px;">
        <p style="margin:0 0 10px;font-size:12px;font-weight:bold;color:#8B1A4A;text-transform:uppercase;letter-spacing:1px;">Action Required — Documents Attached</p>
        <p style="margin:0 0 8px;font-size:14px;color:#3D1A2A;line-height:1.6;">We've attached two documents that require your signature:</p>
        <p style="margin:0 0 6px;font-size:14px;color:#3D1A2A;">📄 <strong>Volunteer Offer Letter</strong> — please sign and return within 5 days</p>
        <p style="margin:0 0 10px;font-size:14px;color:#3D1A2A;">📄 <strong>Non-Disclosure Agreement (NDA)</strong> — please sign and return</p>
        <p style="margin:0;font-size:13px;color:#6B4C3B;">Please reply to this email with the signed copies attached.</p>
      </td></tr>
    </table>

    ${bodyText(`The puppies are already excited to meet you. 🐶💕`)}
    ${signoff("The AfroPuppyYoga Team")}
  `;

  const html = wrapInBrandedLayout(hero, body);

  const text = `Hi ${opts.applicantName},\n\nWe are thrilled to offer you the position of ${opts.role} at our ${opts.location} location!\n\nYou stood out to us with your energy, passion, and alignment with our mission. We can't wait to have you on the team.\n\n${opts.startDate ? `Proposed Start Date: ${opts.startDate}\n\n` : ""}${opts.additionalNotes ? `${opts.additionalNotes}\n\n` : ""}Please sign both attached documents and reply to this email with the signed copies.\n\nWelcome to the family!\n\nWith excitement,\nThe AfroPuppyYoga Team\nafropuppyyogaofficial@gmail.com`;

  return { subject, html, text };
}

export async function sendStaffInviteEmail(opts: {
  to: string;
  name: string;
  magicLink: string;
}): Promise<void> {
  const subject = "You've been invited to the AfroPuppyYoga Staff Portal";
  const firstName = opts.name.split(" ")[0];

  const hero = `
    <p style="margin:0 0 6px;font-size:12px;font-weight:bold;color:#FFD6E7;letter-spacing:1.5px;text-transform:uppercase;">Staff Portal Access</p>
    <h1 style="margin:0 0 10px;font-family:Georgia,serif;font-size:27px;color:#FFFFFF;line-height:1.25;">Welcome to the team,<br/>${firstName}! 🐾</h1>
    <p style="margin:0;font-size:14px;color:#FFE4EF;line-height:1.5;">Your staff portal access is ready</p>
  `;

  const body = `
    ${bodyText(`You've been invited to access the AfroPuppyYoga Staff Portal. Click the button below to log in — no password needed!`)}
    ${pillButton(opts.magicLink, "Access APY Staff Portal")}
    ${fallbackLink(opts.magicLink)}
    <p style="margin:0;font-size:12px;color:#B09AA8;text-align:center;">⏳ This link is valid for <strong>7 days</strong>. If you didn't expect this email, you can safely ignore it.</p>
    ${signoff("The AfroPuppyYoga Team")}
  `;

  const html = wrapInBrandedLayout(hero, body);

  const text = `Hi ${opts.name},\n\nYou've been invited to access the AfroPuppyYoga Staff Portal.\n\nClick the link below to log in:\n${opts.magicLink}\n\nThis link is valid for 7 days.\n\nWith warmth,\nThe AfroPuppyYoga Team`;

  await sendEmail({ to: opts.to, subject, html, text });
}

export function buildApplicationConfirmationEmail(opts: {
  applicantName: string;
  role: string;
  location: string;
}): { subject: string; html: string; text: string } {
  const subject = `We received your application — ${opts.role} at AfroPuppyYoga`;
  const firstName = opts.applicantName.split(" ")[0];

  const hero = `
    <p style="margin:0 0 6px;font-size:12px;font-weight:bold;color:#FFD6E7;letter-spacing:1.5px;text-transform:uppercase;">Application Received</p>
    <h1 style="margin:0 0 10px;font-family:Georgia,serif;font-size:27px;color:#FFFFFF;line-height:1.25;">Thanks for applying,<br/>${firstName}! 🐾</h1>
    <p style="margin:0;font-size:14px;color:#FFE4EF;line-height:1.5;"><strong style="color:#fff;">${opts.role}</strong> &middot; <strong style="color:#fff;">${opts.location}</strong></p>
  `;

  const body = `
    ${bodyText(`We've received your application for <strong>${opts.role}</strong> at our <strong>${opts.location}</strong> location. Thank you for your interest in joining the AfroPuppyYoga family!`)}
    ${bodyText(`Our team will review your application and reach out within <strong>5 business days</strong> if your profile is a great fit. We review every application personally, so please be patient with us.`)}
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#FDF6F0;border-radius:12px;border:1px solid #F5D0DF;margin:0 0 20px;">
      <tr><td style="padding:16px 20px;">
        <p style="margin:0 0 8px;font-size:12px;font-weight:bold;color:#8B1A4A;text-transform:uppercase;letter-spacing:1px;">What happens next?</p>
        <p style="margin:0 0 6px;font-size:14px;color:#3D1A2A;">1. Our team reviews your video and resume</p>
        <p style="margin:0 0 6px;font-size:14px;color:#3D1A2A;">2. Shortlisted candidates receive an interview invite</p>
        <p style="margin:0;font-size:14px;color:#3D1A2A;">3. Successful applicants join the APY pack!</p>
      </td></tr>
    </table>
    ${bodyText(`In the meantime, feel free to follow us on Instagram <a href="https://instagram.com/afropuppyyoga" style="color:#C2185B;">@afropuppyyoga</a> to stay connected with the APY community.`)}
    ${signoff("The AfroPuppyYoga Team")}
  `;

  const html = wrapInBrandedLayout(hero, body);

  const text = `Hi ${opts.applicantName},\n\nThank you for applying for the ${opts.role} position at our ${opts.location} location!\n\nWe've received your application and our team will review it carefully. We'll be in touch within 5 business days if your profile is a great fit.\n\nWhat happens next?\n1. Our team reviews your video and resume\n2. Shortlisted candidates receive an interview invite\n3. Successful applicants join the APY pack!\n\nIf you have any questions, feel free to reply to this email.\n\nWith warmth,\nThe AfroPuppyYoga Team\nafropuppyyogaofficial@gmail.com`;

  return { subject, html, text };
}

export function buildRejectionLetterEmail(opts: {
  applicantName: string;
  role: string;
  location: string;
  additionalNotes?: string;
}): { subject: string; html: string; text: string } {
  const subject = `Your Application to AfroPuppyYoga — ${opts.role}`;
  const firstName = opts.applicantName.split(" ")[0];

  const hero = `
    <p style="margin:0 0 6px;font-size:12px;font-weight:bold;color:#FFD6E7;letter-spacing:1.5px;text-transform:uppercase;">Application Update</p>
    <h1 style="margin:0 0 10px;font-family:Georgia,serif;font-size:27px;color:#FFFFFF;line-height:1.25;">Thank you,<br/>${firstName}</h1>
    <p style="margin:0;font-size:14px;color:#FFE4EF;line-height:1.5;"><strong style="color:#fff;">${opts.role}</strong> &middot; <strong style="color:#fff;">${opts.location}</strong></p>
  `;

  const body = `
    ${bodyText(`Thank you so much for taking the time to apply for the <strong>${opts.role}</strong> position at our <strong>${opts.location}</strong> location. We genuinely appreciate your interest in joining the AfroPuppyYoga family.`)}
    ${bodyText(`After careful consideration, we've decided to move forward with another candidate whose experience more closely aligns with our current needs. This was not an easy decision — we received many wonderful applications, and yours was among them.`)}
    ${opts.additionalNotes ? `${bodyText(opts.additionalNotes)}` : ""}
    ${bodyText(`We encourage you to keep an eye on our careers page at <a href="https://afropuppyyoga.ca/careers" style="color:#C2185B;">afropuppyyoga.ca/careers</a> — as we grow, new opportunities will arise and we'd love to hear from you again.`)}
    ${bodyText(`Thank you again for your time and enthusiasm. We wish you all the best in your journey. 🐾`)}
    ${signoff("The AfroPuppyYoga Team")}
  `;

  const html = wrapInBrandedLayout(hero, body);

  const text = `Hi ${opts.applicantName},\n\nThank you for applying for the ${opts.role} position at our ${opts.location} location. We appreciate your interest in joining the AfroPuppyYoga family.\n\nAfter careful consideration, we've decided to move forward with another candidate whose experience more closely aligns with our current needs.\n\n${opts.additionalNotes ? `${opts.additionalNotes}\n\n` : ""}We encourage you to keep an eye on our careers page as we grow — we'd love to hear from you again.\n\nThank you again for your time and enthusiasm. We wish you all the best.\n\nWith gratitude,\nThe AfroPuppyYoga Team\nafropuppyyogaofficial@gmail.com`;

  return { subject, html, text };
}

export function buildOnboardingEmail(opts: {
  applicantName: string;
  role: string;
  location: string;
  orientationDate?: string;   // e.g. "Saturday, May 10th"
  orientationTime?: string;   // e.g. "9:00 AM"
  planningDocUrl?: string;    // link to the planning doc
  additionalNotes?: string;
}): { subject: string; html: string; text: string } {
  const firstName = opts.applicantName.split(" ")[0];
  const planningUrl = opts.planningDocUrl ?? "https://docs.google.com/spreadsheets/d/1pEEx_HXTw3JV82q7FTLaM6qmc8aHoqk0KdVGicyWupo/edit?usp=sharing";

  // Derive location address from location string
  const locationAddress = opts.location.toLowerCase().includes("kitchener")
    ? "329 King Street East, Kitchener, Ontario"
    : opts.location.toLowerCase().includes("hamilton")
    ? "2751 Barton Street East, Hamilton, Ontario L8E 2J8"
    : "";

  const subject = opts.orientationDate
    ? `${firstName}, your orientation is on ${opts.orientationDate} — here's what to do next 🐾`
    : `Welcome to the AfroPuppyYoga Team! Your Onboarding Details Inside 🐾`;

  const hero = `
    <p style="margin:0 0 6px;font-size:12px;font-weight:bold;color:#FFD6E7;letter-spacing:1.5px;text-transform:uppercase;">Welcome to the Pack!</p>
    <h1 style="margin:0 0 10px;font-family:Georgia,serif;font-size:27px;color:#FFFFFF;line-height:1.25;">We're so excited to have<br/>you on board, ${firstName}! 🐶✨</h1>
    <p style="margin:0;font-size:14px;color:#FFE4EF;line-height:1.5;"><strong style="color:#fff;">${opts.role}</strong> &middot; <strong style="color:#fff;">${opts.location}</strong></p>
  `;

  const body = `
    ${bodyText(`Hello ${firstName},`)}
    ${bodyText(`Welcome to the AfroPuppyYoga team! We're thrilled to have you joining us as a <strong>${opts.role}</strong>. 🐶✨`)}
    ${opts.orientationDate ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#FDF6F0;border-radius:12px;border:1px solid #F5D0DF;margin:0 0 20px;">
      <tr><td style="padding:16px 20px;">
        <p style="margin:0 0 4px;font-size:12px;font-weight:bold;color:#8B1A4A;text-transform:uppercase;letter-spacing:1px;">Orientation Class Invitation</p>
        <p style="margin:0 0 10px;font-size:14px;color:#3D1A2A;line-height:1.6;">We would like to invite you to your <strong>orientation class on ${opts.orientationDate}${opts.orientationTime ? ` at ${opts.orientationTime}` : ""}</strong>. This is a great opportunity to experience a live session, get comfortable with the flow, and meet the team before your first official class.</p>
        ${locationAddress ? `<p style="margin:0 0 10px;font-size:14px;color:#3D1A2A;line-height:1.6;">📍 <strong>${locationAddress}</strong></p>` : ""}
        <p style="margin:0;font-size:14px;color:#3D1A2A;line-height:1.6;">🧘 Please wear <strong>black yoga attire</strong> and bring <strong>grippy socks</strong>. Most importantly, bring a positive attitude — we can't wait to meet you!</p>
      </td></tr>
    </table>` : ""}
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#FDF6F0;border-radius:12px;border:1px solid #F5D0DF;margin:0 0 20px;">
      <tr><td style="padding:16px 20px;">
        <p style="margin:0 0 12px;font-size:12px;font-weight:bold;color:#8B1A4A;text-transform:uppercase;letter-spacing:1px;">Your Next Steps</p>
        <p style="margin:0 0 10px;font-size:14px;color:#3D1A2A;line-height:1.6;"><strong>1. Planning Document</strong><br/>Please open the planning document linked below. In the "PM Availability" tab, add your name to the dates you're available for your assigned location. Your training resources and guides are also available in this document.</p>
        <p style="margin:0 0 10px;font-size:14px;color:#3D1A2A;line-height:1.6;"><strong>2. Training &amp; Resources</strong><br/>Inside the planning document, please review the following under Organizational Structure:<br/>
          &bull; Puppy Monitor Training Guide<br/>
          &bull; Puppy First Aid Document<br/>
          &bull; Puppy Socialization &amp; Safety Guidelines
        </p>
        <p style="margin:0;font-size:14px;color:#3D1A2A;line-height:1.6;"><strong>3. Group Chat</strong><br/>You'll be added to the official <strong>iMessage group chat</strong> shortly. This is where we coordinate upcoming classes and share important updates. Keep an eye on your iMessage notifications!</p>
      </td></tr>
    </table>
    ${pillButton(planningUrl, "📋 Open Planning Document")}
    ${fallbackLink(planningUrl)}
    ${opts.additionalNotes ? `<table width="100%" cellpadding="0" cellspacing="0" style="background:#FDF6F0;border-radius:12px;border:1px solid #F5D0DF;margin:0 0 20px;"><tr><td style="padding:16px 20px;"><p style="margin:0 0 6px;font-size:12px;font-weight:bold;color:#8B1A4A;text-transform:uppercase;letter-spacing:1px;">Additional Notes</p><p style="margin:0;font-size:14px;color:#3D1A2A;line-height:1.6;">${opts.additionalNotes}</p></td></tr></table>` : ""}
    ${bodyText(`Please <strong>reply to this email</strong> to confirm you've received your onboarding details and let us know if you have any questions before your orientation.`)}
    ${bodyText(`If you need to reach me directly, call or text <a href="tel:2897881885" style="color:#C2185B;">289-788-1885</a>.`)}
    ${bodyText(`Thanks again, and welcome to the team!`)}
    ${signoff("Ay &amp; The AfroPuppyYoga Team")}
  `;

  const html = wrapInBrandedLayout(hero, body);

  const text = `Hello ${firstName},

Welcome to the AfroPuppyYoga team! We're thrilled to have you joining us as a ${opts.role}. 🐶✨
${opts.orientationDate ? `\nOrientation Class Invitation\nWe would like to invite you to your orientation class on ${opts.orientationDate}${opts.orientationTime ? ` at ${opts.orientationTime}` : ""}.${locationAddress ? `\n📍 ${locationAddress}` : ""}\n🧘 Please wear black yoga attire and bring grippy socks. Most importantly, bring a positive attitude!\n` : ""}
Here are your next steps to get started:

1. Planning Document
Please open the planning document linked below. In the "PM Availability" tab, add your name to the dates you're available. Your training resources are also in this document.

2. Training & Resources
Inside the planning document, please review under Organizational Structure:
- Puppy Monitor Training Guide
- Puppy First Aid Document
- Puppy Socialization & Safety Guidelines

3. Group Chat
You'll be added to the official iMessage group chat shortly. Keep an eye on your iMessage notifications!

Planning Document:
${planningUrl}
${opts.additionalNotes ? `\n${opts.additionalNotes}\n` : ""}
Please reply to this email to confirm you've received your onboarding details.

If you need to reach me directly, call or text 289-788-1885.

Thanks again, and welcome to the team!

Warmly,
Ay & The AfroPuppyYoga Team
afropuppyyogaofficial@gmail.com`;

  return { subject, html, text };
}

// ─── Yoga Instructor Onboarding Email ─────────────────────────────────────────
export function buildYogaInstructorOnboardingEmail(opts: {
  applicantName: string;
  location: string;
  orientationDate?: string;
  orientationTime?: string;
  additionalNotes?: string;
  planningDocUrl?: string;
}): { subject: string; html: string; text: string } {
  const firstName = opts.applicantName.split(" ")[0];
  const planningUrl = opts.planningDocUrl ?? "https://docs.google.com/spreadsheets/d/1pEEx_HXTw3JV82q7FTLaM6qmc8aHoqk0KdVGicyWupo/edit?usp=sharing";

  const locationAddress = opts.location.toLowerCase().includes("kitchener")
    ? "329 King Street East, Kitchener, Ontario"
    : opts.location.toLowerCase().includes("hamilton")
    ? "2751 Barton Street East, Hamilton, Ontario L8E 2J8"
    : "";

  const subject = opts.orientationDate
    ? `${firstName}, your orientation is on ${opts.orientationDate} — here's what to do next 🧘✨`
    : `Welcome to the AfroPuppyYoga Team! Your Onboarding Details Inside 🧘✨`;

  const hero = `
    <p style="margin:0 0 6px;font-size:12px;font-weight:bold;color:#FFD6E7;letter-spacing:1.5px;text-transform:uppercase;">Welcome to the Team!</p>
    <h1 style="margin:0 0 10px;font-family:Georgia,serif;font-size:27px;color:#FFFFFF;line-height:1.25;">So excited to have you,<br/>${firstName}! 🧘✨</h1>
    <p style="margin:0;font-size:14px;color:#FFE4EF;line-height:1.5;"><strong style="color:#fff;">Yoga Instructor</strong> &middot; <strong style="color:#fff;">${opts.location}</strong></p>
  `;

  const body = `
    ${bodyText(`Hello ${firstName},`)}
    ${bodyText(`Welcome to the AfroPuppyYoga team! We're so excited to have you joining us as a <strong>Yoga Instructor</strong>. 🧘✨`)}
    ${opts.orientationDate ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#FDF6F0;border-radius:12px;border:1px solid #F5D0DF;margin:0 0 20px;">
      <tr><td style="padding:16px 20px;">
        <p style="margin:0 0 4px;font-size:12px;font-weight:bold;color:#8B1A4A;text-transform:uppercase;letter-spacing:1px;">Orientation Invitation</p>
        <p style="margin:0 0 10px;font-size:14px;color:#3D1A2A;line-height:1.6;">We would like to invite you to your <strong>orientation on ${opts.orientationDate}${opts.orientationTime ? ` at ${opts.orientationTime}` : ""}</strong>. This is a chance to walk through the class format, meet the team, and get familiar with the space before your first session.</p>
        ${locationAddress ? `<p style="margin:0 0 10px;font-size:14px;color:#3D1A2A;line-height:1.6;">📍 <strong>${locationAddress}</strong></p>` : ""}
        <p style="margin:0;font-size:14px;color:#3D1A2A;line-height:1.6;">🧘 Please wear comfortable yoga attire. We'll walk you through everything you need to know on the day!</p>
      </td></tr>
    </table>` : ""}
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#FDF6F0;border-radius:12px;border:1px solid #F5D0DF;margin:0 0 20px;">
      <tr><td style="padding:16px 20px;">
        <p style="margin:0 0 12px;font-size:12px;font-weight:bold;color:#8B1A4A;text-transform:uppercase;letter-spacing:1px;">Your Next Steps</p>
        <p style="margin:0 0 10px;font-size:14px;color:#3D1A2A;line-height:1.6;"><strong>1. Planning Document</strong><br/>Please open the planning document linked below. Add your name to the dates you're available for your assigned location.</p>
        <p style="margin:0 0 10px;font-size:14px;color:#3D1A2A;line-height:1.6;"><strong>2. Class Format &amp; Resources</strong><br/>Inside the planning document, please review the Instructor section for:<br/>
          &bull; Class Structure &amp; Flow Guide<br/>
          &bull; Music &amp; Playlist Guidelines<br/>
          &bull; Puppy Safety Protocols for Instructors
        </p>
        <p style="margin:0;font-size:14px;color:#3D1A2A;line-height:1.6;"><strong>3. Group Chat</strong><br/>You'll be added to the official <strong>iMessage group chat</strong> shortly. This is where we coordinate class schedules and share updates. Keep an eye on your iMessage notifications!</p>
      </td></tr>
    </table>
    ${pillButton(planningUrl, "📋 Open Planning Document")}
    ${fallbackLink(planningUrl)}
    ${opts.additionalNotes ? `<table width="100%" cellpadding="0" cellspacing="0" style="background:#FDF6F0;border-radius:12px;border:1px solid #F5D0DF;margin:0 0 20px;"><tr><td style="padding:16px 20px;"><p style="margin:0 0 6px;font-size:12px;font-weight:bold;color:#8B1A4A;text-transform:uppercase;letter-spacing:1px;">Additional Notes</p><p style="margin:0;font-size:14px;color:#3D1A2A;line-height:1.6;">${opts.additionalNotes}</p></td></tr></table>` : ""}
    ${bodyText(`Please <strong>reply to this email</strong> to confirm you've received your onboarding details and let us know if you have any questions before your orientation.`)}
    ${bodyText(`If you need to reach me directly, call or text <a href="tel:2897881885" style="color:#C2185B;">289-788-1885</a>.`)}
    ${bodyText(`Thanks again, and welcome to the team!`)}
    ${signoff("Ay &amp; The AfroPuppyYoga Team")}
  `;

  const html = wrapInBrandedLayout(hero, body);

  const text = `Hello ${firstName},

Welcome to the AfroPuppyYoga team! We're so excited to have you joining us as a Yoga Instructor. 🧘✨
${opts.orientationDate ? `\nOrientation Invitation\nWe would like to invite you to your orientation on ${opts.orientationDate}${opts.orientationTime ? ` at ${opts.orientationTime}` : ""}.${locationAddress ? `\n📍 ${locationAddress}` : ""}\n🧘 Please wear comfortable yoga attire.\n` : ""}
Here are your next steps:

1. Planning Document
Please open the planning document linked below and add your name to the dates you're available.

2. Class Format & Resources
Inside the planning document, please review the Instructor section for:
- Class Structure & Flow Guide
- Music & Playlist Guidelines
- Puppy Safety Protocols for Instructors

3. Group Chat
You'll be added to the official iMessage group chat shortly. Keep an eye on your iMessage notifications!

Planning Document:
${planningUrl}
${opts.additionalNotes ? `\n${opts.additionalNotes}\n` : ""}
Please reply to this email to confirm you've received your onboarding details.

If you need to reach me directly, call or text 289-788-1885.

Thanks again, and welcome to the team!

Warmly,
Ay & The AfroPuppyYoga Team
afropuppyyogaofficial@gmail.com`;

  return { subject, html, text };
}

// ─── Yoga Instructor Offer Letter Email ──────────────────────────────────────
export function buildYogaInstructorOfferLetterEmail(opts: {
  applicantName: string;
  location: string;
  startDate?: string;
  additionalNotes?: string;
}): { subject: string; html: string; text: string } {
  const firstName = opts.applicantName.split(" ")[0];
  const subject = `${firstName}, you've been offered a Yoga Instructor role at AfroPuppyYoga! 🧘✨`;

  const hero = `
    <p style="margin:0 0 6px;font-size:12px;font-weight:bold;color:#FFD6E7;letter-spacing:1.5px;text-transform:uppercase;">🎉 Offer of Employment</p>
    <h1 style="margin:0 0 10px;font-family:Georgia,serif;font-size:27px;color:#FFFFFF;line-height:1.25;">Welcome to the pack,<br/>${firstName}! 🧘✨</h1>
    <p style="margin:0;font-size:14px;color:#FFE4EF;line-height:1.5;"><strong style="color:#fff;">Yoga Instructor</strong> &middot; <strong style="color:#fff;">${opts.location}</strong></p>
  `;

  const body = `
    ${bodyText(`Dear ${firstName},`)}
    ${bodyText(`On behalf of the entire AfroPuppyYoga team, we are thrilled to offer you the position of <strong>Yoga Instructor</strong> at our <strong>${opts.location}</strong> location. After reviewing your application and getting to know you through the process, we are confident you are the perfect fit for our community.`)}

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#FDF6F0;border-radius:12px;border:1px solid #F5D0DF;margin:0 0 20px;">
      <tr><td style="padding:16px 20px;">
        <p style="margin:0 0 10px;font-size:12px;font-weight:bold;color:#8B1A4A;text-transform:uppercase;letter-spacing:1px;">Your Role</p>
        <p style="margin:0 0 8px;font-size:14px;color:#3D1A2A;line-height:1.7;">As a <strong>Yoga Instructor</strong> at AfroPuppyYoga, you will lead our signature puppy yoga sessions — guiding participants through a fun, accessible yoga flow while adorable puppies roam freely around the room. Your responsibilities will include:</p>
        <p style="margin:0 0 5px;font-size:14px;color:#3D1A2A;">&bull; Leading engaging, beginner-friendly yoga classes set to Afro-beat rhythms</p>
        <p style="margin:0 0 5px;font-size:14px;color:#3D1A2A;">&bull; Creating a welcoming, inclusive, and energetic atmosphere for all participants</p>
        <p style="margin:0 0 5px;font-size:14px;color:#3D1A2A;">&bull; Coordinating with the Puppy Monitor team to ensure a safe and smooth session</p>
        <p style="margin:0 0 5px;font-size:14px;color:#3D1A2A;">&bull; Curating and managing your class music playlist in line with APY's vibe and guidelines</p>
        <p style="margin:0;font-size:14px;color:#3D1A2A;">&bull; Representing the AfroPuppyYoga brand with professionalism, warmth, and authenticity</p>
      </td></tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#FDF6F0;border-radius:12px;border:1px solid #F5D0DF;margin:0 0 20px;">
      <tr><td style="padding:16px 20px;">
        <p style="margin:0 0 10px;font-size:12px;font-weight:bold;color:#8B1A4A;text-transform:uppercase;letter-spacing:1px;">Compensation</p>
        <p style="margin:0 0 6px;font-size:14px;color:#3D1A2A;line-height:1.6;"><strong>Rate:</strong> $22.00 per hour</p>
        <p style="margin:0;font-size:13px;color:#6B4C3B;">Full compensation details, payment schedule, and terms are outlined in the attached Offer Letter.</p>
      </td></tr>
    </table>

    ${opts.startDate ? `<table width="100%" cellpadding="0" cellspacing="0" style="background:#FDF6F0;border-radius:12px;border:1px solid #F5D0DF;margin:0 0 20px;"><tr><td style="padding:16px 20px;"><p style="margin:0 0 4px;font-size:12px;font-weight:bold;color:#8B1A4A;text-transform:uppercase;letter-spacing:1px;">Proposed Start Date</p><p style="margin:0;font-size:15px;color:#1A0A12;font-weight:bold;">📅 ${opts.startDate}</p></td></tr></table>` : ""}

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#FDF6F0;border-radius:12px;border:1px solid #F5D0DF;margin:0 0 20px;">
      <tr><td style="padding:16px 20px;">
        <p style="margin:0 0 10px;font-size:12px;font-weight:bold;color:#8B1A4A;text-transform:uppercase;letter-spacing:1px;">Action Required — Documents Attached</p>
        <p style="margin:0 0 8px;font-size:14px;color:#3D1A2A;line-height:1.6;">Please review and sign both of the following documents and reply to this email with the signed copies attached within <strong>5 business days</strong>:</p>
        <p style="margin:0 0 6px;font-size:14px;color:#3D1A2A;">📄 <strong>Employment Offer Letter</strong> — outlines your role, compensation, and terms</p>
        <p style="margin:0 0 10px;font-size:14px;color:#3D1A2A;">📄 <strong>Non-Disclosure Agreement (NDA)</strong> — protects our business information and brand</p>
        <p style="margin:0;font-size:13px;color:#6B4C3B;">If you have any questions about the documents before signing, please don't hesitate to reach out.</p>
      </td></tr>
    </table>

    ${opts.additionalNotes ? `<table width="100%" cellpadding="0" cellspacing="0" style="background:#FDF6F0;border-radius:12px;border:1px solid #F5D0DF;margin:0 0 20px;"><tr><td style="padding:16px 20px;"><p style="margin:0 0 6px;font-size:12px;font-weight:bold;color:#8B1A4A;text-transform:uppercase;letter-spacing:1px;">Additional Notes</p><p style="margin:0;font-size:14px;color:#3D1A2A;line-height:1.6;">${opts.additionalNotes}</p></td></tr></table>` : ""}

    ${bodyText(`We are so excited to welcome you into the AfroPuppyYoga family. You are joining a team that is passionate about wellness, community, and creating unforgettable experiences. The puppies can't wait to meet you! 🐶💕`)}
    ${bodyText(`If you have any questions at all, feel free to call or text me directly at <a href="tel:2897881885" style="color:#C2185B;">289-788-1885</a>.`)}
    ${signoff("Ay &amp; The AfroPuppyYoga Team")}
  `;

  const html = wrapInBrandedLayout(hero, body);

  const text = `Dear ${firstName},

On behalf of the entire AfroPuppyYoga team, we are thrilled to offer you the position of Yoga Instructor at our ${opts.location} location.

YOUR ROLE
As a Yoga Instructor at AfroPuppyYoga, you will lead our signature puppy yoga sessions, guiding participants through a fun, accessible yoga flow while adorable puppies roam freely around the room. Your responsibilities include:
- Leading engaging, beginner-friendly yoga classes set to Afro-beat rhythms
- Creating a welcoming, inclusive, and energetic atmosphere for all participants
- Coordinating with the Puppy Monitor team to ensure a safe and smooth session
- Curating and managing your class music playlist in line with APY's guidelines
- Representing the AfroPuppyYoga brand with professionalism, warmth, and authenticity

COMPENSATION
Rate: $22.00 per hour
Full compensation details, payment schedule, and terms are outlined in the attached Offer Letter.
${opts.startDate ? `\nProposed Start Date: ${opts.startDate}\n` : ""}
ACTION REQUIRED — DOCUMENTS ATTACHED
Please review and sign both of the following documents and reply to this email with the signed copies attached within 5 business days:
- Employment Offer Letter — outlines your role, compensation, and terms
- Non-Disclosure Agreement (NDA) — protects our business information and brand
${opts.additionalNotes ? `\n${opts.additionalNotes}\n` : ""}
We are so excited to welcome you into the AfroPuppyYoga family. The puppies can't wait to meet you!

If you have any questions, feel free to call or text 289-788-1885.

Warmly,
Ay & The AfroPuppyYoga Team
afropuppyyogaofficial@gmail.com`;

  return { subject, html, text };
}
