/**
 * APY Email Utility
 * Sends branded emails via Gmail SMTP using an app password.
 * Set GMAIL_APP_PASSWORD in environment variables.
 */
import nodemailer from "nodemailer";

const GMAIL_USER = "afropuppyyogaofficial@gmail.com";
const REPLY_TO = "afropuppyyogaofficial@gmail.com";

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

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
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
  });
}

// ─── Email Templates ────────────────────────────────────────────────────────

function wrapInBrandedLayout(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AfroPuppyYoga</title>
</head>
<body style="margin:0;padding:0;background-color:#FEFAF4;font-family:'Georgia',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FEFAF4;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #F0D0DC;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#C2185B,#8B2252);padding:32px 40px;text-align:center;">
              <p style="margin:0;font-family:'Georgia',serif;font-size:22px;font-weight:bold;color:#fff;letter-spacing:1px;">🐾 AfroPuppyYoga</p>
              <p style="margin:6px 0 0;font-family:Arial,sans-serif;font-size:12px;color:rgba(255,255,255,0.8);letter-spacing:2px;text-transform:uppercase;">Canada's #1 Puppy Yoga Studio</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#FFF5F8;padding:24px 40px;border-top:1px solid #F0D0DC;text-align:center;">
              <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#8B2252;">
                <strong>AfroPuppyYoga</strong> · Kitchener-Waterloo &amp; Hamilton, Ontario
              </p>
              <p style="margin:6px 0 0;font-family:Arial,sans-serif;font-size:11px;color:#C4A0B0;">
                Questions? Reply to this email or reach us at 
                <a href="mailto:afropuppyyogaofficial@gmail.com" style="color:#C2185B;">afropuppyyogaofficial@gmail.com</a>
              </p>
              <p style="margin:6px 0 0;font-family:Arial,sans-serif;font-size:11px;color:#C4A0B0;">
                <a href="https://afropuppyyoga.ca" style="color:#C2185B;">afropuppyyoga.ca</a> · 
                <a href="https://instagram.com/afropuppyyoga" style="color:#C2185B;">@afropuppyyoga</a>
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

export function buildInterviewInviteEmail(opts: {
  applicantName: string;
  role: string;
  location: string;
  interviewDate: string;
  interviewTime: string;
  interviewFormat: string; // "Video call (Google Meet)" | "In-person" | etc.
  interviewLink?: string;
  additionalNotes?: string;
}): { subject: string; html: string; text: string } {
  const subject = `Interview Invitation — ${opts.role} at AfroPuppyYoga`;

  const html = wrapInBrandedLayout(`
    <p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:14px;color:#8B2252;font-weight:bold;letter-spacing:1px;text-transform:uppercase;">Interview Invitation</p>
    <h2 style="margin:0 0 24px;font-family:'Georgia',serif;font-size:26px;color:#1A0A12;line-height:1.3;">
      We'd love to meet you, ${opts.applicantName}! 🐾
    </h2>
    <p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:15px;color:#3D1A2A;line-height:1.6;">
      Thank you for applying to join the AfroPuppyYoga family as a <strong>${opts.role}</strong> (${opts.location}). 
      We've reviewed your application and we're excited to invite you for an interview!
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFF5F8;border-radius:12px;border:1px solid #F0D0DC;margin:24px 0;">
      <tr><td style="padding:24px;">
        <p style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:13px;font-weight:bold;color:#8B2252;text-transform:uppercase;letter-spacing:1px;">Interview Details</p>
        <table cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-family:Arial,sans-serif;font-size:14px;color:#6B4C3B;padding:4px 16px 4px 0;font-weight:bold;">📅 Date:</td>
            <td style="font-family:Arial,sans-serif;font-size:14px;color:#1A0A12;padding:4px 0;">${opts.interviewDate}</td>
          </tr>
          <tr>
            <td style="font-family:Arial,sans-serif;font-size:14px;color:#6B4C3B;padding:4px 16px 4px 0;font-weight:bold;">🕐 Time:</td>
            <td style="font-family:Arial,sans-serif;font-size:14px;color:#1A0A12;padding:4px 0;">${opts.interviewTime} (Eastern Time)</td>
          </tr>
          <tr>
            <td style="font-family:Arial,sans-serif;font-size:14px;color:#6B4C3B;padding:4px 16px 4px 0;font-weight:bold;">💻 Format:</td>
            <td style="font-family:Arial,sans-serif;font-size:14px;color:#1A0A12;padding:4px 0;">${opts.interviewFormat}</td>
          </tr>
          ${opts.interviewLink ? `
          <tr>
            <td style="font-family:Arial,sans-serif;font-size:14px;color:#6B4C3B;padding:4px 16px 4px 0;font-weight:bold;">🔗 Link:</td>
            <td style="font-family:Arial,sans-serif;font-size:14px;padding:4px 0;"><a href="${opts.interviewLink}" style="color:#C2185B;">${opts.interviewLink}</a></td>
          </tr>` : ""}
        </table>
      </td></tr>
    </table>

    ${opts.additionalNotes ? `
    <p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:15px;color:#3D1A2A;line-height:1.6;">
      <strong>Additional Notes:</strong><br/>${opts.additionalNotes}
    </p>` : ""}

    <p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:15px;color:#3D1A2A;line-height:1.6;">
      Please reply to this email to confirm your attendance, or let us know if you need to reschedule. 
      We're flexible and want to make this work for you!
    </p>
    <p style="margin:0 0 24px;font-family:Arial,sans-serif;font-size:15px;color:#3D1A2A;line-height:1.6;">
      We look forward to connecting with you and learning more about your passion for wellness and puppies. 🐶
    </p>
    <p style="margin:0;font-family:'Georgia',serif;font-size:15px;color:#1A0A12;">
      With warmth,<br/>
      <strong>The AfroPuppyYoga Team</strong>
    </p>
  `);

  const text = `Hi ${opts.applicantName},\n\nThank you for applying to join AfroPuppyYoga as a ${opts.role} (${opts.location}). We'd love to meet you!\n\nInterview Details:\n- Date: ${opts.interviewDate}\n- Time: ${opts.interviewTime} (Eastern Time)\n- Format: ${opts.interviewFormat}\n${opts.interviewLink ? `- Link: ${opts.interviewLink}\n` : ""}${opts.additionalNotes ? `\nAdditional Notes: ${opts.additionalNotes}\n` : ""}\nPlease reply to confirm your attendance or to reschedule.\n\nWith warmth,\nThe AfroPuppyYoga Team\nafropuppyyogaofficial@gmail.com`;

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

  const html = wrapInBrandedLayout(`
    <p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:14px;color:#8B2252;font-weight:bold;letter-spacing:1px;text-transform:uppercase;">Offer of Employment</p>
    <h2 style="margin:0 0 24px;font-family:'Georgia',serif;font-size:26px;color:#1A0A12;line-height:1.3;">
      You're officially part of the pack, ${opts.applicantName}! 🐾✨
    </h2>
    <p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:15px;color:#3D1A2A;line-height:1.6;">
      On behalf of the entire AfroPuppyYoga team, we are absolutely thrilled to offer you the position of 
      <strong>${opts.role}</strong> at our <strong>${opts.location}</strong> location!
    </p>
    <p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:15px;color:#3D1A2A;line-height:1.6;">
      You stood out to us with your energy, passion, and alignment with our mission — blending wellness, 
      culture, and puppy love in a way that's truly one of a kind. We can't wait to have you on the team.
    </p>

    ${opts.startDate ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFF5F8;border-radius:12px;border:1px solid #F0D0DC;margin:24px 0;">
      <tr><td style="padding:24px;">
        <p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:13px;font-weight:bold;color:#8B2252;text-transform:uppercase;letter-spacing:1px;">Next Steps</p>
        <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;color:#1A0A12;">
          📅 <strong>Proposed Start Date:</strong> ${opts.startDate}
        </p>
      </td></tr>
    </table>` : ""}

    ${opts.additionalNotes ? `
    <p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:15px;color:#3D1A2A;line-height:1.6;">
      ${opts.additionalNotes}
    </p>` : ""}

    <p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:15px;color:#3D1A2A;line-height:1.6;">
      Please reply to this email to accept this offer and we'll send over your onboarding details. 
      If you have any questions before then, don't hesitate to reach out — we're here for you!
    </p>
    <p style="margin:0 0 24px;font-family:Arial,sans-serif;font-size:15px;color:#3D1A2A;line-height:1.6;">
      Welcome to the family. The puppies are already excited to meet you. 🐶💕
    </p>
    <p style="margin:0;font-family:'Georgia',serif;font-size:15px;color:#1A0A12;">
      With so much excitement,<br/>
      <strong>The AfroPuppyYoga Team</strong>
    </p>
  `);

  const text = `Hi ${opts.applicantName},\n\nWe are thrilled to offer you the position of ${opts.role} at our ${opts.location} location!\n\nYou stood out to us with your energy, passion, and alignment with our mission. We can't wait to have you on the team.\n\n${opts.startDate ? `Proposed Start Date: ${opts.startDate}\n\n` : ""}${opts.additionalNotes ? `${opts.additionalNotes}\n\n` : ""}Please reply to this email to accept this offer and we'll send over your onboarding details.\n\nWelcome to the family!\n\nWith excitement,\nThe AfroPuppyYoga Team\nafropuppyyogaofficial@gmail.com`;

  return { subject, html, text };
}

export function buildRejectionLetterEmail(opts: {
  applicantName: string;
  role: string;
  location: string;
  additionalNotes?: string;
}): { subject: string; html: string; text: string } {
  const subject = `Your Application to AfroPuppyYoga — ${opts.role}`;

  const html = wrapInBrandedLayout(`
    <p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:14px;color:#8B2252;font-weight:bold;letter-spacing:1px;text-transform:uppercase;">Application Update</p>
    <h2 style="margin:0 0 24px;font-family:'Georgia',serif;font-size:26px;color:#1A0A12;line-height:1.3;">
      Thank you for your application, ${opts.applicantName}
    </h2>
    <p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:15px;color:#3D1A2A;line-height:1.6;">
      Thank you so much for taking the time to apply for the <strong>${opts.role}</strong> position at our 
      <strong>${opts.location}</strong> location. We genuinely appreciate your interest in joining the AfroPuppyYoga family.
    </p>
    <p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:15px;color:#3D1A2A;line-height:1.6;">
      After careful consideration, we've decided to move forward with another candidate whose experience 
      more closely aligns with our current needs. This was not an easy decision — we received many 
      wonderful applications, and yours was among them.
    </p>

    ${opts.additionalNotes ? `
    <p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:15px;color:#3D1A2A;line-height:1.6;">
      ${opts.additionalNotes}
    </p>` : ""}

    <p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:15px;color:#3D1A2A;line-height:1.6;">
      We encourage you to keep an eye on our careers page at 
      <a href="https://afropuppyyoga.ca/careers" style="color:#C2185B;">afropuppyyoga.ca/careers</a> — 
      as we grow, new opportunities will arise and we'd love to hear from you again.
    </p>
    <p style="margin:0 0 24px;font-family:Arial,sans-serif;font-size:15px;color:#3D1A2A;line-height:1.6;">
      Thank you again for your time and enthusiasm. We wish you all the best in your journey. 🐾
    </p>
    <p style="margin:0;font-family:'Georgia',serif;font-size:15px;color:#1A0A12;">
      With gratitude,<br/>
      <strong>The AfroPuppyYoga Team</strong>
    </p>
  `);

  const text = `Hi ${opts.applicantName},\n\nThank you for applying for the ${opts.role} position at our ${opts.location} location. We appreciate your interest in joining the AfroPuppyYoga family.\n\nAfter careful consideration, we've decided to move forward with another candidate whose experience more closely aligns with our current needs.\n\n${opts.additionalNotes ? `${opts.additionalNotes}\n\n` : ""}We encourage you to keep an eye on our careers page as we grow — we'd love to hear from you again.\n\nThank you again for your time and enthusiasm. We wish you all the best.\n\nWith gratitude,\nThe AfroPuppyYoga Team\nafropuppyyogaofficial@gmail.com`;

  return { subject, html, text };
}
