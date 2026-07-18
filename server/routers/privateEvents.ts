import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { notifyOwner } from "../_core/notification";
import { sendEmail } from "../email";
import { getDb } from "../db";
import { privateEventInquiries } from "../../drizzle/schema";
import { desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

const APY_EMAIL = "afropuppyyogaofficial@gmail.com";

/** Escape user-supplied text before interpolating into HTML email templates */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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
            <p style="margin:0 0 24px;font-size:16px;color:#4A2535;">You have a new private event inquiry from <strong>${escapeHtml(input.name)}</strong>. Here are the details:</p>

            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #F5E6EC;font-size:14px;color:#9B6B7A;width:40%;font-weight:600;">Contact Name</td>
                <td style="padding:10px 0;border-bottom:1px solid #F5E6EC;font-size:14px;color:#1A0A12;">${escapeHtml(input.name)}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #F5E6EC;font-size:14px;color:#9B6B7A;font-weight:600;">Email</td>
                <td style="padding:10px 0;border-bottom:1px solid #F5E6EC;font-size:14px;color:#1A0A12;"><a href="mailto:${escapeHtml(input.email)}" style="color:#D4708A;">${escapeHtml(input.email)}</a></td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #F5E6EC;font-size:14px;color:#9B6B7A;font-weight:600;">Phone</td>
                <td style="padding:10px 0;border-bottom:1px solid #F5E6EC;font-size:14px;color:#1A0A12;">${escapeHtml(input.phone || "Not provided")}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #F5E6EC;font-size:14px;color:#9B6B7A;font-weight:600;">Event Type</td>
                <td style="padding:10px 0;border-bottom:1px solid #F5E6EC;font-size:14px;color:#1A0A12;">${escapeHtml(input.eventType)}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #F5E6EC;font-size:14px;color:#9B6B7A;font-weight:600;">Number of Guests</td>
                <td style="padding:10px 0;border-bottom:1px solid #F5E6EC;font-size:14px;color:#1A0A12;">${input.guests}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #F5E6EC;font-size:14px;color:#9B6B7A;font-weight:600;">Location</td>
                <td style="padding:10px 0;border-bottom:1px solid #F5E6EC;font-size:14px;color:#1A0A12;">${escapeHtml(input.location)}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #F5E6EC;font-size:14px;color:#9B6B7A;font-weight:600;">Package Interest</td>
                <td style="padding:10px 0;border-bottom:1px solid #F5E6EC;font-size:14px;color:#1A0A12;">${escapeHtml(input.packageLabel)}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #F5E6EC;font-size:14px;color:#9B6B7A;font-weight:600;">Preferred Date</td>
                <td style="padding:10px 0;border-bottom:1px solid #F5E6EC;font-size:14px;color:#1A0A12;">${input.preferredDate || "Not specified"}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #F5E6EC;font-size:14px;color:#9B6B7A;font-weight:600;">Notes</td>
                <td style="padding:10px 0;border-bottom:1px solid #F5E6EC;font-size:14px;color:#1A0A12;">${escapeHtml(input.notes || "None")}</td>
              </tr>
            </table>

            <!-- Estimate highlight -->
            <div style="margin:28px 0;background:#FFF0F5;border-left:4px solid #F2A0B8;border-radius:8px;padding:20px 24px;">
              <p style="margin:0 0 4px;font-size:12px;color:#9B6B7A;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;">Estimated Quote</p>
              <p style="margin:0;font-size:26px;font-weight:800;color:#1A0A12;">${input.estimateStr}</p>
            </div>

            <p style="margin:0;font-size:14px;color:#9B6B7A;">Reply directly to this email or reach the client at <a href="mailto:${escapeHtml(input.email)}" style="color:#D4708A;">${escapeHtml(input.email)}</a> to follow up.</p>
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

function buildCustomerConfirmationHtml(input: {
  name: string;
  eventType: string;
  guests: number;
  location: string;
  packageLabel: string;
  preferredDate: string;
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
          <td style="background:#8B2252;padding:36px 40px;text-align:center;">
            <p style="margin:0 0 6px;font-size:12px;color:#F2A0B8;letter-spacing:2px;text-transform:uppercase;font-weight:600;">AfroPuppyYoga</p>
            <h1 style="margin:0;font-size:26px;color:#ffffff;font-weight:800;">We've Got Your Inquiry! 🐾</h1>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 20px;font-size:16px;color:#3D1A2E;">Hi <strong>${escapeHtml(input.name)}</strong>,</p>
            <p style="margin:0 0 24px;font-size:15px;color:#4A2535;line-height:1.6;">Thanks for reaching out about a private puppy yoga event! We've received your inquiry and will be in touch within <strong>24 hours</strong> with availability and a formal quote.</p>

            <!-- Estimate highlight -->
            <div style="margin:0 0 28px;background:#FFF0F5;border-left:4px solid #8B2252;border-radius:8px;padding:20px 24px;">
              <p style="margin:0 0 4px;font-size:12px;color:#9B6B7A;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;">Your Estimate</p>
              <p style="margin:0;font-size:28px;font-weight:800;color:#1A0A12;">${input.estimateStr}</p>
              <p style="margin:4px 0 0;font-size:12px;color:#9B6B7A;">This is an estimate based on the details you provided. Final pricing confirmed upon booking.</p>
            </div>

            <!-- Summary table -->
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:28px;">
              <tr><td colspan="2" style="padding-bottom:10px;font-size:13px;font-weight:700;color:#8B2252;text-transform:uppercase;letter-spacing:1px;">Your Event Details</td></tr>
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #F5E6EC;font-size:13px;color:#9B6B7A;width:40%;font-weight:600;">Event Type</td>
                <td style="padding:8px 0;border-bottom:1px solid #F5E6EC;font-size:13px;color:#1A0A12;">${escapeHtml(input.eventType)}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #F5E6EC;font-size:13px;color:#9B6B7A;font-weight:600;">Guests</td>
                <td style="padding:8px 0;border-bottom:1px solid #F5E6EC;font-size:13px;color:#1A0A12;">${input.guests}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #F5E6EC;font-size:13px;color:#9B6B7A;font-weight:600;">Location</td>
                <td style="padding:8px 0;border-bottom:1px solid #F5E6EC;font-size:13px;color:#1A0A12;">${escapeHtml(input.location)}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #F5E6EC;font-size:13px;color:#9B6B7A;font-weight:600;">Package</td>
                <td style="padding:8px 0;border-bottom:1px solid #F5E6EC;font-size:13px;color:#1A0A12;">${escapeHtml(input.packageLabel)}</td>
              </tr>
              ${input.preferredDate ? `<tr>
                <td style="padding:8px 0;border-bottom:1px solid #F5E6EC;font-size:13px;color:#9B6B7A;font-weight:600;">Preferred Date</td>
                <td style="padding:8px 0;border-bottom:1px solid #F5E6EC;font-size:13px;color:#1A0A12;">${escapeHtml(input.preferredDate)}</td>
              </tr>` : ""}
            </table>

            <!-- What happens next -->
            <div style="background:#FFF5F9;border-radius:12px;padding:20px 24px;margin-bottom:28px;">
              <p style="margin:0 0 14px;font-size:13px;font-weight:700;color:#8B2252;text-transform:uppercase;letter-spacing:1px;">What Happens Next</p>
              <div style="display:flex;align-items:flex-start;margin-bottom:10px;">
                <span style="display:inline-block;width:22px;height:22px;background:#8B2252;color:#fff;border-radius:50%;text-align:center;line-height:22px;font-size:11px;font-weight:700;margin-right:10px;flex-shrink:0;">1</span>
                <span style="font-size:14px;color:#4A2535;">We review your event details &amp; check availability</span>
              </div>
              <div style="display:flex;align-items:flex-start;margin-bottom:10px;">
                <span style="display:inline-block;width:22px;height:22px;background:#8B2252;color:#fff;border-radius:50%;text-align:center;line-height:22px;font-size:11px;font-weight:700;margin-right:10px;flex-shrink:0;">2</span>
                <span style="font-size:14px;color:#4A2535;">We confirm puppy &amp; instructor availability</span>
              </div>
              <div style="display:flex;align-items:flex-start;">
                <span style="display:inline-block;width:22px;height:22px;background:#8B2252;color:#fff;border-radius:50%;text-align:center;line-height:22px;font-size:11px;font-weight:700;margin-right:10px;flex-shrink:0;">3</span>
                <span style="font-size:14px;color:#4A2535;">You receive a formal quote &amp; booking link within 24 hrs</span>
              </div>
            </div>

            <p style="margin:0 0 8px;font-size:14px;color:#4A2535;">Questions in the meantime? Reply to this email or reach us at:</p>
            <p style="margin:0;font-size:14px;"><a href="mailto:afropuppyyogaofficial@gmail.com" style="color:#8B2252;font-weight:600;">afropuppyyogaofficial@gmail.com</a></p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#FFF5F8;padding:20px 40px;text-align:center;border-top:1px solid #F5E6EC;">
            <p style="margin:0 0 4px;font-size:12px;color:#C4A0B0;">AfroPuppyYoga &bull; Ontario's #1 Puppy Yoga Experience</p>
            <p style="margin:0;font-size:12px;color:#C4A0B0;"><a href="https://afropuppyyoga.ca" style="color:#D4708A;">afropuppyyoga.ca</a></p>
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
        packageType: z.enum(["classic", "signature", "luxury"]),
        preferredDate: z.string().optional().default(""),
        notes: z.string().optional().default(""),
        // estimatedMin/Max from client are ignored — server recalculates below
        estimatedMin: z.number().optional(),
        estimatedMax: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // ── Server-side quote recalculation (source of truth) ──────────────
      const BASE_MIN = 1200, BASE_MAX = 1500;
      const SECOND_SESSION_MIN = 800, SECOND_SESSION_MAX = 1000;
      const SIGNATURE_UPGRADE = 750;
      const LUXURY_MIN = 2500;
      const TRAVEL_FEES: Record<string, number> = {
        kitchener: 0, waterloo: 0, cambridge: 0, hamilton: 0,
        guelph: 75, burlington: 100, oakville: 150,
        mississauga: 175, toronto: 200, brampton: 175, markham: 225, other: 200,
      };
      // Derive location key from the label string (lowercase first word)
      const locationKey = input.location.toLowerCase().split(/[\s,(]/)[0];
      const travelFee = TRAVEL_FEES[locationKey] ?? 200;

      // Corporate/brand events get a 20% uplift on Signature/Luxury
      const isCorporate = ["Corporate Wellness", "Brand Activation", "Team Building"].includes(input.eventType);

      let serverMin: number, serverMax: number;
      if (input.packageType === "luxury" || input.guests > 40) {
        serverMin = LUXURY_MIN;
        serverMax = LUXURY_MIN + 2500;
        if (isCorporate) { serverMin = Math.round(serverMin * 1.2); serverMax = Math.round(serverMax * 1.2); }
      } else {
        const sessions = input.guests > 20 ? 2 : 1;
        serverMin = BASE_MIN + (sessions === 2 ? SECOND_SESSION_MIN : 0) + travelFee;
        serverMax = BASE_MAX + (sessions === 2 ? SECOND_SESSION_MAX : 0) + travelFee;
        if (input.packageType === "signature") {
          serverMin += SIGNATURE_UPGRADE;
          serverMax += SIGNATURE_UPGRADE;
        }
      }
      // ── End recalculation ───────────────────────────────────────────────

      const packageLabel =
        input.packageType === "classic"
          ? "Classic Experience ($1,200-$1,500)"
          : input.packageType === "signature"
          ? "Signature Experience ($1,500-$2,250)"
          : "Luxury Experience ($2,500+)";

      const estimateStr =
        serverMin > 0
          ? `$${serverMin.toLocaleString()} - $${serverMax.toLocaleString()} CAD`
          : "Custom Luxury quote";

      // 1. Save to database first (source of truth)
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db.insert(privateEventInquiries).values({
        name: input.name,
        email: input.email,
        phone: input.phone || null,
        eventType: input.eventType,
        guests: input.guests,
        location: input.location,
        packageType: input.packageType,
        preferredDate: input.preferredDate || null,
        notes: input.notes || null,
        estimatedMin: serverMin,
        estimatedMax: serverMax,
      });

      // 2. Send branded email to APY inbox
      try {
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
      } catch (e) {
        console.error("Failed to send inquiry email:", e);
        // Don't throw — inquiry is already saved to DB
      }

      // 3. Send branded confirmation email to the customer
      try {
        await sendEmail({
          to: input.email,
          subject: `Your AfroPuppyYoga Private Event Inquiry — ${estimateStr}`,
          html: buildCustomerConfirmationHtml({
            name: input.name,
            eventType: input.eventType,
            guests: input.guests,
            location: input.location,
            packageLabel,
            preferredDate: input.preferredDate,
            estimateStr,
          }),
          text: [
            `Hi ${input.name},`,
            ``,
            `Thanks for reaching out about a private puppy yoga event! We've received your inquiry and will be in touch within 24 hours.`,
            ``,
            `YOUR ESTIMATE: ${estimateStr}`,
            ``,
            `Event Type: ${input.eventType}`,
            `Guests: ${input.guests}`,
            `Location: ${input.location}`,
            `Package: ${packageLabel}`,
            input.preferredDate ? `Preferred Date: ${input.preferredDate}` : "",
            ``,
            `Questions? Reply to this email or reach us at afropuppyyogaofficial@gmail.com`,
            ``,
            `— The AfroPuppyYoga Team`,
          ].filter(Boolean).join("\n"),
        });
      } catch (e) {
        console.error("Failed to send customer confirmation email:", e);
        // Don't throw — inquiry is already saved to DB
      }

      // 4. Also send Manus owner notification as backup
      try {
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
      } catch (e) {
        console.error("Failed to send owner notification:", e);
      }

      return { success: true };
    }),

  // Admin: list all inquiries (newest first)
  listInquiries: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin" && ctx.user.role !== "staff") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    const db = await getDb();
    if (!db) return [];
    return db
      .select()
      .from(privateEventInquiries)
      .orderBy(desc(privateEventInquiries.createdAt));
  }),

  // Admin: update inquiry status
  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["new", "contacted", "confirmed", "cancelled"]),
        adminNotes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "staff") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db
        .update(privateEventInquiries)
        .set({
          status: input.status,
          ...(input.adminNotes !== undefined ? { adminNotes: input.adminNotes } : {}),
        })
        .where(eq(privateEventInquiries.id, input.id));
      return { success: true };
    }),
});
