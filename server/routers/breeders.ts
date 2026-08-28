import { z } from "zod";
import { router, staffProcedure, publicProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { breeders, breederConfirmations, communicationsLog, inboundSms, locationPresets, breederAvailabilityBlasts, breederAvailabilityResponses } from "../../drizzle/schema";
import { puppySchedule } from "../../drizzle/schema";
import type { Breeder } from "../../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";
import { sendEmail } from "../email";
import crypto from "crypto";
import { getTrustedAppOrigin } from "../_core/trustedOrigin";
import { cancelUnpublishedLumaEvent, createLumaEventForSchedule } from "../lumaScheduleHelper";
import { isSmsSuppressed } from "../smsConsent";
import { schedulesOverlap } from "../scheduleValidation";
import {
  breederConfirmationRequestKey,
  normalizeBreederPhone,
  planBreederConfirmationEvents,
  type PlannedBreederEvent,
} from "../breederConfirmationWorkflow";

const breederInput = z.object({
  name: z.string().min(1, "Breeder name is required"),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  instagram: z.string().optional(),
  breed: z.string().optional(),
  litterTimeline: z.string().optional(),
  typicalRate: z.string().optional(),
  transport: z.string().optional(),
  contractStatus: z.enum(["No contract yet", "Contract sent", "Contract completed"]).default("No contract yet"),
  notes: z.string().optional(),
  isActive: z.number().int().min(0).max(1).default(1),
});

const eventBlockSchema = z.object({
  city: z.string(),
  date: z.string().min(1),
  location: z.string().min(1),
  isPrivateEvent: z.boolean().default(false),
  apyTransport: z.boolean().default(false),
  dropOffTime: z.string().optional(),
  pickUpTime: z.string().optional(),
  pickupTime: z.string().optional(),
  returnTime: z.string().optional(),
  compensation: z.string().min(1),
}).superRefine((event, context) => {
  if (!event.isPrivateEvent && !event.city.trim()) {
    context.addIssue({ code: "custom", path: ["city"], message: "Choose an APY studio or mark this as a private event." });
  }
});

const APY_LOGO = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663446228701/pFRlGBKuUoljEWjn.png";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDateHuman(dateStr: string): string {
  if (!dateStr) return dateStr;
  // Handle ISO date format YYYY-MM-DD from date picker
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" });
  }
  return dateStr; // already formatted
}

