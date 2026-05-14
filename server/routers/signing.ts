import { z } from "zod";
import { adminProcedure, staffProcedure, publicProcedure, router } from "../_core/trpc";
import { createSigningToken, getSigningTokenByToken, updateSigningToken, getSigningTokenByApplicationId } from "../db";
import { notifyOwner } from "../_core/notification";
import { sendEmail } from "../email";
import crypto from "crypto";

// CDN URLs for all offer letter PDFs
type OfferLetterType = "puppy_monitor_kw" | "puppy_monitor_hamilton" | "yoga_instructor" | "puppy_specialist";

function detectOfferLetterType(role: string, location: string): OfferLetterType {
  const roleLower = role.toLowerCase();
  const locationLower = location.toLowerCase();

  if (roleLower.includes("yoga")) {
    return "yoga_instructor";
  }
  if (roleLower.includes("specialist")) {
    return "puppy_specialist";
  }
  if (locationLower.includes("hamilton") || locationLower.includes("ham")) {
    return "puppy_monitor_hamilton";
  }
  return "puppy_monitor_kw";
}

export const signingRouter = router({
  /**
   * Admin-only: create a signing request and send the signing link to the applicant
   */
  createSigningRequest: staffProcedure
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
        offerLetterType: record.offerLetterType as OfferLetterType,
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
  getSigningStatus: staffProcedure
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
  const firstName = opts.applicantName.split(" ")[0];
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Review &amp; Sign Your Offer — AfroPuppyYoga</title>
</head>
<body style="margin:0;padding:0;background-color:#FDF6F0;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FDF6F0;">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <!-- Card -->
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(194,24,91,0.08);">

          <!-- ── HEADER: logo on cream ── -->
          <tr>
            <td style="background:#FFF0F5;padding:28px 32px 20px;text-align:center;border-bottom:1px solid #F8D7E3;">
              <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663446228701/pFRlGBKuUoljEWjn.png" alt="AfroPuppyYoga" width="56" height="56" style="display:block;margin:0 auto 10px;border-radius:12px;" />
              <p style="margin:0;font-family:Georgia,serif;font-size:18px;font-weight:bold;color:#8B1A4A;letter-spacing:0.5px;">AfroPuppyYoga</p>
              <p style="margin:4px 0 0;font-size:11px;color:#C47A9A;letter-spacing:2px;text-transform:uppercase;">Canada's #1 Puppy Yoga Studio</p>
            </td>
          </tr>

          <!-- ── HERO: congratulations banner ── -->
          <tr>
            <td style="background:#C2185B;padding:36px 32px 28px;text-align:center;">
              <p style="margin:0 0 8px;font-size:13px;font-weight:bold;color:#FFD6E7;letter-spacing:1.5px;text-transform:uppercase;">🎉 Congratulations!</p>
              <h1 style="margin:0 0 12px;font-family:Georgia,serif;font-size:30px;color:#FFFFFF;line-height:1.25;text-shadow:0 1px 3px rgba(0,0,0,0.15);">You've got an offer,<br/>${firstName}!</h1>
              <p style="margin:0;font-size:15px;color:#FFE4EF;line-height:1.5;">Your <strong style="color:#fff;">${opts.role}</strong> position at our <strong style="color:#fff;">${opts.location}</strong> location is waiting for your signature.</p>
            </td>
          </tr>

          <!-- ── BODY ── -->
          <tr>
            <td style="padding:32px 32px 24px;">

              <!-- Steps card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#FDF6F0;border-radius:12px;border:1px solid #F5D0DF;margin-bottom:28px;">
                <tr><td style="padding:20px 24px;">
                  <p style="margin:0 0 14px;font-size:13px;font-weight:bold;color:#8B1A4A;text-transform:uppercase;letter-spacing:1px;">What to do next</p>
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:4px 12px 4px 0;vertical-align:top;font-size:18px;">📄</td>
                      <td style="padding:4px 0;font-size:14px;color:#4A1A2A;line-height:1.5;">Read your <strong>Offer Letter</strong> and <strong>NDA</strong> carefully</td>
                    </tr>
                    <tr>
                      <td style="padding:4px 12px 4px 0;vertical-align:top;font-size:18px;">✍️</td>
                      <td style="padding:4px 0;font-size:14px;color:#4A1A2A;line-height:1.5;">Type your full name as a digital signature</td>
                    </tr>
                    <tr>
                      <td style="padding:4px 12px 4px 0;vertical-align:top;font-size:18px;">✅</td>
                      <td style="padding:4px 0;font-size:14px;color:#4A1A2A;line-height:1.5;">Click <strong>Sign &amp; Submit</strong> — done in under 2 minutes!</td>
                    </tr>
                  </table>
                </td></tr>
              </table>

              <!-- CTA button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                <tr>
                  <td align="center">
                    <a href="${opts.signingLink}" style="display:inline-block;background:#C2185B;color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;padding:16px 44px;border-radius:50px;text-decoration:none;letter-spacing:0.3px;">✍️ Review &amp; Sign My Documents</a>
                  </td>
                </tr>
              </table>

              <!-- Fallback link -->
              <p style="margin:0 0 20px;font-size:12px;color:#9E7B8A;text-align:center;line-height:1.6;">
                Button not working? Copy and paste this link into your browser:<br/>
                <a href="${opts.signingLink}" style="color:#C2185B;word-break:break-all;font-size:11px;">${opts.signingLink}</a>
              </p>

              <!-- Expiry note -->
              <p style="margin:0;font-size:12px;color:#B09AA8;text-align:center;">⏳ This link is valid for <strong>7 days</strong>. Questions? Reply to this email.</p>
            </td>
          </tr>

          <!-- ── FOOTER ── -->
          <tr>
            <td style="background:#FFF0F5;padding:20px 32px;border-top:1px solid #F8D7E3;text-align:center;">
              <p style="margin:0 0 4px;font-size:12px;font-weight:bold;color:#8B1A4A;">AfroPuppyYoga</p>
              <p style="margin:0 0 6px;font-size:11px;color:#C4A0B0;">Kitchener-Waterloo &amp; Hamilton, Ontario</p>
              <p style="margin:0;font-size:11px;">
                <a href="https://afropuppyyoga.ca" style="color:#C2185B;text-decoration:none;">afropuppyyoga.ca</a>
                &nbsp;·&nbsp;
                <a href="https://instagram.com/afropuppyyoga" style="color:#C2185B;text-decoration:none;">@afropuppyyoga</a>
              </p>
            </td>
          </tr>

        </table>
        <!-- /Card -->

      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildSigningConfirmationEmail(opts: { applicantName: string; role: string; location: string }): string {
  const firstName = opts.applicantName.split(" ")[0];
  const APY_LOGO = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663446228701/pFRlGBKuUoljEWjn.png";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Documents Received — AfroPuppyYoga</title>
</head>
<body style="margin:0;padding:0;background-color:#FDF6F0;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FDF6F0;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(194,24,91,0.08);">
          <tr>
            <td style="background:#FFF0F5;padding:24px 32px 18px;text-align:center;border-bottom:1px solid #F8D7E3;">
              <img src="${APY_LOGO}" alt="AfroPuppyYoga" width="52" height="52" style="display:block;margin:0 auto 8px;border-radius:12px;" />
              <p style="margin:0;font-family:Georgia,serif;font-size:17px;font-weight:bold;color:#8B1A4A;letter-spacing:0.5px;">AfroPuppyYoga</p>
              <p style="margin:3px 0 0;font-size:10px;color:#C47A9A;letter-spacing:2px;text-transform:uppercase;">Canada's #1 Puppy Yoga Studio</p>
            </td>
          </tr>
          <tr>
            <td style="background:#C2185B;padding:32px 32px 24px;text-align:center;">
              <p style="margin:0 0 6px;font-size:12px;font-weight:bold;color:#FFD6E7;letter-spacing:1.5px;text-transform:uppercase;">🎉 Documents Received!</p>
              <h1 style="margin:0 0 10px;font-family:Georgia,serif;font-size:27px;color:#FFFFFF;line-height:1.25;">Welcome to the pack,<br/>${firstName}! 🐶💕</h1>
              <p style="margin:0;font-size:14px;color:#FFE4EF;line-height:1.5;"><strong style="color:#fff;">${opts.role}</strong> &middot; <strong style="color:#fff;">${opts.location}</strong></p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 24px;background:#FFFFFF;">
              <p style="margin:0 0 16px;font-size:15px;color:#3D1A2A;line-height:1.7;">We've received your signed Offer Letter and NDA. Your documents are on file and everything is confirmed!</p>
              <p style="margin:0 0 16px;font-size:15px;color:#3D1A2A;line-height:1.7;">We'll be in touch shortly with your onboarding details and orientation schedule. We can't wait to have you on the team!</p>
              <p style="margin:24px 0 0;font-family:Georgia,serif;font-size:15px;color:#1A0A12;">With excitement,<br/><strong>The AfroPuppyYoga Team</strong></p>
            </td>
          </tr>
          <tr>
            <td style="background:#FFF0F5;padding:18px 32px;border-top:1px solid #F8D7E3;text-align:center;">
              <p style="margin:0 0 4px;font-size:12px;font-weight:bold;color:#8B1A4A;">AfroPuppyYoga</p>
              <p style="margin:0 0 5px;font-size:11px;color:#C4A0B0;">Kitchener-Waterloo &amp; Hamilton, Ontario</p>
              <p style="margin:0;font-size:11px;"><a href="https://afropuppyyoga.ca" style="color:#C2185B;text-decoration:none;">afropuppyyoga.ca</a> &nbsp;&middot;&nbsp; <a href="https://instagram.com/afropuppyyoga" style="color:#C2185B;text-decoration:none;">@afropuppyyoga</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
