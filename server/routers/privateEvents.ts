import { z } from "zod";
import { ownerProcedure, publicProcedure, router, staffProcedure } from "../_core/trpc";
import { notifyOwner } from "../_core/notification";
import { sendEmail } from "../email";
import { getDb } from "../db";
import {
  communicationsLog,
  privateEventClasses,
  privateEventActions,
  privateEventInquiries,
  type PrivateEventInquiry,
} from "../../drizzle/schema";
import { and, asc, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { buildPrivateEventQuoteDraft } from "../privateEventQuote";
import { normalizeCanadianPhoneNumber } from "@shared/phone";
import { torontoDateTimeIso } from "../lumaScheduleHelper";
import { buildPrivateEventSessionPlan } from "../privateEventMultiSession";

const LUMA_BASE = "https://public-api.luma.com/v1";
const HST_RATE = 0.13;

export function calculatePrivateEventPrice(finalPrice: number, pricingType: "plus_hst" | "all_in", sessions = 1) {
  if (!Number.isInteger(sessions) || sessions < 1) throw new Error("At least one private-event session is required.");
  const enteredCents = Math.round(finalPrice * 100) * sessions;
  if (pricingType === "plus_hst") {
    const basePriceCents = enteredCents;
    const hstCents = Math.round(basePriceCents * HST_RATE);
    return { basePriceCents, hstCents, totalCents: basePriceCents + hstCents };
  }
  const basePriceCents = Math.round(enteredCents / (1 + HST_RATE));
  const hstCents = enteredCents - basePriceCents;
  return { basePriceCents, hstCents, totalCents: enteredCents };
}

/** The exact ticket amount sent to Luma, which applies HST separately at checkout. */
export function calculateLumaTicketPricing(finalPrice: number, pricingType: "plus_hst" | "all_in", sessions = 1) {
  const { basePriceCents, hstCents, totalCents } = calculatePrivateEventPrice(finalPrice, pricingType, sessions);
  return { lumaTicketCents: basePriceCents, hstCents, totalCents };
}

export function privateEventQuoteNeedsApproval(finalPrice: number, estimatedMin: number) {
  return finalPrice < estimatedMin || finalPrice > 3000;
}

/** APY Studio locations with actual addresses */
const LOCATION_MAP: Record<string, { address: string; fullAddress: string; lat: number; lng: number; googlePlaceId?: string }> = {
  kitchener: {
    address: "329 King St E",
    fullAddress: "329 King St E, Kitchener, ON N2G 2L2, Canada",
    lat: 43.4516,
    lng: -80.4925,
    googlePlaceId: "ChIJH-amGez0K4gRjJwKZT5ifpU",
  },
  hamilton: {
    address: "2751 Barton St E",
    fullAddress: "2751 Barton St E, Hamilton, ON L8E 2J8, Canada",
    lat: 43.2557,
    lng: -79.8711,
    googlePlaceId: "ChIJj19OTp-YLIgRv4e9qQwDoq8",
  },
  oakville: {
    address: "1670 North Service Rd E, Unit 108",
    fullAddress: "1670 North Service Rd E unit 108, Oakville, ON L6H 7G3, Canada",
    lat: 43.4545,
    lng: -79.6625,
    googlePlaceId: "ChIJofNPAT9DK4gRAhVcvaHDk7Y",
  },
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
    `Email: **afropuppyyoga@gmail.com**`,
    `Website: **[afropuppyyoga.ca](https://afropuppyyoga.ca)**`,
  ].join("\n");
}

