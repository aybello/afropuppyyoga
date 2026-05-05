import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "../_core/trpc";
import { createSigningToken, getSigningTokenByToken, updateSigningToken, getSigningTokenByApplicationId } from "../db";
import { notifyOwner } from "../_core/notification";
import { sendEmail } from "../email";
import crypto from "crypto";

// CDN URLs for all offer letter PDFs
const OFFER_LETTER_URLS = {
  puppy_monitor_kw: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/OfferLetter_Volunteer_Kitchener_V2_4a8a6867.pdf",
  puppy_monitor_hamilton: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/OfferLetter_Volunteer_Hamilton_2026_ed683aa6.pdf",
  yoga_instructor: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/Offer_Letter_YogaInstructor_6ac240d8.pdf",
} as const;

const NDA_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/NDA_Updated_e2dcb73f.pdf";

type OfferLetterType = keyof typeof OFFER_LETTER_URLS;

function detectOfferLetterType(role: string, location: string): OfferLetterType {
  const roleLower = role.toLowerCase();
  const locationLower = location.toLowerCase();

  if (roleLower.includes("yoga")) {
    return "yoga_instructor";
  }
  if (locationLower.includes("hamilton")) {
    return "puppy_monitor_hamilton";
  }
  return "puppy_monitor_kw";
}

export const signingRouter = router({
  /**
   * Admin-only: create a signing request and send the signing link to the applicant
   */
  createSigningRequest: adminProcedure
    .input(
      z.object({
        applicationId: z.number(),
        applicantName: z.string(),
        applicantEmail: z.string().email(),
        role: z.string(),
        location: z.string(),
        origin: z.string().url(), // frontend origin for building the signing link
      })
    )
    .mutation(async ({ input }) => {
      const token = crypto.randomBytes(48).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      const offerLetterType = detectOfferLetterType(input.role, input.location);

      await createSigningToken({
        applicationId: input.applicationId,
        applicantName: input.applicantName,
        applicantEmail: input.applicantEmail,
        role: input.role,
        location: input.location,
        offerLetterType,
        token,
        signed: 0,
        expiresAt,
      });

      const signingLink = `${input.origin}/sign?token=${token}`;

      // Send signing email to applicant
      await sendEmail({
        to: input.applicantEmail,
        subject: `Action Required: Review & Sign Your Offer — AfroPuppyYoga`,
        html: buildSigningEmail({ applicantName: input.applicantName, role: input.role, location: input.location, signingLink }),
        text: `Hi ${input.applicantName},\n\nCongratulations! Please review and sign your offer letter for the ${input.role} position at AfroPuppyYoga (${input.location}).\n\nClick the link below to review and sign your documents:\n${signingLink}\n\nThis link is valid for 7 days.\n\nBest regards,\nThe AfroPuppyYoga Team`,
      });

      return { success: true, signingLink };
    }),

  /**
   * Public: get signing request details by token (for the /sign page)
   */
  getSigningRequest: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const record = await getSigningTokenByToken(input.token);
      if (!record) throw new Error("Invalid or expired signing link.");
      if (new Date() > record.expiresAt) throw new Error("This signing link has expired. Please contact AfroPuppyYoga.");

      return {
        applicantName: record.applicantName,
        role: record.role,
        location: record.location,
        offerLetterUrl: OFFER_LETTER_URLS[record.offerLetterType as OfferLetterType],
        ndaUrl: NDA_URL,
        signed: record.signed === 1,
        signedName: record.signedName,
        signedAt: record.signedAt,
      };
    }),

  /**
   * Public: submit the signed documents
   */
  submitSignature: publicProcedure
    .input(
      z.object({
        token: z.string(),
        signedName: z.string().min(2, "Please enter your full name"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const record = await getSigningTokenByToken(input.token);
      if (!record) throw new Error("Invalid or expired signing link.");
      if (new Date() > record.expiresAt) throw new Error("This signing link has expired. Please contact AfroPuppyYoga.");
      if (record.signed === 1) throw new Error("These documents have already been signed.");

      // Get IP from request headers
      const ip = (ctx as { req?: { headers?: Record<string, string | string[] | undefined> } }).req?.headers?.["x-forwarded-for"]?.toString().split(",")[0]?.trim() ?? "unknown";

      await updateSigningToken(record.id, {
        signed: 1,
        signedName: input.signedName,
        signedIp: ip,
        signedAt: new Date(),
      });

      // Notify owner
      await notifyOwner({
        title: `Documents Signed: ${record.applicantName}`,
        content: `${record.applicantName} has signed their offer letter and NDA for the ${record.role} position (${record.location}).\n\nSigned name: ${input.signedName}\nSigned at: ${new Date().toLocaleString("en-CA", { timeZone: "America/Toronto" })}\nIP: ${ip}`,
      });

      // Send confirmation email to applicant
      await sendEmail({
        to: record.applicantEmail,
        subject: "Documents Signed — Welcome to AfroPuppyYoga! 🐾",
        html: buildSigningConfirmationEmail({ applicantName: record.applicantName, role: record.role, location: record.location }),
        text: `Hi ${record.applicantName},\n\nThank you for signing your offer letter and NDA for the ${record.role} position at AfroPuppyYoga (${record.location}). We'll be in touch shortly with your onboarding details.\n\nWelcome to the family!\n\nThe AfroPuppyYoga Team`,
      });

      return { success: true };
    }),

  /**
   * Admin-only: check signing status for an application
   */
  getSigningStatus: adminProcedure
    .input(z.object({ applicationId: z.number() }))
    .query(async ({ input }) => {
      const record = await getSigningTokenByApplicationId(input.applicationId);
      if (!record) return { hasSigning: false };
      return {
        hasSigning: true,
        signed: record.signed === 1,
        signedName: record.signedName,
        signedAt: record.signedAt,
        expiresAt: record.expiresAt,
      };
    }),
});

