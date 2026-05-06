import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { notifyOwner } from "../_core/notification";
import { sendEmail } from "../email";

const APY_EMAIL = "afropuppyyogaofficial@gmail.com";

function buildInquiryEmailHtml(input: {
  name: string;
  email: string;
  phone: string;
  eventType: string;
  guests: number;
  location: string;
  packageType: string;
  packageLabel: string;
  preferredDate: string;
  notes: string;
  estimateStr: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#FFF5F8;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFF5F8;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:#F2A0B8;padding:32px 40px;text-align:center;">
            <p style="margin:0;font-size:13px;color:#7A3050;letter-spacing:2px;text-transform:uppercase;font-weight:600;">Private Event Inquiry</p>
            <h1 style="margin:8px 0 0;font-size:28px;color:#1A0A12;font-weight:800;">New Booking Request</h1>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 24px;font-size:16px;color:#4A2535;">You have a new private event inquiry from <strong>${input.name}</strong>. Here are the details:</p>

            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #F5E6EC;font-size:14px;color:#9B6B7A;width:40%;font-weight:600;">Contact Name</td>
                <td style="padding:10px 0;border-bottom:1px solid #F5E6EC;font-size:14px;color:#1A0A12;">${input.name}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #F5E6EC;font-size:14px;color:#9B6B7A;font-weight:600;">Email</td>
                <td style="padding:10px 0;border-bottom:1px solid #F5E6EC;font-size:14px;color:#1A0A12;"><a href="mailto:${input.email}" style="color:#D4708A;">${input.email}</a></td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #F5E6EC;font-size:14px;color:#9B6B7A;font-weight:600;">Phone</td>
                <td style="padding:10px 0;border-bottom:1px solid #F5E6EC;font-size:14px;color:#1A0A12;">${input.phone || "Not provided"}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #F5E6EC;font-size:14px;color:#9B6B7A;font-weight:600;">Event Type</td>
                <td style="padding:10px 0;border-bottom:1px solid #F5E6EC;font-size:14px;color:#1A0A12;">${input.eventType}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #F5E6EC;font-size:14px;color:#9B6B7A;font-weight:600;">Number of Guests</td>
                <td style="padding:10px 0;border-bottom:1px solid #F5E6EC;font-size:14px;color:#1A0A12;">${input.guests}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #F5E6EC;font-size:14px;color:#9B6B7A;font-weight:600;">Location</td>
                <td style="padding:10px 0;border-bottom:1px solid #F5E6EC;font-size:14px;color:#1A0A12;">${input.location}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #F5E6EC;font-size:14px;color:#9B6B7A;font-weight:600;">Package Interest</td>
                <td style="padding:10px 0;border-bottom:1px solid #F5E6EC;font-size:14px;color:#1A0A12;">${input.packageLabel}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #F5E6EC;font-size:14px;color:#9B6B7A;font-weight:600;">Preferred Date</td>
                <td style="padding:10px 0;border-bottom:1px solid #F5E6EC;font-size:14px;color:#1A0A12;">${input.preferredDate || "Not specified"}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #F5E6EC;font-size:14px;color:#9B6B7A;font-weight:600;">Notes</td>
                <td style="padding:10px 0;border-bottom:1px solid #F5E6EC;font-size:14px;color:#1A0A12;">${input.notes || "None"}</td>
              </tr>
            </table>

            <!-- Estimate highlight -->
            <div style="margin:28px 0;background:#FFF0F5;border-left:4px solid #F2A0B8;border-radius:8px;padding:20px 24px;">
              <p style="margin:0 0 4px;font-size:12px;color:#9B6B7A;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;">Estimated Quote</p>
              <p style="margin:0;font-size:26px;font-weight:800;color:#1A0A12;">${input.estimateStr}</p>
            </div>

            <p style="margin:0;font-size:14px;color:#9B6B7A;">Reply directly to this email or reach the client at <a href="mailto:${input.email}" style="color:#D4708A;">${input.email}</a> to follow up.</p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#FFF5F8;padding:20px 40px;text-align:center;border-top:1px solid #F5E6EC;">
            <p style="margin:0;font-size:12px;color:#C4A0B0;">AfroPuppyYoga &bull; afropuppyyogaofficial@gmail.com</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export const privateEventsRouter = router({
  submitInquiry: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        phone: z.string().optional().default(""),
        eventType: z.string().min(1),
        guests: z.number().min(1),
        location: z.string().min(1),
        packageType: z.enum(["base", "deluxe", "vip"]),
        preferredDate: z.string().optional().default(""),
        notes: z.string().optional().default(""),
        estimatedMin: z.number(),
        estimatedMax: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const packageLabel =
        input.packageType === "base"
          ? "Base ($1,200–$1,500)"
          : input.packageType === "deluxe"
          ? "Deluxe ($1,950–$2,250)"
          : "VIP ($3,000+)";

      const estimateStr =
        input.estimatedMin > 0
          ? `$${input.estimatedMin.toLocaleString()} – $${input.estimatedMax.toLocaleString()} CAD`
          : "Custom VIP quote";

      // Send branded email to APY inbox
      await sendEmail({
        to: APY_EMAIL,
        subject: `Private Event Inquiry: ${input.name} — ${input.guests} guests (${input.location})`,
        html: buildInquiryEmailHtml({
          name: input.name,
          email: input.email,
          phone: input.phone,
          eventType: input.eventType,
          guests: input.guests,
          location: input.location,
          packageType: input.packageType,
          packageLabel,
          preferredDate: input.preferredDate,
          notes: input.notes,
          estimateStr,
        }),
        text: [
          `NEW PRIVATE EVENT INQUIRY`,
          ``,
          `Name: ${input.name}`,
          `Email: ${input.email}`,
          `Phone: ${input.phone || "Not provided"}`,
          ``,
          `Event Type: ${input.eventType}`,
          `Guests: ${input.guests}`,
          `Location: ${input.location}`,
          `Package: ${packageLabel}`,
          `Preferred Date: ${input.preferredDate || "Not specified"}`,
          ``,
          `Estimated Quote: ${estimateStr}`,
          ``,
          `Notes: ${input.notes || "None"}`,
        ].join("\n"),
      });

      // Also send Manus owner notification as backup
      await notifyOwner({
        title: `Private Event Inquiry — ${input.name} (${input.guests} guests, ${input.location})`,
        content: [
          `NEW PRIVATE EVENT INQUIRY`,
          ``,
          `Name: ${input.name}`,
          `Email: ${input.email}`,
          `Phone: ${input.phone || "Not provided"}`,
          ``,
          `Event Type: ${input.eventType}`,
          `Guests: ${input.guests}`,
          `Location: ${input.location}`,
          `Package: ${packageLabel}`,
          `Preferred Date: ${input.preferredDate || "Not specified"}`,
          ``,
          `Estimated Quote: ${estimateStr}`,
          ``,
          `Notes: ${input.notes || "None"}`,
        ].join("\n"),
      });

      return { success: true };
    }),
});