/** Create a private paid event on Luma */
async function cancelUnpublishedLumaEvent(apiKey: string, eventId: string) {
  const requestRes = await fetch(`${LUMA_BASE}/events/cancel/request`, {
    method: "POST",
    headers: { "x-luma-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ event_id: eventId }),
  });
  if (!requestRes.ok) throw new Error(`Luma cleanup request failed: ${requestRes.status}`);
  const requestData = await requestRes.json() as { cancellation_token?: string; token?: string };
  const cancellationToken = requestData.cancellation_token || requestData.token;
  if (!cancellationToken) throw new Error("Luma cleanup request returned no cancellation token");
  const cancelRes = await fetch(`${LUMA_BASE}/events/cancel`, {
    method: "POST",
    headers: { "x-luma-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ event_id: eventId, cancellation_token: cancellationToken, should_refund: false }),
  });
  if (!cancelRes.ok) throw new Error(`Luma cleanup failed: ${cancelRes.status}`);
}

async function createLumaEvent(params: {
  name: string;
  startAt: string; // ISO 8601
  endAt: string; // ISO 8601
  location: string;
  maxCapacity: number;
  description: string;
  priceCents?: number;
  sessions: number;
  coverUrl?: string;
  tintColor?: string;
}): Promise<{ eventId: string; eventUrl: string }> {
  const apiKey = process.env.LUMA_API_KEY;
  if (!apiKey) throw new Error("LUMA_API_KEY is not set");

  const locKey = params.location.toLowerCase().trim();
  const loc = LOCATION_MAP[locKey];
  // If not a known studio, use the raw address string (client's location)
  const address = loc ? loc.fullAddress : params.location;
  const coordinate = loc ? { latitude: loc.lat, longitude: loc.lng } : undefined;
  const googlePlaceId = loc?.googlePlaceId;

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
      geo_address_json: googlePlaceId
        ? { type: "google", place_id: googlePlaceId }
        : { type: "manual", address },
      ...(coordinate ? { coordinate } : {}),
      phone_number_requirement: "required",
      name_requirement: "first-last",
      description_md: params.description,
      cover_url: params.coverUrl || APY_PRIVATE_COVER,
      tint_color: params.tintColor || APY_TINT_COLOR,
      theme: "hypnotic",
      registration_questions: [
        {
          id: "waiver",
          label: "I acknowledge and accept AfroPuppyYoga's waiver and terms of service.",
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

  // The primary class hosts the one combined checkout. Included follow-on
  // classes intentionally receive no ticket, so they cannot be purchased alone.
  if (params.priceCents !== undefined) {
    const ticketRes = await fetch(`${LUMA_BASE}/events/ticket-types/create`, {
      method: "POST",
      headers: {
        "x-luma-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event_id: eventId,
        name: params.sessions > 1 ? `Private (${params.sessions} Sessions — Combined Booking)` : "Private Experience",
        type: "paid",
        cents: params.priceCents,
        currency: "cad",
        max_capacity: 1, // One ticket = the entire combined booking
      }),
    });

    if (!ticketRes.ok) {
      const err = await ticketRes.text();
      try {
        await cancelUnpublishedLumaEvent(apiKey, eventId);
      } catch (cleanupError) {
        console.error(`[PrivateEvents] Failed to remove partial Luma event ${eventId}:`, cleanupError);
      }
      throw new Error(`Luma create ticket type failed: ${ticketRes.status} ${err}`);
    }
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
          const deleteRes = await fetch(`${LUMA_BASE}/events/ticket-types/delete`, {
            method: "POST",
            headers: { "x-luma-api-key": apiKey, "Content-Type": "application/json" },
            body: JSON.stringify({ event_ticket_type_id: ticket.id }),
          });
          if (!deleteRes.ok && params.priceCents === undefined) {
            throw new Error("Luma did not remove the included-session ticket.");
          }
        }
      }
      if (params.priceCents === undefined && !entries.some(ticket => ticket.type === "free" && ticket.name === "Standard")) {
        throw new Error("Luma did not expose the default ticket required for the included-session safeguard.");
      }
    } else if (params.priceCents === undefined) {
      throw new Error("Luma included-session ticket safeguard could not be verified.");
    }
  } catch (e) {
    if (params.priceCents === undefined) {
      try {
        await cancelUnpublishedLumaEvent(apiKey, eventId);
      } catch (cleanupError) {
        console.error(`[PrivateEvents] Failed to remove unsafe included-session event ${eventId}:`, cleanupError);
      }
      throw e;
    }
    // The primary checkout remains usable if its default free ticket cannot be removed.
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

function requirePreparedPrivateEvent(inquiry: PrivateEventInquiry) {
  if (
    !inquiry.finalPriceCents ||
    !inquiry.pricingType ||
    !inquiry.preferredDate ||
    !inquiry.eventStartTime ||
    !inquiry.eventEndTime ||
    !inquiry.eventVenue
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Complete the price, date, time, and venue before publishing the booking link.",
    });
  }
  if (inquiry.pricingType !== "plus_hst" && inquiry.pricingType !== "all_in") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "The saved pricing type is invalid." });
  }
  const pricingType: "plus_hst" | "all_in" = inquiry.pricingType;
  return {
    basePriceCents: inquiry.finalPriceCents,
    hstCents: inquiry.hstCents ?? 0,
    totalCents: inquiry.finalPriceCents + (inquiry.hstCents ?? 0),
    pricingType,
    eventDate: inquiry.preferredDate,
    startTime: inquiry.eventStartTime,
    endTime: inquiry.eventEndTime,
    venue: inquiry.eventVenue,
  };
}