// ─── Email Templates ──────────────────────────────────────────────────────────

function buildSigningEmail(opts: { applicantName: string; role: string; location: string; signingLink: string }): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#FEFAF4;font-family:'Georgia',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FEFAF4;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #F0D0DC;">
          <tr>
            <td style="background:linear-gradient(135deg,#C2185B,#8B2252);padding:32px 40px;text-align:center;">
              <p style="margin:0;font-family:'Georgia',serif;font-size:22px;font-weight:bold;color:#fff;letter-spacing:1px;">🐾 AfroPuppyYoga</p>
              <p style="margin:6px 0 0;font-family:Arial,sans-serif;font-size:12px;color:rgba(255,255,255,0.8);letter-spacing:2px;text-transform:uppercase;">Canada's #1 Puppy Yoga Studio</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:14px;color:#8B2252;font-weight:bold;letter-spacing:1px;text-transform:uppercase;">Action Required</p>
              <h2 style="margin:0 0 24px;font-family:'Georgia',serif;font-size:26px;color:#1A0A12;line-height:1.3;">
                Review &amp; Sign Your Offer, ${opts.applicantName}! 🐾
              </h2>
              <p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:15px;color:#3D1A2A;line-height:1.6;">
                Congratulations on your offer for the <strong>${opts.role}</strong> position at our <strong>${opts.location}</strong> location!
              </p>
              <p style="margin:0 0 24px;font-family:Arial,sans-serif;font-size:15px;color:#3D1A2A;line-height:1.6;">
                Please click the button below to review your Offer Letter and Non-Disclosure Agreement, then sign digitally — it only takes 2 minutes!
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td align="center">
                    <a href="${opts.signingLink}" style="display:inline-block;background:linear-gradient(135deg,#C2185B,#8B2252);color:#fff;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;padding:16px 40px;border-radius:8px;text-decoration:none;letter-spacing:0.5px;">✍️ Review &amp; Sign Documents</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:13px;color:#6B4C3B;text-align:center;">
                Or copy this link: <a href="${opts.signingLink}" style="color:#C2185B;word-break:break-all;">${opts.signingLink}</a>
              </p>
              <p style="margin:16px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#9E7B8A;text-align:center;">
                This link is valid for 7 days. If you have questions, reply to this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#FFF5F8;padding:24px 40px;border-top:1px solid #F0D0DC;text-align:center;">
              <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#8B2252;">
                <strong>AfroPuppyYoga</strong> · Kitchener-Waterloo &amp; Hamilton, Ontario
              </p>
              <p style="margin:6px 0 0;font-family:Arial,sans-serif;font-size:11px;color:#C4A0B0;">
                <a href="https://afropuppyyoga.ca" style="color:#C2185B;">afropuppyyoga.ca</a>
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

function buildSigningConfirmationEmail(opts: { applicantName: string; role: string; location: string }): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background-color:#FEFAF4;font-family:'Georgia',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FEFAF4;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #F0D0DC;">
          <tr>
            <td style="background:linear-gradient(135deg,#C2185B,#8B2252);padding:32px 40px;text-align:center;">
              <p style="margin:0;font-family:'Georgia',serif;font-size:22px;font-weight:bold;color:#fff;">🐾 AfroPuppyYoga</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 40px 32px;">
              <h2 style="margin:0 0 24px;font-family:'Georgia',serif;font-size:26px;color:#1A0A12;">
                Documents Received! Welcome to the Pack 🐶💕
              </h2>
              <p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:15px;color:#3D1A2A;line-height:1.6;">
                Hi ${opts.applicantName}, we've received your signed Offer Letter and NDA for the <strong>${opts.role}</strong> position (${opts.location}). 
              </p>
              <p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:15px;color:#3D1A2A;line-height:1.6;">
                We'll be in touch shortly with your onboarding details and orientation schedule. We can't wait to have you on the team!
              </p>
              <p style="margin:0;font-family:'Georgia',serif;font-size:15px;color:#1A0A12;">
                With excitement,<br/>
                <strong>The AfroPuppyYoga Team</strong>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#FFF5F8;padding:24px 40px;border-top:1px solid #F0D0DC;text-align:center;">
              <p style="margin:0;font-family:Arial,sans-serif;font-size:11px;color:#C4A0B0;">
                <a href="https://afropuppyyoga.ca" style="color:#C2185B;">afropuppyyoga.ca</a>
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
