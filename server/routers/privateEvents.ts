import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { notifyOwner } from "../_core/notification";
import { sendEmail } from "../email";
import { getDb } from "../db";
import { privateEventInquiries } from "../../drizzle/schema";
import { desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

const LUMA_BASE = "https://public-api.luma.com/v1";
const HST_RATE = 0.13;

/** Locations with their addresses for Luma events */
const LOCATION_MAP: Record<string, { address: string; lat: number; lng: number }> = {
  kitchener: { address: "Kitchener, ON, Canada", lat: 43.4516, lng: -80.4925 },
  cambridge: { address: "Cambridge, ON, Canada", lat: 43.3616, lng: -80.3144 },
  toronto: { address: "Toronto, ON, Canada", lat: 43.6532, lng: -79.3832 },
  guelph: { address: "Guelph, ON, Canada", lat: 43.5448, lng: -80.2482 },
  hamilton: { address: "Hamilton, ON, Canada", lat: 43.2557, lng: -79.8711 },
  london: { address: "London, ON, Canada", lat: 42.9849, lng: -81.2453 },
};

/** APY branded cover image for private events */
const APY_PRIVATE_COVER = "https://images.lumacdn.com/event-covers/up/fc92575f-4105-4406-a89b-14105f70e638.jpg";

/** APY brand tint color (Cranberry) */
const APY_TINT_COLOR = "#9B2335";

/** Build a personalized Luma event description based on event type */
function buildEventDescription(params: {
  eventType: string;
  orgName: string;
  guests: number;
  sessions: number;
  breed: string;
}): string {
  const { eventType, orgName, guests, sessions, breed } = params;
  const sessionText = sessions > 1 ? `${sessions} sessions` : "a private session";

  // Personalized header and "Why" section based on event type
  let header: string;
  let whySection: string;

  switch (eventType.toLowerCase()) {
    case "birthday party":
      header = `## \u{1F436}\u2728 Private Puppy Yoga Birthday Experience \u2728\u{1F436}`;
      whySection = [
        `\u{1F49B} **Why Puppy Yoga for Birthdays?**`,
        ``,
        `Puppy yoga is the ultimate birthday surprise:`,
        `*   Create unforgettable memories with friends and adorable puppies`,
        `*   A unique celebration that everyone will be talking about`,
        `*   Perfect mix of relaxation, laughter, and puppy cuddles`,
        `*   Amazing photo opportunities for the birthday crew`,
      ].join("\n");
      break;
    case "bachelorette":
      header = `## \u{1F436}\u2728 Private Puppy Yoga Bachelorette Experience \u2728\u{1F436}`;
      whySection = [
        `\u{1F49B} **Why Puppy Yoga for Bachelorettes?**`,
        ``,
        `Puppy yoga adds something special to the celebration:`,
        `*   A unique, Instagram-worthy experience for the whole bridal party`,
        `*   Relaxing and joyful \u2014 the perfect balance to a busy wedding season`,
        `*   Adorable puppies bring out genuine smiles and laughter`,
        `*   A memorable bonding moment before the big day`,
      ].join("\n");
      break;
    case "corporate wellness":
    case "team building":
      header = `## \u{1F436}\u2728 Private Puppy Yoga Session \u2014 Designed for ${orgName} \u2728\u{1F436}`;
      whySection = [
        `\u{1F49B} **Why Puppy Yoga for Teams?**`,
        ``,
        `Puppy yoga helps teams:`,
        `*   Release tension and reset mentally between busy workdays`,
        `*   Reduce stress and boost morale in a lighthearted setting`,
        `*   Strengthen team connection through shared joy`,
        `*   Create memorable moments that build culture`,
      ].join("\n");
      break;
    case "baby shower":
      header = `## \u{1F436}\u2728 Private Puppy Yoga Baby Shower Experience \u2728\u{1F436}`;
      whySection = [
        `\u{1F49B} **Why Puppy Yoga for Baby Showers?**`,
        ``,
        `Puppy yoga makes the perfect baby shower activity:`,
        `*   A gentle, relaxing experience for the mom-to-be`,
        `*   Adorable puppies and babies \u2014 the cutest combination`,
        `*   A unique celebration everyone will remember`,
        `*   Calming stretches and joyful puppy interactions`,
      ].join("\n");
      break;
    default:
      header = `## \u{1F436}\u2728 Private Puppy Yoga Experience \u2014 ${orgName} \u2728\u{1F436}`;
      whySection = [
        `\u{1F49B} **Why Puppy Yoga?**`,
        ``,
        `Puppy yoga brings people together:`,
        `*   A unique wellness experience that combines movement and joy`,
        `*   Adorable puppies create an atmosphere of pure happiness`,
        `*   Perfect for groups looking for something different and memorable`,
        `*   Relaxing, fun, and guaranteed to leave everyone smiling`,
      ].join("\n");
      break;
  }

  return [
    header,
    ``,
    `Join us for **${sessionText} designed specifically for ${orgName}**, offering the perfect mix of stretching, relaxation, and puppy love.`,
    ``,
    `This session blends **gentle yoga**, **playful ${breed}**, and a relaxed, joyful atmosphere \u2014 designed to leave your group feeling refreshed and connected.`,
    ``,
    `\u{1F9D8}\u200D\u2640\uFE0F **What to Expect**`,
    ``,
    `*   A beginner-friendly yoga flow focused on stretching, mobility, and relaxation`,
    `*   Plenty of time to interact with **${breed}** \u{1F43E}`,
    `*   A calm, supportive environment led by an experienced instructor`,
    `*   A fun, uplifting experience that encourages laughter, connection, and relaxation`,
    `*   Group photo + puppy playtime after yoga`,
    ``,
    whySection,
    ``,
    `All puppies are carefully monitored throughout the session to ensure their comfort, safety, and well-being at all times.`,
    ``,
    `We\u2019re excited to welcome your group to the mat for a unique wellness experience.`,
    ``,
    `\u{1F4DE} **Contact Us**`,
    `Phone: **+1 (289) 788-1885**`,
    `Email: **afropuppyyogaofficial@gmail.com**`,
    `Website: **[afropuppyyoga.ca](https://afropuppyyoga.ca)**`,
  ].join("\n");
}

/** Create a private paid event on Luma */
async function createLumaEvent(params: {
  name: string;
  startAt: string; // ISO 8601
  endAt: string; // ISO 8601
  location: string;
  maxCapacity: number;
  description: string;
  priceCents: number;
  sessions: number;
  coverUrl?: string;
  tintColor?: string;
}): Promise<{ eventId: string; eventUrl: string }> {
  const apiKey = process.env.LUMA_API_KEY;
  if (!apiKey) throw new Error("LUMA_API_KEY is not set");

  const locKey = params.location.toLowerCase().trim();
  const loc = LOCATION_MAP[locKey];
  // If not a known studio, use the raw address string (client's location)
  const address = loc ? loc.address : params.location;
  const coordinate = loc ? { latitude: loc.lat, longitude: loc.lng } : undefined;

  // 1. Create the event (private, unlisted)
  const createRes = await fetch(`${LUMA_BASE}/events/create`, {
    method: "POST",
    headers: {
      "x-luma-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: params.name,
      start_at: params.startAt,
      end_at: params.endAt,
      timezone: "America/Toronto",
      visibility: "private",
      max_capacity: params.maxCapacity,
      geo_address_json: { type: "manual", address },
      ...(coordinate ? { coordinate } : {}),
      phone_number_requirement: "required",
      name_requirement: "first-last",
      description_md: params.description,
      cover_url: params.coverUrl || APY_PRIVATE_COVER,
      tint_color: params.tintColor || APY_TINT_COLOR,
      registration_questions: [
        {
          id: "waiver",
          label: "I acknowledge and accept AfroPuppyYoga's waiver and terms of service. Participants must be 18+ years of age.",
          required: true,
          question_type: "agree-check",
        },
      ],
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Luma create event failed: ${createRes.status} ${err}`);
  }

  const createData = (await createRes.json()) as { id: string };
  const eventId = createData.id;

  // 2. Create a paid ticket type
  const ticketRes = await fetch(`${LUMA_BASE}/events/ticket-types/create`, {
    method: "POST",
    headers: {
      "x-luma-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      event_id: eventId,
      name: params.sessions > 1 ? `Private Experience (${params.sessions} sessions)` : "Private Experience",
      type: "paid",
      cents: params.priceCents,
      currency: "cad",
      max_capacity: 1, // One ticket = entire booking
    }),
  });

  if (!ticketRes.ok) {
    const err = await ticketRes.text();
    throw new Error(`Luma create ticket type failed: ${ticketRes.status} ${err}`);
  }

  // 3. Remove the default "Standard" free ticket that Luma auto-creates
  try {
    const listRes = await fetch(`${LUMA_BASE}/events/ticket-types/list?event_id=${eventId}`, {
      headers: { "x-luma-api-key": apiKey },
    });
    if (listRes.ok) {
      const { entries } = (await listRes.json()) as { entries: Array<{ id: string; type: string; name: string }> };
      for (const ticket of entries) {
        if (ticket.type === "free" && ticket.name === "Standard") {
          await fetch(`${LUMA_BASE}/events/ticket-types/delete`, {
            method: "POST",
            headers: { "x-luma-api-key": apiKey, "Content-Type": "application/json" },
            body: JSON.stringify({ event_ticket_type_id: ticket.id }),
          });
        }
      }
    }
  } catch (e) {
    // Non-critical — the free ticket just stays visible if this fails
  }

  // 4. Fetch the actual event URL from Luma (they generate a slug-based URL)
  const getRes = await fetch(`${LUMA_BASE}/events/get?event_id=${eventId}`, {
    headers: { "x-luma-api-key": apiKey },
  });
  let eventUrl = `https://luma.com/${eventId}`; // fallback
  if (getRes.ok) {
    const eventData = (await getRes.json()) as { url?: string };
    if (eventData.url) eventUrl = eventData.url;
  }

  return { eventId, eventUrl };
}

const APY_EMAIL = "afropuppyyoga@gmail.com";

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
            <p style="margin:0;font-size:12px;color:#C4A0B0;">AfroPuppyYoga &bull; afropuppyyoga@gmail.com</p>
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
            <p style="margin:0;font-size:14px;"><a href="mailto:afropuppyyoga@gmail.com" style="color:#8B2252;font-weight:600;">afropuppyyoga@gmail.com</a></p>
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
            `Questions? Reply to this email or reach us at afropuppyyoga@gmail.com`,
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
        status: z.enum(["new", "contacted", "confirmed", "cancelled", "quote_sent", "booked"]),
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

  // Generate a private Luma booking link for an inquiry
  generateBookingLink: protectedProcedure
    .input(
      z.object({
        inquiryId: z.number(),
        finalPrice: z.number().min(1), // in dollars (CAD)
        pricingType: z.enum(["plus_hst", "all_in"]),
        sessions: z.number().min(1).default(1),
        puppyBreed: z.string().optional(),
        organization: z.string().optional(),
        eventDate: z.string(), // ISO date string e.g. "2026-08-08"
        startTime: z.string().default("14:00"), // HH:mm
        endTime: z.string().default("15:30"), // HH:mm
        customLocation: z.string().optional(), // Client's address for on-site events
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "staff") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Fetch the inquiry
      const [inquiry] = await db
        .select()
        .from(privateEventInquiries)
        .where(eq(privateEventInquiries.id, input.inquiryId));
      if (!inquiry) throw new TRPCError({ code: "NOT_FOUND", message: "Inquiry not found" });

      // Calculate pricing
      let totalCents: number;
      let hstCents: number;
      if (input.pricingType === "plus_hst") {
        hstCents = Math.round(input.finalPrice * 100 * HST_RATE);
        totalCents = input.finalPrice * 100 + hstCents;
      } else {
        // all_in: price already includes HST
        totalCents = input.finalPrice * 100;
        hstCents = Math.round(totalCents - totalCents / (1 + HST_RATE));
      }

      // Check if owner approval is needed (discount below estimate or > $3000)
      const needsApproval = input.finalPrice < inquiry.estimatedMin || input.finalPrice > 3000;

      // Build event name
      const orgName = input.organization || inquiry.name;
      const eventName = "Private PuppyYoga Experience";

      // Build ISO timestamps (America/Toronto)
      const startAt = `${input.eventDate}T${input.startTime}:00-04:00`;
      const endAt = `${input.eventDate}T${input.endTime}:00-04:00`;

      // Build personalized description based on event type
      const breed = input.puppyBreed || "adorable puppies";
      const descLines = buildEventDescription({
        eventType: inquiry.eventType,
        orgName,
        guests: inquiry.guests,
        sessions: input.sessions,
        breed,
      });

      // Create the Luma event
      const { eventId, eventUrl } = await createLumaEvent({
        name: eventName,
        startAt,
        endAt,
        location: input.customLocation || inquiry.location,
        maxCapacity: inquiry.guests,
        description: descLines,
        priceCents: totalCents,
        sessions: input.sessions,
      });

      // Update the inquiry record
      await db
        .update(privateEventInquiries)
        .set({
          finalPriceCents: input.finalPrice * 100,
          hstCents,
          pricingType: input.pricingType,
          sessions: input.sessions,
          puppyBreed: input.puppyBreed || null,
          organization: input.organization || null,
          lumaEventUrl: eventUrl,
          lumaEventId: eventId,
          ownerApproved: !needsApproval, // auto-approved if no flag
          status: "quote_sent",
        })
        .where(eq(privateEventInquiries.id, input.inquiryId));

      return {
        success: true,
        eventUrl,
        eventId,
        totalCents,
        hstCents,
        needsApproval,
      };
    }),

  // Send the quote email with the Luma booking link
  sendQuoteEmail: protectedProcedure
    .input(
      z.object({
        inquiryId: z.number(),
        customMessage: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "staff") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [inquiry] = await db
        .select()
        .from(privateEventInquiries)
        .where(eq(privateEventInquiries.id, input.inquiryId));
      if (!inquiry) throw new TRPCError({ code: "NOT_FOUND" });
      if (!inquiry.lumaEventUrl) throw new TRPCError({ code: "BAD_REQUEST", message: "No booking link generated yet" });

      const totalDollars = inquiry.finalPriceCents
        ? (inquiry.finalPriceCents + (inquiry.hstCents || 0)) / 100
        : 0;
      const priceLabel = inquiry.pricingType === "plus_hst"
        ? `$${((inquiry.finalPriceCents || 0) / 100).toLocaleString()} + HST = $${totalDollars.toLocaleString()}`
        : `$${totalDollars.toLocaleString()} (HST included)`;

      const customMsg = input.customMessage
        ? `<p style="margin:0 0 16px;font-size:15px;color:#4A2535;">${escapeHtml(input.customMessage)}</p>`
        : "";

      const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#FFF5F8;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFF5F8;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#8B2252,#D4708A);padding:32px 40px;text-align:center;">
            <p style="margin:0;font-size:13px;color:#FFD4E5;letter-spacing:2px;text-transform:uppercase;font-weight:600;">Private Event Booking</p>
            <h1 style="margin:8px 0 0;font-size:26px;color:#ffffff;font-weight:800;">Your AfroPuppyYoga Experience Awaits</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 20px;font-size:16px;color:#1A0A12;">Hi <strong>${escapeHtml(inquiry.name)}</strong>,</p>
            <p style="margin:0 0 16px;font-size:15px;color:#4A2535;">We're thrilled to confirm your private puppy yoga experience! Here are the details:</p>
            ${customMsg}
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border-collapse:collapse;background:#FFF5F8;border-radius:12px;overflow:hidden;">
              <tr><td style="padding:12px 20px;border-bottom:1px solid #F5E6EC;font-size:14px;color:#9B6B7A;font-weight:600;">Event</td><td style="padding:12px 20px;border-bottom:1px solid #F5E6EC;font-size:14px;color:#1A0A12;">${escapeHtml(inquiry.organization || inquiry.name)} — Private Experience</td></tr>
              <tr><td style="padding:12px 20px;border-bottom:1px solid #F5E6EC;font-size:14px;color:#9B6B7A;font-weight:600;">Date</td><td style="padding:12px 20px;border-bottom:1px solid #F5E6EC;font-size:14px;color:#1A0A12;">${inquiry.preferredDate || "TBD"}</td></tr>
              <tr><td style="padding:12px 20px;border-bottom:1px solid #F5E6EC;font-size:14px;color:#9B6B7A;font-weight:600;">Location</td><td style="padding:12px 20px;border-bottom:1px solid #F5E6EC;font-size:14px;color:#1A0A12;">${escapeHtml(inquiry.location)}</td></tr>
              <tr><td style="padding:12px 20px;border-bottom:1px solid #F5E6EC;font-size:14px;color:#9B6B7A;font-weight:600;">Participants</td><td style="padding:12px 20px;border-bottom:1px solid #F5E6EC;font-size:14px;color:#1A0A12;">Up to ${inquiry.guests}</td></tr>
              <tr><td style="padding:12px 20px;border-bottom:1px solid #F5E6EC;font-size:14px;color:#9B6B7A;font-weight:600;">Sessions</td><td style="padding:12px 20px;border-bottom:1px solid #F5E6EC;font-size:14px;color:#1A0A12;">${inquiry.sessions || 1}</td></tr>
              ${inquiry.puppyBreed ? `<tr><td style="padding:12px 20px;border-bottom:1px solid #F5E6EC;font-size:14px;color:#9B6B7A;font-weight:600;">Puppy Breed</td><td style="padding:12px 20px;border-bottom:1px solid #F5E6EC;font-size:14px;color:#1A0A12;">${escapeHtml(inquiry.puppyBreed)}</td></tr>` : ""}
              <tr><td style="padding:12px 20px;font-size:14px;color:#9B6B7A;font-weight:600;">Total</td><td style="padding:12px 20px;font-size:16px;color:#1A0A12;font-weight:800;">${priceLabel}</td></tr>
            </table>
            <p style="margin:24px 0 16px;font-size:15px;color:#4A2535;">To secure your booking, please complete your registration and payment through the link below:</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center" style="padding:8px 0 24px;">
                <a href="${inquiry.lumaEventUrl}" style="display:inline-block;background:#8B2252;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:50px;">Complete Booking &amp; Pay</a>
              </td></tr>
            </table>
            <p style="margin:0 0 8px;font-size:13px;color:#9B6B7A;">This is a private, unlisted event page created exclusively for your group. No refunds once payment is processed.</p>
            <p style="margin:16px 0 0;font-size:15px;color:#4A2535;">Questions? Reply to this email or reach us at <a href="mailto:afropuppyyoga@gmail.com" style="color:#D4708A;">afropuppyyoga@gmail.com</a></p>
            <p style="margin:24px 0 0;font-size:15px;color:#1A0A12;">Can't wait to see you there!</p>
            <p style="margin:4px 0 0;font-size:15px;color:#1A0A12;font-weight:600;">— The AfroPuppyYoga Team</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

      await sendEmail({
        to: inquiry.email,
        subject: `Your Private AfroPuppyYoga Booking — ${priceLabel}`,
        html,
        text: [
          `Hi ${inquiry.name},`,
          ``,
          `We're thrilled to confirm your private puppy yoga experience!`,
          input.customMessage ? `\n${input.customMessage}\n` : "",
          `Event: ${inquiry.organization || inquiry.name} — Private Experience`,
          `Date: ${inquiry.preferredDate || "TBD"}`,
          `Location: ${inquiry.location}`,
          `Participants: Up to ${inquiry.guests}`,
          `Total: ${priceLabel}`,
          ``,
          `Complete your booking here: ${inquiry.lumaEventUrl}`,
          ``,
          `No refunds once payment is processed.`,
          `Questions? Reply to this email.`,
          ``,
          `— The AfroPuppyYoga Team`,
        ].filter(Boolean).join("\n"),
      });

      // Update quoteSentAt
      await db
        .update(privateEventInquiries)
        .set({ quoteSentAt: new Date(), status: "quote_sent" })
        .where(eq(privateEventInquiries.id, input.inquiryId));

      return { success: true };
    }),

  /** Delete a generated Luma event and clear the link from the inquiry */
  deleteLumaEvent: protectedProcedure
    .input(z.object({ inquiryId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "staff") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [inquiry] = await db
        .select()
        .from(privateEventInquiries)
        .where(eq(privateEventInquiries.id, input.inquiryId));
      if (!inquiry) throw new TRPCError({ code: "NOT_FOUND", message: "Inquiry not found" });
      if (!inquiry.lumaEventId) throw new TRPCError({ code: "BAD_REQUEST", message: "No Luma event to delete" });

      const apiKey = process.env.LUMA_API_KEY;
      if (!apiKey) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "LUMA_API_KEY not set" });

      // Delete the event on Luma
      const delRes = await fetch(`${LUMA_BASE}/events/delete?event_id=${inquiry.lumaEventId}`, {
        method: "DELETE",
        headers: { "x-luma-api-key": apiKey },
      });

      // Luma returns 404 if already deleted — that's fine
      if (!delRes.ok && delRes.status !== 404) {
        const err = await delRes.text();
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Luma delete failed: ${delRes.status} ${err}` });
      }

      // Clear the link from the inquiry and revert status
      await db
        .update(privateEventInquiries)
        .set({
          lumaEventUrl: null,
          lumaEventId: null,
          status: "contacted",
        })
        .where(eq(privateEventInquiries.id, input.inquiryId));

      return { success: true };
    }),

  /** Standalone Quick Booking Link — creates a Luma event without an existing inquiry */
  generateQuickBookingLink: protectedProcedure
    .input(
      z.object({
        clientName: z.string().min(1),
        organization: z.string().optional(),
        eventType: z.string().default("Private Event"),
        eventDate: z.string(), // ISO date e.g. "2026-09-19"
        sessions: z.number().min(1).default(1),
        sessionSchedule: z.array(z.object({
          startTime: z.string(), // HH:mm
          endTime: z.string(),   // HH:mm
        })).min(1),
        location: z.string().default("kitchener"),
        customLocation: z.string().optional(),
        maxCapacity: z.number().min(1).default(20),
        finalPrice: z.number().min(1), // in dollars (CAD)
        pricingType: z.enum(["plus_hst", "all_in"]),
        puppyBreed: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "staff") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Calculate pricing
      let totalCents: number;
      let hstCents: number;
      if (input.pricingType === "plus_hst") {
        hstCents = Math.round(input.finalPrice * 100 * HST_RATE);
        totalCents = input.finalPrice * 100 + hstCents;
      } else {
        totalCents = input.finalPrice * 100;
        hstCents = Math.round(totalCents - totalCents / (1 + HST_RATE));
      }

      // Use first session start and last session end for the Luma event times
      const firstSession = input.sessionSchedule[0];
      const lastSession = input.sessionSchedule[input.sessionSchedule.length - 1];
      const startAt = `${input.eventDate}T${firstSession.startTime}:00-04:00`;
      const endAt = `${input.eventDate}T${lastSession.endTime}:00-04:00`;

      // Build personalized description
      const orgName = input.organization || input.clientName;
      const breed = input.puppyBreed || "adorable puppies";
      const descLines = buildEventDescription({
        eventType: input.eventType,
        orgName,
        guests: input.maxCapacity,
        sessions: input.sessions,
        breed,
      });

      // Add session schedule to description if multi-session
      let fullDescription = descLines;
      if (input.sessions > 1 && input.sessionSchedule.length > 1) {
        const scheduleLines = input.sessionSchedule.map((s, i) => 
          `\n\u{1F436} **Session ${i + 1}:** ${s.startTime} to ${s.endTime}`
        ).join("");
        fullDescription = `${descLines}\n\n---\n\n## \u{1F4C5} Schedule\n${scheduleLines}`;
      }

      // Create the Luma event
      const { eventId, eventUrl } = await createLumaEvent({
        name: "Private PuppyYoga Experience",
        startAt,
        endAt,
        location: input.customLocation || input.location,
        maxCapacity: input.maxCapacity,
        description: fullDescription,
        priceCents: totalCents,
        sessions: input.sessions,
      });

      // Notify owner
      await notifyOwner({
        title: "\u{1F517} Quick Booking Link Generated",
        content: `Event for ${orgName} on ${input.eventDate} — $${(totalCents / 100).toFixed(2)} CAD\n${eventUrl}`,
      });

      return {
        success: true,
        eventUrl,
        eventId,
        totalCents,
        hstCents,
        clientName: input.clientName,
        organization: input.organization,
      };
    }),
});