function buildStoredPrivateEventQuote(inquiry: PrivateEventInquiry, eventUrl: string) {
  const prepared = requirePreparedPrivateEvent(inquiry);
  const sessionSchedule = buildPrivateEventSessionPlan({
    startTime: prepared.startTime,
    endTime: prepared.endTime,
    sessions: inquiry.sessions || 1,
  });
  return buildPrivateEventQuoteDraft({
    customerName: inquiry.name,
    organization: inquiry.organization,
    eventType: inquiry.eventType,
    guests: inquiry.guests,
    packageType: inquiry.packageType,
    eventDate: prepared.eventDate,
    startTime: prepared.startTime,
    sessionSchedule,
    venue: prepared.venue,
    basePriceCents: prepared.basePriceCents,
    hstCents: prepared.hstCents,
    pricingType: prepared.pricingType,
    eventUrl,
    puppyBreed: inquiry.puppyBreed,
  });
}

async function publishPrivateEvent(inquiry: PrivateEventInquiry) {
  const prepared = requirePreparedPrivateEvent(inquiry);
  const orgName = inquiry.organization || inquiry.name;
  const breed = inquiry.puppyBreed || "adorable puppies";
  const description = buildEventDescription({
    eventType: inquiry.eventType,
    orgName,
    guests: inquiry.guests,
    sessions: inquiry.sessions || 1,
    breed,
  });
  const sessionPlan = buildPrivateEventSessionPlan({
    startTime: prepared.startTime,
    endTime: prepared.endTime,
    sessions: inquiry.sessions || 1,
  });
  const scheduleDescription = sessionPlan.length > 1
    ? `${description}\n\n---\n\n## 📅 Your Included Time Slots\n${sessionPlan.map(slot => `• Session ${slot.sessionNumber}: ${slot.startTime} to ${slot.endTime}`).join("\n")}\n\nOne combined payment covers both sessions. There is a 30-minute break between them.`
    : description;
  const created: Array<{ eventId: string; eventUrl: string; sessionNumber: number; startTime: string; endTime: string; paymentMode: "combined_checkout" | "included" }> = [];
  try {
    for (const slot of sessionPlan) {
      const isCheckoutClass = slot.paymentMode === "combined_checkout";
      const createdEvent = await createLumaEvent({
        name: sessionPlan.length > 1 ? `${orgName} — Private PuppyYoga (Session ${slot.sessionNumber} of ${sessionPlan.length})` : `${orgName} — Private PuppyYoga`,
        startAt: torontoDateTimeIso(prepared.eventDate, slot.startTime),
        endAt: torontoDateTimeIso(prepared.eventDate, slot.endTime),
        location: prepared.venue,
        maxCapacity: inquiry.guests,
        description: scheduleDescription,
        // Luma applies HST at checkout; only the first class owns the combined ticket.
        ...(isCheckoutClass ? { priceCents: prepared.basePriceCents } : {}),
        sessions: sessionPlan.length,
      });
      created.push({ ...createdEvent, sessionNumber: slot.sessionNumber, startTime: slot.startTime, endTime: slot.endTime, paymentMode: slot.paymentMode });
    }
  } catch (error) {
    const apiKey = process.env.LUMA_API_KEY;
    if (apiKey) {
      await Promise.all(created.map(async event => {
        try { await cancelUnpublishedLumaEvent(apiKey, event.eventId); } catch (cleanupError) {
          console.error(`[PrivateEvents] Failed to remove partial multi-session event ${event.eventId}:`, cleanupError);
        }
      }));
    }
    throw error;
  }
  const primary = created[0];
  const emailDraft = buildStoredPrivateEventQuote(inquiry, primary.eventUrl);
  return { eventId: primary.eventId, eventUrl: primary.eventUrl, emailDraft, classes: created, ...prepared };
}

