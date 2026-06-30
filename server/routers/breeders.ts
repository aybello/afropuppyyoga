import { z } from "zod";
import { router, staffProcedure, publicProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { breeders, breederConfirmations, locationPresets, breederAvailabilityBlasts, breederAvailabilityResponses } from "../../drizzle/schema";
import type { Breeder } from "../../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";
import { sendEmail } from "../email";
import crypto from "crypto";

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
  city: z.string().min(1),
  date: z.string().min(1),
  location: z.string().min(1),
  apyTransport: z.boolean().default(false),
  dropOffTime: z.string().optional(),
  pickUpTime: z.string().optional(),
  pickupTime: z.string().optional(),
  returnTime: z.string().optional(),
  compensation: z.string().min(1),
});

const APY_LOGO = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663446228701/pFRlGBKuUoljEWjn.png";

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
    const transportLine = ev.apyTransport
      ? `<p style="margin:4px 0;"><strong>APY will provide transportation for this event.</strong></p>
         <p style="margin:4px 0;"><strong>Pickup Time:</strong> ${ev.pickupTime ?? ""}</p>
         <p style="margin:4px 0;"><strong>Return Time:</strong> ${ev.returnTime ?? ""}</p>`
      : `<p style="margin:4px 0;"><strong>Drop-off Time:</strong> ${ev.dropOffTime ?? ""}</p>
         <p style="margin:4px 0;"><strong>Pick-up Time:</strong> ${ev.pickUpTime ?? ""}</p>`;

    return `
      <div style="border:1px solid #e8c0d0;border-radius:10px;padding:18px 22px;margin:18px 0;background:#fff9fb;">
        <p style="margin:0 0 10px;font-size:16px;font-weight:700;color:#8B2252;">📍 ${ev.city}</p>
        <p style="margin:4px 0;"><strong>Date:</strong> ${formatDateHuman(ev.date)}</p>
        ${transportLine}
        <p style="margin:4px 0;"><strong>Location:</strong> ${ev.location}</p>
        <p style="margin:4px 0;"><strong>Compensation:</strong> ${ev.compensation} (paid via e-transfer)</p>
      </div>`;
  }).join("");

  const availabilitySection = opts.availabilityNote
    ? `<p style="margin:18px 0 0;line-height:1.6;">We also wanted to see if you may have availability for <strong>${opts.availabilityNote}</strong>. If so, we'd love to discuss potentially adding that date as well.</p>`
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
      <p style="margin:0 0 16px;font-size:16px;">Hi ${opts.breederFirstName},</p>
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
      <p style="margin:0 0 16px;line-height:1.6;">For any dates where APY is handling transportation, please provide the pickup address that works best for you.</p>
      ${availabilitySection}
      <p style="margin:24px 0 16px;line-height:1.6;">Please confirm that the above dates and times work for you, and we can finalize everything from there.</p>
      <p style="margin:0 0 4px;">Looking forward to working together.</p>
      <p style="margin:0 0 24px;">Best,</p>
      <div style="border-top:1px solid #f0d0dc;padding-top:20px;margin-top:8px;">
        <p style="margin:0;font-weight:700;color:#8B2252;font-size:15px;">The AfroPuppyYoga Team</p>
        <p style="margin:4px 0 0;font-size:13px;color:#5a3040;">P: 289-788-1885</p>
        <p style="margin:2px 0 0;font-size:13px;color:#5a3040;">E: <a href="mailto:afropuppyyogaofficial@gmail.com" style="color:#8B2252;">afropuppyyogaofficial@gmail.com</a></p>
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
    return `📍 ${ev.city}\nDate: ${formatDateHuman(ev.date)}\n${transport}\nLocation: ${ev.location}\nCompensation: ${ev.compensation} (paid via e-transfer)`;
  }).join("\n\n---\n\n");

  const text = `Hi ${opts.breederFirstName},\n\nWe're excited to be working with you and your puppies for our upcoming AfroPuppyYoga classes.\n\nAs discussed, here are the confirmed details:\n\n${textEvents}\n\nPlease ensure all puppies:\n- Are freshly groomed, clean, and smell pleasant\n- Are up to date on vaccinations\n- Have been dewormed\n\nOur team will supervise the puppies at all times and ensure they receive regular breaks, water, and a safe, controlled environment throughout the events.\n\nFor any dates where APY is handling transportation, please provide the pickup address that works best for you.\n\n${opts.availabilityNote ? `We also wanted to see if you may have availability for ${opts.availabilityNote}. If so, we'd love to discuss potentially adding that date as well.\n\n` : ""}Please confirm that the above dates and times work for you, and we can finalize everything from there.\n\nLooking forward to working together.\n\nBest,\nThe AfroPuppyYoga Team\nP: 289-788-1885\nE: afropuppyyogaofficial@gmail.com\nW: afropuppyyoga.ca`;

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
      const { html, text } = generateConfirmationEmail(input);
      return { html, text };
    }),

  sendConfirmation: staffProcedure
    .input(z.object({
      breederId: z.number(),
      breederFirstName: z.string().min(1),
      toEmail: z.string().email(),
      events: z.array(eventBlockSchema).min(1),
      availabilityNote: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { html, text } = generateConfirmationEmail({
        breederFirstName: input.breederFirstName,
        events: input.events,
        availabilityNote: input.availabilityNote,
      });

      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [breeder] = await db.select().from(breeders).where(eq(breeders.id, input.breederId));
      const breederName = breeder?.name ?? input.breederFirstName;

      await sendEmail({
        to: input.toEmail,
        subject: `AfroPuppyYoga - Booking Confirmation`,
        html,
        text,
      });

      await db.insert(breederConfirmations).values({
        breederId: input.breederId,
        breederName,
        sentToEmail: input.toEmail,
        events: JSON.stringify(input.events),
        availabilityNote: input.availabilityNote ?? null,
        emailBody: html,
        status: "sent",
      });

      return { success: true };
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
      const origin = input.origin ?? "https://afropuppyyoga.ca";
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
          <p style="color:#8B6070;font-size:12px;margin:0;">The AfroPuppyYoga Team &nbsp;|&nbsp; afropuppyyogaofficial@gmail.com &nbsp;|&nbsp; afropuppyyoga.ca</p>
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
            text: `Hi ${firstName},\n\nWe are planning our AfroPuppyYoga classes for ${input.monthLabel} and would love to know your availability!\n\n${input.customMessage ? input.customMessage + "\n\n" : ""}Please share your available dates using this link:\n${responseLink}\n\nThe AfroPuppyYoga Team\nP: 289-788-1885\nE: afropuppyyogaofficial@gmail.com`,
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

  /** Get all responses for a specific breeder across all blasts */
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
});