function generateConfirmationEmail(opts: {
  breederFirstName: string;
  events: z.infer<typeof eventBlockSchema>[];
  availabilityNote?: string;
}): { html: string; text: string } {
  const eventBlocks = opts.events.map((ev) => {
    const cityLabel = escapeHtml(ev.city.trim() || "Private Event");
    const location = escapeHtml(ev.location);
    const compensation = escapeHtml(ev.compensation);
    const date = escapeHtml(formatDateHuman(ev.date));
    const pickupTime = escapeHtml(ev.pickupTime ?? "");
    const returnTime = escapeHtml(ev.returnTime ?? "");
    const dropOffTime = escapeHtml(ev.dropOffTime ?? "");
    const pickUpTime = escapeHtml(ev.pickUpTime ?? "");
    const transportLine = ev.apyTransport
      ? `<p style="margin:4px 0;"><strong>APY will provide transportation for this event.</strong></p>
         <p style="margin:4px 0;"><strong>Pickup Time:</strong> ${pickupTime}</p>
         <p style="margin:4px 0;"><strong>Return Time:</strong> ${returnTime}</p>`
      : `<p style="margin:4px 0;"><strong>Drop-off Time:</strong> ${dropOffTime}</p>
         <p style="margin:4px 0;"><strong>Pick-up Time:</strong> ${pickUpTime}</p>`;

    return `
      <div style="border:1px solid #e8c0d0;border-radius:10px;padding:18px 22px;margin:18px 0;background:#fff9fb;">
        <p style="margin:0 0 10px;font-size:16px;font-weight:700;color:#8B2252;">📍 ${cityLabel}</p>
        <p style="margin:4px 0;"><strong>Date:</strong> ${date}</p>
        ${transportLine}
        <p style="margin:4px 0;"><strong>Location:</strong> ${location}</p>
        <p style="margin:4px 0;"><strong>Compensation:</strong> ${compensation} (paid via e-transfer)</p>
      </div>`;
  }).join("");

  const availabilitySection = opts.availabilityNote
    ? `<p style="margin:18px 0 0;line-height:1.6;">We also wanted to see if you may have availability for <strong>${escapeHtml(opts.availabilityNote)}</strong>. If so, we'd love to discuss potentially adding that date as well.</p>`
    : "";

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#fefaf4;font-family:'Helvetica Neue',Arial,sans-serif;color:#1a0a12;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.07);">
    <div style="background:#8B2252;padding:28px 32px;text-align:center;">
      <img src="${APY_LOGO}" alt="AfroPuppyYoga" style="height:56px;border-radius:50%;object-fit:cover;" />
      <h1 style="color:#ffffff;font-size:22px;margin:12px 0 0;font-weight:700;letter-spacing:0.5px;">AfroPuppyYoga</h1>
      <p style="color:#f9c8de;font-size:13px;margin:4px 0 0;letter-spacing:1px;text-transform:uppercase;">Breeder Confirmation</p>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 16px;font-size:16px;">Hi ${escapeHtml(opts.breederFirstName)},</p>
      <p style="margin:0 0 20px;line-height:1.6;">We're excited to be working with you and your puppies for our upcoming AfroPuppyYoga classes.</p>
      <p style="margin:0 0 8px;font-weight:600;">As discussed, here are the confirmed details:</p>
      ${eventBlocks}
      <p style="margin:24px 0 8px;font-weight:600;">Please ensure all puppies:</p>
      <ul style="margin:0 0 16px;padding-left:20px;line-height:1.8;">
        <li>Are freshly groomed, clean, and smell pleasant</li>
        <li>Are up to date on vaccinations</li>
        <li>Have been dewormed</li>
      </ul>
      <p style="margin:0 0 16px;line-height:1.6;">Our team will supervise the puppies at all times and ensure they receive regular breaks, water, and a safe, controlled environment throughout the events.</p>
      ${opts.events.some(ev => ev.apyTransport) ? `<p style="margin:0 0 16px;line-height:1.6;">For any dates where APY is handling transportation, please provide the pickup address that works best for you.</p>` : ""}
      ${availabilitySection}
      <p style="margin:24px 0 16px;line-height:1.6;">Please confirm that the above dates and times work for you, and we can finalize everything from there.</p>
      <p style="margin:0 0 4px;">Looking forward to working together.</p>
      <p style="margin:0 0 24px;">Best,</p>
      <div style="border-top:1px solid #f0d0dc;padding-top:20px;margin-top:8px;">
        <p style="margin:0;font-weight:700;color:#8B2252;font-size:15px;">The AfroPuppyYoga Team</p>
        <p style="margin:4px 0 0;font-size:13px;color:#5a3040;">P: 289-788-1885</p>
        <p style="margin:2px 0 0;font-size:13px;color:#5a3040;">E: <a href="mailto:afropuppyyoga@gmail.com" style="color:#8B2252;">afropuppyyoga@gmail.com</a></p>
        <p style="margin:2px 0 0;font-size:13px;color:#5a3040;">W: <a href="https://afropuppyyoga.ca" style="color:#8B2252;">afropuppyyoga.ca</a></p>
      </div>
    </div>
  </div>
</body>
</html>`;

  const textEvents = opts.events.map((ev) => {
    const transport = ev.apyTransport
      ? `APY will provide transportation.\nPickup Time: ${ev.pickupTime ?? ""}\nReturn Time: ${ev.returnTime ?? ""}`
      : `Drop-off Time: ${ev.dropOffTime ?? ""}\nPick-up Time: ${ev.pickUpTime ?? ""}`;
    return `📍 ${ev.city.trim() || "Private Event"}\nDate: ${formatDateHuman(ev.date)}\n${transport}\nLocation: ${ev.location}\nCompensation: ${ev.compensation} (paid via e-transfer)`;
  }).join("\n\n---\n\n");

  const hasTransport = opts.events.some(ev => ev.apyTransport);
  const transportNote = hasTransport ? "For any dates where APY is handling transportation, please provide the pickup address that works best for you.\n\n" : "";
  const text = `Hi ${opts.breederFirstName},\n\nWe're excited to be working with you and your puppies for our upcoming AfroPuppyYoga classes.\n\nAs discussed, here are the confirmed details:\n\n${textEvents}\n\nPlease ensure all puppies:\n- Are freshly groomed, clean, and smell pleasant\n- Are up to date on vaccinations\n- Have been dewormed\n\nOur team will supervise the puppies at all times and ensure they receive regular breaks, water, and a safe, controlled environment throughout the events.\n\n${transportNote}${opts.availabilityNote ? `We also wanted to see if you may have availability for ${opts.availabilityNote}. If so, we'd love to discuss potentially adding that date as well.\n\n` : ""}Please confirm that the above dates and times work for you, and we can finalize everything from there.\n\nLooking forward to working together.\n\nBest,\nThe AfroPuppyYoga Team\nP: 289-788-1885\nE: afropuppyyoga@gmail.com\nW: afropuppyyoga.ca`;

  return { html, text };
}