async function savePrivateEventClasses(inquiryId: number, classes: Array<{
  eventId: string;
  eventUrl: string;
  sessionNumber: number;
  startTime: string;
  endTime: string;
  paymentMode: "combined_checkout" | "included";
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable while saving private-event classes");
  await db.insert(privateEventClasses).values(classes.map(eventClass => ({
    inquiryId,
    sessionNumber: eventClass.sessionNumber,
    startTime: eventClass.startTime,
    endTime: eventClass.endTime,
    paymentMode: eventClass.paymentMode,
    lumaEventId: eventClass.eventId,
    lumaEventUrl: eventClass.eventUrl,
  })));
}

async function cancelPartialPrivateEventClasses(classes: Array<{ eventId: string }>) {
  const apiKey = process.env.LUMA_API_KEY;
  if (!apiKey) return;
  await Promise.all(classes.map(async eventClass => {
    try {
      await cancelUnpublishedLumaEvent(apiKey, eventClass.eventId);
    } catch (cleanupError) {
      console.error(`[PrivateEvents] Failed to remove partial multi-session event ${eventClass.eventId}:`, cleanupError);
    }
  }));
}

function actionDetails(value: Record<string, unknown>) {
  return JSON.stringify(value);
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
        phone: z.string().min(1, "A phone number is required for private-event inquiries.")
          .transform((value, ctx) => {
            const normalized = normalizeCanadianPhoneNumber(value);
            if (!normalized) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Enter a complete 10-digit Canadian phone number.",
              });
              return z.NEVER;
            }
            return normalized;
          }),
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
      const inserted = await db.insert(privateEventInquiries).values({
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
      const inquiryId = Number(inserted[0].insertId);

      // 2. Send branded email to APY inbox
      let customerConfirmationStatus = "sent";
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
        customerConfirmationStatus = "failed";
        console.error("Failed to send customer confirmation email:", e);
        // Don't throw — inquiry is already saved to DB
      }

      if (inquiryId) {
        await Promise.all([
          db.insert(privateEventActions).values({
            inquiryId,
            action: "inquiry_submitted",
            actorName: input.name,
            actorEmail: input.email,
            details: actionDetails({ estimatedMin: serverMin, estimatedMax: serverMax, packageType: input.packageType }),
          }),
          db.insert(communicationsLog).values({
            entityType: "private_event",
            entityId: inquiryId,
            channel: "email",
            direction: "outbound",
            action: "inquiry_confirmation_sent",
            recipient: input.email,
            subject: `Your AfroPuppyYoga Private Event Inquiry — ${estimateStr}`,
            bodyPreview: `Inquiry received for ${input.eventType}, ${input.guests} guests, ${input.location}. Estimated quote: ${estimateStr}.`,
            deliveryStatus: customerConfirmationStatus,
            actorName: "APY HQ",
          }),
        ]);
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
  listInquiries: staffProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db
      .select()
      .from(privateEventInquiries)
      .orderBy(desc(privateEventInquiries.createdAt));
  }),

  // Admin: update inquiry status
  updateStatus: staffProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["new", "contacted", "confirmed", "cancelled", "quote_sent", "booked"]),
        adminNotes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [inquiry] = await db.select().from(privateEventInquiries).where(eq(privateEventInquiries.id, input.id));
      if (!inquiry) throw new TRPCError({ code: "NOT_FOUND", message: "Inquiry not found" });
      await db
        .update(privateEventInquiries)
        .set({
          status: input.status,
          ...(input.adminNotes !== undefined ? { adminNotes: input.adminNotes } : {}),
        })
        .where(eq(privateEventInquiries.id, input.id));
      await db.insert(privateEventActions).values({
        inquiryId: input.id,
        action: "inquiry_updated",
        actorUserId: ctx.user.id,
        actorName: ctx.user.name,
        actorEmail: ctx.user.email,
        details: actionDetails({ fromStatus: inquiry.status, toStatus: input.status, notesChanged: input.adminNotes !== undefined }),
      });
      return { success: true };
    }),

  // Generate a private Luma booking link for an inquiry
  generateBookingLink: staffProcedure
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
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Fetch the inquiry
      const [inquiry] = await db
        .select()
        .from(privateEventInquiries)
        .where(eq(privateEventInquiries.id, input.inquiryId));
      if (!inquiry) throw new TRPCError({ code: "NOT_FOUND", message: "Inquiry not found" });
      if (inquiry.lumaEventId || inquiry.lumaEventUrl) {
        throw new TRPCError({ code: "CONFLICT", message: "Cancel the existing unused booking page before preparing a replacement." });
      }
      if (inquiry.quoteSentAt || inquiry.status === "booked") {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "A sent or booked quote cannot be replaced from this control." });
      }

      const { basePriceCents, hstCents, totalCents } = calculatePrivateEventPrice(input.finalPrice, input.pricingType, input.sessions);
      const needsApproval = privateEventQuoteNeedsApproval(input.finalPrice * input.sessions, inquiry.estimatedMin);
      const eventVenue = input.customLocation || inquiry.location;
      // Validate Toronto local date/time before any external event is created.
      torontoDateTimeIso(input.eventDate, input.startTime);
      torontoDateTimeIso(input.eventDate, input.endTime);

      // Save the reviewable commercial terms first. Out-of-policy quotes stop here:
      // no Luma payment page exists until the owner explicitly approves them.
      await db
        .update(privateEventInquiries)
        .set({
          finalPriceCents: basePriceCents,
          hstCents,
          pricingType: input.pricingType,
          sessions: input.sessions,
          puppyBreed: input.puppyBreed || null,
          organization: input.organization || null,
          preferredDate: input.eventDate,
          eventVenue,
          eventStartTime: input.startTime,
          eventEndTime: input.endTime,
          lumaEventUrl: null,
          lumaEventId: null,
          quoteEmailSubject: null,
          quoteEmailBody: null,
          ownerApproved: !needsApproval,
          approvalStatus: needsApproval ? "pending" : "approved",
          approvalRequestedAt: needsApproval ? new Date() : null,
          approvalRequestedByUserId: needsApproval ? ctx.user.id : null,
          approvalRequestedByName: needsApproval ? ctx.user.name : null,
          approvedAt: needsApproval ? null : new Date(),
          approvedByUserId: needsApproval ? null : ctx.user.id,
          approvedByName: needsApproval ? null : ctx.user.name,
          approvalRejectedAt: null,
          approvalRejectedByUserId: null,
          approvalRejectionReason: null,
          bookingLinkPublishedAt: null,
          status: "contacted",
        })
        .where(eq(privateEventInquiries.id, input.inquiryId));

      await db.insert(privateEventActions).values({
        inquiryId: inquiry.id,
        action: needsApproval ? "approval_requested" : "quote_auto_approved",
        actorUserId: ctx.user.id,
        actorName: ctx.user.name,
        actorEmail: ctx.user.email,
        details: actionDetails({ basePriceCents, hstCents, totalCents, pricingType: input.pricingType }),
      });

      if (needsApproval) {
        await notifyOwner({
          title: `Private Event Quote Needs Approval — ${inquiry.name}`,
          content: `${inquiry.name}: $${(totalCents / 100).toFixed(2)} CAD for ${input.eventDate}. No Luma payment page or client email has been created yet.`,
        });
        return {
          success: true,
          eventUrl: null,
          eventId: null,
          totalCents,
          hstCents,
          needsApproval: true,
          approvalStatus: "pending" as const,
          emailDraft: null,
        };
      }

      const [preparedInquiry] = await db
        .select()
        .from(privateEventInquiries)
        .where(eq(privateEventInquiries.id, input.inquiryId));
      if (!preparedInquiry) throw new TRPCError({ code: "NOT_FOUND", message: "Inquiry not found after preparation." });
      const published = await publishPrivateEvent(preparedInquiry);
      try {
        await savePrivateEventClasses(inquiry.id, published.classes);
      } catch (error) {
        await cancelPartialPrivateEventClasses(published.classes);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not save the private-event class schedule. No payment page was kept." });
      }
      await db.update(privateEventInquiries).set({
        lumaEventUrl: published.eventUrl,
        lumaEventId: published.eventId,
        quoteEmailSubject: published.emailDraft.subject,
        quoteEmailBody: published.emailDraft.body,
        bookingLinkPublishedAt: new Date(),
      }).where(eq(privateEventInquiries.id, input.inquiryId));
      await db.insert(privateEventActions).values({
        inquiryId: inquiry.id,
        action: "booking_link_published",
        actorUserId: ctx.user.id,
        actorName: ctx.user.name,
        actorEmail: ctx.user.email,
        details: actionDetails({ eventId: published.eventId, eventUrl: published.eventUrl }),
      });

      return {
        success: true,
        eventUrl: published.eventUrl,
        eventId: published.eventId,
        totalCents,
        hstCents,
        needsApproval: false,
        approvalStatus: "approved" as const,
        emailDraft: published.emailDraft,
      };
    }),

  /** Owner-only: approve an exception quote and publish its private payment page. */
  approveQuote: ownerProcedure
    .input(z.object({ inquiryId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [inquiry] = await db.select().from(privateEventInquiries).where(eq(privateEventInquiries.id, input.inquiryId));
      if (!inquiry) throw new TRPCError({ code: "NOT_FOUND", message: "Inquiry not found" });
      if (inquiry.approvalStatus !== "pending" && inquiry.approvalStatus !== "rejected") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This quote is not waiting for owner approval." });
      }
      if (Boolean(inquiry.lumaEventId) !== Boolean(inquiry.lumaEventUrl)) {
        throw new TRPCError({ code: "CONFLICT", message: "The legacy Luma booking record is incomplete and needs manual review." });
      }

      // Legacy records may already have an unapproved page from the former flow.
      // New quotes are published only after approval; legacy pages are adopted in place.
      const existingClasses = await db.select().from(privateEventClasses)
        .where(eq(privateEventClasses.inquiryId, inquiry.id))
        .orderBy(asc(privateEventClasses.sessionNumber));
      const requestedSessions = inquiry.sessions || 1;
      if (inquiry.lumaEventId && inquiry.lumaEventUrl && requestedSessions > 1 && existingClasses.length !== requestedSessions) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This legacy multi-session quote has an incomplete class schedule and needs manual review before approval.",
        });
      }
      const published = inquiry.lumaEventId && inquiry.lumaEventUrl
        ? {
            eventId: inquiry.lumaEventId,
            eventUrl: inquiry.lumaEventUrl,
            emailDraft: buildStoredPrivateEventQuote(inquiry, inquiry.lumaEventUrl),
            classes: existingClasses.map(eventClass => ({
              eventId: eventClass.lumaEventId,
              eventUrl: eventClass.lumaEventUrl,
              sessionNumber: eventClass.sessionNumber,
              startTime: eventClass.startTime,
              endTime: eventClass.endTime,
              paymentMode: eventClass.paymentMode,
            })),
          }
        : await publishPrivateEvent(inquiry);
      if (!inquiry.lumaEventId) {
        try {
          await savePrivateEventClasses(inquiry.id, published.classes);
        } catch (error) {
          await cancelPartialPrivateEventClasses(published.classes);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not save the private-event class schedule. No payment page was kept." });
        }
      }
      await db.update(privateEventInquiries).set({
        ownerApproved: true,
        approvalStatus: "approved",
        approvedAt: new Date(),
        approvedByUserId: ctx.user.id,
        approvedByName: ctx.user.name,
        approvalRejectedAt: null,
        approvalRejectedByUserId: null,
        approvalRejectionReason: null,
        lumaEventId: published.eventId,
        lumaEventUrl: published.eventUrl,
        quoteEmailSubject: published.emailDraft.subject,
        quoteEmailBody: published.emailDraft.body,
        bookingLinkPublishedAt: new Date(),
      }).where(eq(privateEventInquiries.id, input.inquiryId));
      await db.insert(privateEventActions).values({
        inquiryId: inquiry.id,
        action: inquiry.lumaEventId ? "legacy_quote_approved" : "quote_approved_and_published",
        actorUserId: ctx.user.id,
        actorName: ctx.user.name,
        actorEmail: ctx.user.email,
        details: actionDetails({ eventId: published.eventId, eventUrl: published.eventUrl }),
      });
      return { success: true, eventUrl: published.eventUrl, eventId: published.eventId, emailDraft: published.emailDraft };
    }),

  /** Owner-only: reject an exception quote without creating anything in Luma. */
  rejectQuote: ownerProcedure
    .input(z.object({ inquiryId: z.number(), reason: z.string().trim().min(3).max(2000) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [inquiry] = await db.select().from(privateEventInquiries).where(eq(privateEventInquiries.id, input.inquiryId));
      if (!inquiry) throw new TRPCError({ code: "NOT_FOUND", message: "Inquiry not found" });
      if (inquiry.lumaEventId || inquiry.quoteSentAt) {
        throw new TRPCError({ code: "CONFLICT", message: "A published or sent quote cannot be rejected from this control." });
      }
      await db.update(privateEventInquiries).set({
        ownerApproved: false,
        approvalStatus: "rejected",
        approvalRejectedAt: new Date(),
        approvalRejectedByUserId: ctx.user.id,
        approvalRejectionReason: input.reason,
      }).where(eq(privateEventInquiries.id, input.inquiryId));
      await db.insert(privateEventActions).values({
        inquiryId: inquiry.id,
        action: "quote_rejected",
        actorUserId: ctx.user.id,
        actorName: ctx.user.name,
        actorEmail: ctx.user.email,
        details: actionDetails({ reason: input.reason }),
      });
      return { success: true };
    }),

  getTimeline: staffProcedure
    .input(z.object({ inquiryId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { actions: [], communications: [] };
      const [actions, communications] = await Promise.all([
        db.select().from(privateEventActions).where(eq(privateEventActions.inquiryId, input.inquiryId)).orderBy(desc(privateEventActions.createdAt)),
        db.select().from(communicationsLog).where(and(
          eq(communicationsLog.entityType, "private_event"),
          eq(communicationsLog.entityId, input.inquiryId),
        )).orderBy(desc(communicationsLog.createdAt)),
      ]);
      return {
        actions,
        communications,
      };
    }),

  // Send the quote email with the Luma booking link
  sendQuoteEmail: staffProcedure
    .input(
      z.object({
        inquiryId: z.number(),
        subject: z.string().min(3).max(500).optional(),
        body: z.string().min(10).max(12000).optional(),
        customMessage: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [inquiry] = await db
        .select()
        .from(privateEventInquiries)
        .where(eq(privateEventInquiries.id, input.inquiryId));
      if (!inquiry) throw new TRPCError({ code: "NOT_FOUND" });
      if (!inquiry.ownerApproved || inquiry.approvalStatus !== "approved") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "The owner must approve this quote before it can be sent.",
        });
      }
      if (!inquiry.lumaEventUrl) throw new TRPCError({ code: "BAD_REQUEST", message: "No booking link generated yet" });
      if (inquiry.quoteSentAt) {
        throw new TRPCError({ code: "CONFLICT", message: "This quote email has already been sent." });
      }

      const savedClasses = await db.select().from(privateEventClasses)
        .where(eq(privateEventClasses.inquiryId, inquiry.id))
        .orderBy(asc(privateEventClasses.sessionNumber));
      const fallbackDraft = buildPrivateEventQuoteDraft({
        customerName: inquiry.name,
        organization: inquiry.organization,
        eventType: inquiry.eventType,
        guests: inquiry.guests,
        packageType: inquiry.packageType,
        eventDate: inquiry.preferredDate || "",
        startTime: inquiry.eventStartTime || "14:00",
        sessionSchedule: savedClasses.length > 0
          ? savedClasses.map(eventClass => ({ startTime: eventClass.startTime, endTime: eventClass.endTime }))
          : undefined,
        venue: inquiry.eventVenue || inquiry.location,
        basePriceCents: inquiry.finalPriceCents || 0,
        hstCents: inquiry.hstCents || 0,
        pricingType: inquiry.pricingType === "all_in" ? "all_in" : "plus_hst",
        eventUrl: inquiry.lumaEventUrl,
        puppyBreed: inquiry.puppyBreed,
      });
      const subject = input.subject || inquiry.quoteEmailSubject || fallbackDraft.subject;
      const body = input.body || inquiry.quoteEmailBody || fallbackDraft.body;
      const htmlBody = escapeHtml(body).replace(/\n/g, "<br />");

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
            <div style="margin:0;font-size:15px;line-height:1.65;color:#4A2535;white-space:normal;">${htmlBody}</div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

      await sendEmail({
        to: inquiry.email,
        subject,
        html,
        text: body,
      });

      // Update quoteSentAt
      await db
        .update(privateEventInquiries)
        .set({
          quoteEmailSubject: subject,
          quoteEmailBody: body,
          quoteSentAt: new Date(),
          status: "quote_sent",
        })
        .where(eq(privateEventInquiries.id, input.inquiryId));

      try {
        await Promise.all([
          db.insert(privateEventActions).values({
            inquiryId: inquiry.id,
            action: "quote_email_sent",
            actorUserId: ctx.user.id,
            actorName: ctx.user.name,
            actorEmail: ctx.user.email,
            details: actionDetails({ subject, recipient: inquiry.email }),
          }),
          db.insert(communicationsLog).values({
            entityType: "private_event",
            entityId: inquiry.id,
            channel: "email",
            direction: "outbound",
            action: "quote_sent",
            recipient: inquiry.email,
            subject,
            bodyPreview: body.slice(0, 1000),
            deliveryStatus: "sent",
            actorUserId: ctx.user.id,
            actorName: ctx.user.name,
          }),
        ]);
      } catch (error) {
        console.error(`[PrivateEvents] Quote sent but history write failed for inquiry ${inquiry.id}:`, error);
      }

      return { success: true };
    }),

  /** Operations may remove an unsent, unused Luma page through Luma's two-step cancellation API. */
  deleteLumaEvent: staffProcedure
    .input(z.object({ inquiryId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [inquiry] = await db
        .select()
        .from(privateEventInquiries)
        .where(eq(privateEventInquiries.id, input.inquiryId));
      if (!inquiry) throw new TRPCError({ code: "NOT_FOUND", message: "Inquiry not found" });
      if (!inquiry.lumaEventId) throw new TRPCError({ code: "BAD_REQUEST", message: "No Luma event to delete" });
      if (inquiry.quoteSentAt || inquiry.status === "booked") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "This booking page was already sent or booked. Use the customer cancellation workflow instead.",
        });
      }

      const apiKey = process.env.LUMA_API_KEY;
      if (!apiKey) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "LUMA_API_KEY not set" });

      const savedClasses = await db.select().from(privateEventClasses)
        .where(eq(privateEventClasses.inquiryId, inquiry.id));
      const eventIds = [inquiry.lumaEventId, ...savedClasses.map(eventClass => eventClass.lumaEventId)]
        .filter((eventId, index, all) => all.indexOf(eventId) === index);
      for (const eventId of eventIds) {
        const guestUrl = new URL(`${LUMA_BASE}/events/guests/list`);
        guestUrl.searchParams.set("event_id", eventId);
        guestUrl.searchParams.set("approval_status", "approved");
        guestUrl.searchParams.set("pagination_limit", "1");
        const guestRes = await fetch(guestUrl, { headers: { "x-luma-api-key": apiKey } });
        if (!guestRes.ok) {
          throw new TRPCError({ code: "BAD_GATEWAY", message: "Could not verify whether every class in this booking has guests." });
        }
        const guestData = await guestRes.json() as { entries?: unknown[] };
        if ((guestData.entries ?? []).length > 0) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "At least one class has a registered guest and cannot be removed from this control.",
          });
        }
      }
      for (const eventId of eventIds) {
        try {
          await cancelUnpublishedLumaEvent(apiKey, eventId);
        } catch (error) {
          throw new TRPCError({ code: "BAD_GATEWAY", message: "Luma could not cancel every class in this booking. No local booking record was removed." });
        }
      }

      // Clear the link from the inquiry and revert status
      await db
        .update(privateEventInquiries)
        .set({
          lumaEventUrl: null,
          lumaEventId: null,
          bookingLinkPublishedAt: null,
          status: "contacted",
        })
        .where(eq(privateEventInquiries.id, input.inquiryId));
      await db.delete(privateEventClasses).where(eq(privateEventClasses.inquiryId, inquiry.id));

      await db.insert(privateEventActions).values({
        inquiryId: inquiry.id,
        action: "unused_booking_page_cancelled",
        actorUserId: ctx.user.id,
        actorName: ctx.user.name,
        actorEmail: ctx.user.email,
        details: actionDetails({ eventCount: eventIds.length }),
      });

      return { success: true };
    }),

  /** Operations may generate a standalone private Luma booking link without an existing inquiry. */
  generateQuickBookingLink: staffProcedure
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
      if (input.sessionSchedule.length !== input.sessions) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Provide one time slot for each private-event session." });
      }
      const { basePriceCents, totalCents, hstCents } = calculatePrivateEventPrice(input.finalPrice, input.pricingType, input.sessions);
      const sessionPlan = buildPrivateEventSessionPlan({
        startTime: input.sessionSchedule[0].startTime,
        endTime: input.sessionSchedule[0].endTime,
        sessions: input.sessions,
      });

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
      if (sessionPlan.length > 1) {
        const scheduleLines = sessionPlan.map((s, i) =>
          `\n🐶 **Session ${i + 1}:** ${s.startTime} to ${s.endTime}`
        ).join("");
        fullDescription = `${descLines}\n\n---\n\n## 📅 Your Included Time Slots\n${scheduleLines}\n\nOne combined payment covers both sessions. There is a 30-minute break between them.`;
      }

      const createdClasses: Array<{ eventId: string; eventUrl: string; sessionNumber: number }> = [];
      try {
        for (const slot of sessionPlan) {
          const created = await createLumaEvent({
            name: sessionPlan.length > 1 ? `${orgName} — Private PuppyYoga (Session ${slot.sessionNumber} of ${sessionPlan.length})` : `${orgName} — Private PuppyYoga`,
            startAt: torontoDateTimeIso(input.eventDate, slot.startTime),
            endAt: torontoDateTimeIso(input.eventDate, slot.endTime),
            location: input.customLocation || input.location,
            maxCapacity: input.maxCapacity,
            description: fullDescription,
            ...(slot.paymentMode === "combined_checkout" ? { priceCents: basePriceCents } : {}),
            sessions: input.sessions,
          });
          createdClasses.push({ ...created, sessionNumber: slot.sessionNumber });
        }
      } catch (error) {
        await cancelPartialPrivateEventClasses(createdClasses);
        throw error;
      }
      const primary = createdClasses[0];

      // Notify owner
      await notifyOwner({
        title: "\u{1F517} Quick Booking Link Generated",
        content: `Event for ${orgName} on ${input.eventDate}\nCombined ${input.sessions}-session checkout: $${(basePriceCents / 100).toFixed(2)} + HST = $${(totalCents / 100).toFixed(2)} CAD\n${primary.eventUrl}`,
      });

      return {
        success: true,
        eventUrl: primary.eventUrl,
        eventId: primary.eventId,
        totalCents,
        hstCents,
        clientName: input.clientName,
        organization: input.organization,
      };
    }),
});
