import { z } from "zod";
import { router, staffProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { breeders, breederConfirmations, locationPresets } from "../../drizzle/schema";
import type { Breeder } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { sendEmail } from "../email";

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
});