export const breedersRouter = router({
  // ─── Breeder CRUD ─────────────────────────────────────────────────────────

  list: staffProcedure
    .input(
      z.object({
        search: z.string().optional(),
        contractStatus: z.enum(["No contract yet", "Contract sent", "Contract completed", "all"]).optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(breeders).orderBy(desc(breeders.createdAt));
      let filtered: Breeder[] = rows;
      if (input?.search) {
        const s = input.search.toLowerCase();
        filtered = filtered.filter((b: Breeder) =>
          b.name.toLowerCase().includes(s) ||
          (b.breed ?? "").toLowerCase().includes(s) ||
          (b.contactName ?? "").toLowerCase().includes(s) ||
          (b.email ?? "").toLowerCase().includes(s) ||
          (b.instagram ?? "").toLowerCase().includes(s)
        );
      }
      if (input?.contractStatus && input.contractStatus !== "all") {
        filtered = filtered.filter((b: Breeder) => b.contractStatus === input.contractStatus);
      }
      return filtered;
    }),

  get: staffProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [row] = await db.select().from(breeders).where(eq(breeders.id, input.id));
      return row ?? null;
    }),

  add: staffProcedure
    .input(breederInput)
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.insert(breeders).values({
        name: input.name,
        contactName: input.contactName ?? null,
        phone: input.phone ?? null,
        email: input.email || null,
        instagram: input.instagram ?? null,
        breed: input.breed ?? null,
        litterTimeline: input.litterTimeline ?? null,
        typicalRate: input.typicalRate ?? null,
        transport: input.transport ?? null,
        contractStatus: input.contractStatus,
        notes: input.notes ?? null,
        isActive: input.isActive,
      });
      return { success: true };
    }),

  update: staffProcedure
    .input(z.object({ id: z.number() }).merge(breederInput.partial()))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { id, ...data } = input;
      await db.update(breeders).set({ ...data, email: data.email || null }).where(eq(breeders.id, id));
      return { success: true };
    }),

  delete: staffProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(breeders).where(eq(breeders.id, input.id));
      return { success: true };
    }),

  bulkImport: staffProcedure
    .input(z.array(breederInput))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      if (input.length === 0) return { imported: 0 };
      await db.insert(breeders).values(
        input.map(b => ({
          name: b.name,
          contactName: b.contactName ?? null,
          phone: b.phone ?? null,
          email: b.email || null,
          instagram: b.instagram ?? null,
          breed: b.breed ?? null,
          litterTimeline: b.litterTimeline ?? null,
          typicalRate: b.typicalRate ?? null,
          transport: b.transport ?? null,
          contractStatus: b.contractStatus,
          notes: b.notes ?? null,
          isActive: b.isActive,
        }))
      );
      return { imported: input.length };
    }),

  // ─── Confirmations ────────────────────────────────────────────────────────

  previewConfirmation: staffProcedure
    .input(z.object({
      breederFirstName: z.string().min(1),
      events: z.array(eventBlockSchema).min(1),
      availabilityNote: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      planBreederConfirmationEvents(input.events);
      const { html, text } = generateConfirmationEmail(input);
      return { html, text };
    }),

  sendConfirmation: staffProcedure
    .input(z.object({
      breederId: z.number(),
      events: z.array(eventBlockSchema).min(1),
      availabilityNote: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [breeder] = await db.select().from(breeders).where(eq(breeders.id, input.breederId)).limit(1);
      if (!breeder) throw new Error("Breeder not found.");
      const toEmail = breeder.email?.trim() || null;
      const toPhone = normalizeBreederPhone(breeder.phone);
      if (!toEmail && !toPhone) {
        throw new Error("This breeder has no email or phone number on file. Please add contact info first.");
      }
      const breederName = breeder.name;
      const breederFirstName = (breeder.contactName?.trim() || breeder.name).split(/\s+/)[0];
      const { html, text } = generateConfirmationEmail({ breederFirstName, events: input.events, availabilityNote: input.availabilityNote });
      const requestKey = breederConfirmationRequestKey(input);
      const [prior] = await db.select().from(breederConfirmations).where(eq(breederConfirmations.requestKey, requestKey)).limit(1);
      if (prior?.status === "sent") {
        return {
          success: true,
          alreadySent: true,
          emailSent: Boolean(prior.sentToEmail),
          smsSent: Boolean(prior.sentToPhone),
          emailError: undefined,
          smsError: undefined,
          scheduleCreated: 0,
          customCommitmentsRecorded: input.events.filter(event => event.isPrivateEvent).length,
        };
      }
      if (prior?.status === "pending" && Date.now() - prior.createdAt.getTime() < 2 * 60 * 1000) {
        throw new Error("This confirmation is already being processed. Wait a moment before trying again.");
      }

      let confirmationId = prior?.id;
      let scheduleCreated = 0;
      let customCommitmentsRecorded = input.events.filter(event => event.isPrivateEvent).length;

      if (!prior) {
        // Validate every commitment and every collision before creating Luma
        // pages, schedule rows, or customer-facing messages.
        const plans = planBreederConfirmationEvents(input.events);
        const studioPlans = plans.filter((plan): plan is PlannedBreederEvent & { schedule: NonNullable<PlannedBreederEvent["schedule"]> } => plan.schedule !== null);
        customCommitmentsRecorded = plans.length - studioPlans.length;
        for (const plan of studioPlans) {
          const existing = await db.select({
            id: puppySchedule.id,
            classDate: puppySchedule.classDate,
            location: puppySchedule.location,
            startTime: puppySchedule.startTime,
            endTime: puppySchedule.endTime,
          }).from(puppySchedule).where(and(
            eq(puppySchedule.classDate, plan.schedule.classDate),
            eq(puppySchedule.location, plan.schedule.location),
            eq(puppySchedule.scheduleStatus, "scheduled"),
          ));
          const conflict = existing.find(entry => schedulesOverlap(entry, plan.schedule));
          if (conflict) {
            throw new Error(`Event ${plans.indexOf(plan) + 1} overlaps another ${plan.schedule.location} class on ${plan.schedule.classDate} (${conflict.startTime}–${conflict.endTime}).`);
          }
        }

        const provisioned: Array<{ plan: typeof studioPlans[number]; lumaEventId: string | null; lumaEventUrl: string | null }> = [];
        try {
          for (const plan of studioPlans) {
            const luma = await createLumaEventForSchedule({
              ...plan.schedule,
              breed: breeder.breed ?? "TBD",
            });
            if (plan.schedule.classType === "regular" && !luma) {
              throw new Error(`Luma did not create the ${plan.schedule.location} event on ${plan.schedule.classDate}. Nothing was confirmed or sent.`);
            }
            provisioned.push({
              plan,
              lumaEventId: luma?.lumaEventId ?? null,
              lumaEventUrl: luma?.lumaEventUrl ?? null,
            });
          }

          confirmationId = await db.transaction(async (tx) => {
            const [inserted] = await tx.insert(breederConfirmations).values({
              breederId: input.breederId,
              breederName,
              sentToEmail: toEmail ?? "",
              sentToPhone: toPhone,
              requestKey,
              events: JSON.stringify(input.events),
              availabilityNote: input.availabilityNote ?? null,
              emailBody: html,
              status: "pending",
            }).$returningId();
            if (!inserted?.id) throw new Error("Could not create the breeder confirmation record.");
            if (provisioned.length) {
              await tx.insert(puppySchedule).values(provisioned.map(({ plan, lumaEventId, lumaEventUrl }) => ({
                classDate: plan.schedule.classDate,
                dayOfWeek: plan.schedule.dayOfWeek,
                location: plan.schedule.location,
                breed: breeder.breed ?? "TBD",
                breederId: input.breederId,
                breederName,
                startTime: plan.schedule.startTime,
                endTime: plan.schedule.endTime,
                classType: plan.schedule.classType,
                notes: `Auto-created from breeder confirmation #${inserted.id}. Compensation: ${plan.event.compensation}`,
                lumaEventId,
                lumaEventUrl,
                lumaSyncStatus: plan.schedule.classType === "private" ? "not_required" as const : "synced" as const,
                lumaSyncedAt: lumaEventId ? new Date() : null,
              })));
            }
            return inserted.id;
          });
          scheduleCreated = provisioned.length;
        } catch (error) {
          await Promise.all(provisioned
            .filter(item => item.lumaEventId !== null)
            .map(item => cancelUnpublishedLumaEvent(item.lumaEventId!).catch(cleanupError => {
              console.error(`[Breeder Confirmation] Could not clean up Luma event ${item.lumaEventId}:`, cleanupError);
            })));
          throw error;
        }
      }

      if (!confirmationId) throw new Error("Could not resolve the breeder confirmation record.");

      let emailSent = false;
      let smsSent = false;
      let emailError: string | undefined;
      let smsError: string | undefined;
      let smsSid: string | undefined;

      if (toEmail) {
        try {
          await sendEmail({
            to: toEmail,
            subject: `AfroPuppyYoga - Booking Confirmation`,
            html,
            text,
          });
          emailSent = true;
        } catch (err: any) {
          emailError = err?.message ?? "Unknown email error";
          console.error("[Breeder Confirmation] Email failed:", emailError);
        }
      }

      if (toPhone) {
        try {
          const twilioSid = process.env.TWILIO_ACCOUNT_SID;
          const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
          const twilioFrom = process.env.TWILIO_PHONE_NUMBER;

          if (!twilioSid || !twilioAuth || !twilioFrom) throw new Error("Twilio not configured");

          if (await isSmsSuppressed(toPhone)) throw new Error("Recipient has opted out of APY text messages");

          // Build condensed SMS — one line per event
          const eventLines = input.events.map((ev) => {
            const date = formatDateHuman(ev.date);
            const time = ev.apyTransport
              ? `Pickup ${ev.pickupTime ?? ""}, Return ${ev.returnTime ?? ""}`
              : `Drop-off ${ev.dropOffTime ?? ""}, Pick-up ${ev.pickUpTime ?? ""}`;
            return `📍 ${ev.city} — ${date}\n${time}\n${ev.location}\nCompensation: ${ev.compensation}`;
          }).join("\n\n");

          const smsBody = `Hi ${breederFirstName}, you're confirmed for AfroPuppyYoga! 🐾\n\n${eventLines}\n\nPlease ensure puppies are groomed, vaccinated & dewormed. Reply to confirm or call 289-788-1885.`;

          const params = new URLSearchParams();
          params.append("To", toPhone);
          params.append("From", twilioFrom);
          params.append("Body", smsBody);

          const resp = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
            {
              method: "POST",
              headers: {
                Authorization: "Basic " + Buffer.from(`${twilioSid}:${twilioAuth}`).toString("base64"),
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: params.toString(),
            }
          );
          const data = await resp.json() as { sid?: string; message?: string };
          if (!data.sid) throw new Error(data.message ?? "Twilio error");
          smsSid = data.sid;
          smsSent = true;
        } catch (err: any) {
          smsError = err?.message ?? "Unknown SMS error";
          console.error("[Breeder Confirmation] SMS failed:", smsError);
        }
      }

      const status = emailSent || smsSent ? "sent" as const : "failed" as const;
      await db.update(breederConfirmations).set({
        status,
        sentToEmail: toEmail ?? "",
        sentToPhone: toPhone,
      }).where(eq(breederConfirmations.id, confirmationId));

      const communicationRows: Array<typeof communicationsLog.$inferInsert> = [];
      if (toEmail) communicationRows.push({
        entityType: "breeder" as const,
        entityId: input.breederId,
        channel: "email" as const,
        direction: "outbound" as const,
        action: "booking_confirmation",
        recipient: toEmail,
        subject: "AfroPuppyYoga - Booking Confirmation",
        bodyPreview: text.slice(0, 1000),
        deliveryStatus: emailSent ? "sent" : "failed",
        actorUserId: ctx.user.id,
        actorName: ctx.user.name,
      });
      if (toPhone) communicationRows.push({
        entityType: "breeder" as const,
        entityId: input.breederId,
        channel: "sms" as const,
        direction: "outbound" as const,
        action: "booking_confirmation",
        recipient: toPhone,
        subject: null,
        bodyPreview: `Breeder booking confirmation for ${input.events.length} event(s)`,
        deliveryStatus: smsSent ? "sent" : "failed",
        providerMessageId: smsSid ?? null,
        actorUserId: ctx.user.id,
        actorName: ctx.user.name,
      });
      try {
        if (communicationRows.length) await db.insert(communicationsLog).values(communicationRows);
      } catch (error) {
        console.error(`[Breeder Confirmation] Failed to record communications for breeder ${input.breederId}:`, error);
      }

      return {
        success: true,
        alreadySent: false,
        emailSent,
        smsSent,
        emailError,
        smsError,
        scheduleCreated,
        customCommitmentsRecorded,
      };
    }),

  getConfirmations: staffProcedure
    .input(z.object({ breederId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(breederConfirmations)
        .where(eq(breederConfirmations.breederId, input.breederId))
        .orderBy(desc(breederConfirmations.createdAt));
    }),

  getCommunications: staffProcedure
    .input(z.object({ breederId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const [outbound, inbound] = await Promise.all([
        db.select().from(communicationsLog).where(and(
          eq(communicationsLog.entityType, "breeder"),
          eq(communicationsLog.entityId, input.breederId),
        )).orderBy(desc(communicationsLog.createdAt)),
        db.select().from(inboundSms).where(eq(inboundSms.breederId, input.breederId)).orderBy(desc(inboundSms.createdAt)),
      ]);
      return [
        ...outbound.map(item => ({
          id: `communication-${item.id}`,
          channel: item.channel,
          direction: item.direction,
          action: item.action,
          recipient: item.recipient,
          bodyPreview: item.bodyPreview,
          deliveryStatus: item.deliveryStatus,
          actorName: item.actorName,
          createdAt: item.createdAt,
        })),
        ...inbound.map(item => ({
          id: `inbound-${item.id}`,
          channel: "sms" as const,
          direction: "inbound" as const,
          action: "breeder_reply",
          recipient: item.fromPhone,
          bodyPreview: item.body,
          deliveryStatus: "received",
          actorName: item.breederName,
          createdAt: item.createdAt,
        })),
      ].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
    }),

  // ─── Location Presets ─────────────────────────────────────────────────────

  listPresets: staffProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(locationPresets).orderBy(locationPresets.label);
    }),

  addPreset: staffProcedure
    .input(z.object({
      label: z.string().min(1),
      city: z.string().min(1),
      address: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.insert(locationPresets).values(input);
      return { success: true };
    }),

  deletePreset: staffProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(locationPresets).where(eq(locationPresets.id, input.id));
      return { success: true };
    }),

  // ─── Availability Blasts ───────────────────────────────────────────────────

  /**
   * Send a monthly availability blast to all active breeders with an email.
   * Creates one blast record + one response record per breeder (with unique token).
   */
  sendAvailabilityBlast: staffProcedure
    .input(z.object({
      monthLabel: z.string().min(1),  // e.g. "July 2026"
      monthKey: z.string().min(1),    // e.g. "2026-07"
      customMessage: z.string().optional(),
      origin: z.string().optional(),  // frontend origin for building the response link
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Get all active breeders with an email address
      const activeBreeders = await db
        .select()
        .from(breeders)
        .where(and(eq(breeders.isActive, 1)));

      const emailableBreeders = activeBreeders.filter(b => b.email && b.email.trim() !== "");

      if (emailableBreeders.length === 0) {
        throw new Error("No active breeders with email addresses found");
      }

      // Create the blast record
      const [blast] = await db
        .insert(breederAvailabilityBlasts)
        .values({
          monthLabel: input.monthLabel,
          monthKey: input.monthKey,
          emailedCount: emailableBreeders.length,
          customMessage: input.customMessage ?? null,
        })
        .$returningId();

      const blastId = blast.id;
      const origin = getTrustedAppOrigin(input.origin);
      let sent = 0;
      let failed = 0;

      for (const breeder of emailableBreeders) {
        const token = crypto.randomBytes(32).toString("hex");
        const firstName = (breeder.contactName ?? breeder.name).split(" ")[0];
        const responseLink = `${origin}/breeder-availability?token=${token}`;

        // Insert response row
        await db.insert(breederAvailabilityResponses).values({
          blastId,
          breederId: breeder.id,
          breederName: breeder.contactName ?? breeder.name,
          breederEmail: breeder.email!,
          token,
          responded: 0,
        });

        const customSection = input.customMessage
          ? `<p style="margin:16px 0;line-height:1.6;color:#3D1A2A;">${input.customMessage}</p>`
          : "";

        const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FFF5F8;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFF5F8;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(194,24,91,0.08);">
        <tr><td style="background:linear-gradient(135deg,#C2185B,#8B2252);padding:32px 40px;text-align:center;">
          <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663446228701/pFRlGBKuUoljEWjn.png" alt="AfroPuppyYoga" width="64" style="border-radius:50%;margin-bottom:12px;display:block;margin-left:auto;margin-right:auto;" />
          <h1 style="color:#FFFFFF;font-family:Georgia,serif;font-size:22px;margin:0;">Availability Check</h1>
          <p style="color:rgba(255,255,255,0.85);font-size:14px;margin:6px 0 0;">${input.monthLabel}</p>
        </td></tr>
        <tr><td style="padding:36px 40px;">
          <p style="color:#1A0A12;font-size:16px;line-height:1.7;margin:0 0 16px;">Hi ${firstName},</p>
          <p style="color:#3D1A2A;font-size:15px;line-height:1.7;margin:0 0 16px;">We are planning our AfroPuppyYoga classes for <strong>${input.monthLabel}</strong> and would love to know your availability!</p>
          ${customSection}
          <p style="color:#3D1A2A;font-size:15px;line-height:1.7;margin:0 0 24px;">Please click the button below to let us know which dates and times work best for you and your puppies.</p>
          <div style="text-align:center;margin:28px 0;">
            <a href="${responseLink}" style="display:inline-block;background:#C2185B;color:#FFFFFF;text-decoration:none;font-family:Georgia,serif;font-size:16px;font-weight:bold;padding:14px 36px;border-radius:50px;">Share My Availability</a>
          </div>
          <p style="color:#8B6070;font-size:13px;line-height:1.6;margin:0;">This link is unique to you. If you have any questions, reply to this email or reach us at <a href="tel:289-788-1885" style="color:#C2185B;">289-788-1885</a>.</p>
        </td></tr>
        <tr><td style="background:#FFF5F8;padding:20px 40px;text-align:center;border-top:1px solid #F0D0DC;">
          <p style="color:#8B6070;font-size:12px;margin:0;">The AfroPuppyYoga Team &nbsp;|&nbsp; afropuppyyoga@gmail.com &nbsp;|&nbsp; afropuppyyoga.ca</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

        try {
          await sendEmail({
            to: breeder.email!,
            subject: `AfroPuppyYoga - Availability Check for ${input.monthLabel}`,
            html,
            text: `Hi ${firstName},\n\nWe are planning our AfroPuppyYoga classes for ${input.monthLabel} and would love to know your availability!\n\n${input.customMessage ? input.customMessage + "\n\n" : ""}Please share your available dates using this link:\n${responseLink}\n\nThe AfroPuppyYoga Team\nP: 289-788-1885\nE: afropuppyyoga@gmail.com`,
          });
          sent++;
        } catch {
          failed++;
        }
      }

      return { success: true, sent, failed, blastId };
    }),

  /** List all blasts with response counts */
  listBlasts: staffProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(breederAvailabilityBlasts)
        .orderBy(desc(breederAvailabilityBlasts.createdAt));
    }),

  /** Get all responses for a specific blast */
  getBlastResponses: staffProcedure
    .input(z.object({ blastId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(breederAvailabilityResponses)
        .where(eq(breederAvailabilityResponses.blastId, input.blastId))
        .orderBy(desc(breederAvailabilityResponses.responded), breederAvailabilityResponses.breederName);
    }),

  /** Public: validate a token and return the blast/breeder info for the response form */
  getAvailabilityToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db
        .select()
        .from(breederAvailabilityResponses)
        .where(eq(breederAvailabilityResponses.token, input.token))
        .limit(1);
      if (rows.length === 0) return null;
      const row = rows[0];
      // Also fetch the blast to get the monthLabel
      const blastRows = await db
        .select()
        .from(breederAvailabilityBlasts)
        .where(eq(breederAvailabilityBlasts.id, row.blastId))
        .limit(1);
      return {
        ...row,
        monthLabel: blastRows[0]?.monthLabel ?? "",
        monthKey: blastRows[0]?.monthKey ?? "",
      };
    }),

  /** Public: submit availability response via token */
  submitAvailability: publicProcedure
    .input(z.object({
      token: z.string(),
      availabilityText: z.string().min(1, "Please describe your availability"),
      responseNotes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const rows = await db
        .select()
        .from(breederAvailabilityResponses)
        .where(eq(breederAvailabilityResponses.token, input.token))
        .limit(1);
      if (rows.length === 0) throw new Error("Invalid or expired link");
      const row = rows[0];
      await db
        .update(breederAvailabilityResponses)
        .set({
          responded: 1,
          availabilityText: input.availabilityText,
          responseNotes: input.responseNotes ?? null,
          respondedAt: new Date(),
        })
        .where(eq(breederAvailabilityResponses.token, input.token));
      return { success: true, breederName: row.breederName };
    }),

  /** Send a one-off availability request to a single breeder */
  sendAvailabilityRequest: staffProcedure
    .input(z.object({
      breederId: z.number(),
      monthLabel: z.string().min(1),
      monthKey: z.string().min(1),
      customMessage: z.string().optional(),
      origin: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const breederRows = await db.select().from(breeders).where(eq(breeders.id, input.breederId)).limit(1);
      if (breederRows.length === 0) throw new Error("Breeder not found");
      const breeder = breederRows[0];
      if (!breeder.email?.trim()) throw new Error("This breeder has no email address on file. Please add their email first.");
      // Reuse or create a blast record for this month
      let blastId: number;
      const existingBlast = await db
        .select()
        .from(breederAvailabilityBlasts)
        .where(eq(breederAvailabilityBlasts.monthKey, input.monthKey))
        .limit(1);
      if (existingBlast.length > 0) {
        blastId = existingBlast[0].id;
      } else {
        const [blast] = await db
          .insert(breederAvailabilityBlasts)
          .values({ monthLabel: input.monthLabel, monthKey: input.monthKey, emailedCount: 1, customMessage: input.customMessage ?? null })
          .$returningId();
        blastId = blast.id;
      }
      const token = crypto.randomBytes(32).toString("hex");
      const firstName = (breeder.contactName ?? breeder.name).split(" ")[0];
      const origin = getTrustedAppOrigin(input.origin);
      const responseLink = `${origin}/breeder-availability?token=${token}`;
      await db.insert(breederAvailabilityResponses).values({
        blastId,
        breederId: breeder.id,
        breederName: breeder.contactName ?? breeder.name,
        breederEmail: breeder.email!,
        token,
        responded: 0,
      });
      const customSection = input.customMessage
        ? `<p style="margin:16px 0;line-height:1.6;color:#3D1A2A;">${input.customMessage}</p>`
        : "";
      const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FFF5F8;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFF5F8;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(194,24,91,0.08);">
        <tr><td style="background:linear-gradient(135deg,#C2185B,#8B2252);padding:32px 40px;text-align:center;">
          <img src="${APY_LOGO}" alt="AfroPuppyYoga" width="64" style="border-radius:50%;margin-bottom:12px;display:block;margin-left:auto;margin-right:auto;" />
          <h1 style="color:#FFFFFF;font-family:Georgia,serif;font-size:22px;margin:0;">Availability Check</h1>
          <p style="color:rgba(255,255,255,0.85);font-size:14px;margin:6px 0 0;">${input.monthLabel}</p>
        </td></tr>
        <tr><td style="padding:36px 40px;">
          <p style="color:#1A0A12;font-size:16px;line-height:1.7;margin:0 0 16px;">Hi ${firstName},</p>
          <p style="color:#3D1A2A;font-size:15px;line-height:1.7;margin:0 0 16px;">We are planning our AfroPuppyYoga classes for <strong>${input.monthLabel}</strong> and would love to know your availability!</p>
          ${customSection}
          <p style="color:#3D1A2A;font-size:15px;line-height:1.7;margin:0 0 24px;">Please click the button below to let us know which dates and times work best for you and your puppies.</p>
          <div style="text-align:center;margin:28px 0;">
            <a href="${responseLink}" style="display:inline-block;background:#C2185B;color:#FFFFFF;text-decoration:none;font-family:Georgia,serif;font-size:16px;font-weight:bold;padding:14px 36px;border-radius:50px;">Share My Availability</a>
          </div>
          <p style="color:#8B6070;font-size:13px;line-height:1.6;margin:0;">This link is unique to you. If you have any questions, reply to this email or reach us at <a href="tel:289-788-1885" style="color:#C2185B;">289-788-1885</a>.</p>
        </td></tr>
        <tr><td style="background:#FFF5F8;padding:20px 40px;text-align:center;border-top:1px solid #F0D0DC;">
          <p style="color:#8B6070;font-size:12px;margin:0;">The AfroPuppyYoga Team &nbsp;|&nbsp; afropuppyyoga@gmail.com &nbsp;|&nbsp; afropuppyyoga.ca</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
      await sendEmail({ to: breeder.email!, subject: `AfroPuppyYoga — Availability Check for ${input.monthLabel}`, html });
      return { success: true };
    }),

  /** Get all availability responses for a specific breeder */
  getBreederResponses: staffProcedure
    .input(z.object({ breederId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(breederAvailabilityResponses)
        .where(eq(breederAvailabilityResponses.breederId, input.breederId))
        .orderBy(desc(breederAvailabilityResponses.createdAt));
    }),
});
