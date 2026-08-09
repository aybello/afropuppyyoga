import { z } from "zod";
import { router, staffProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { breederLeads, breederLeadMessages, breederLeadActivities, breeders } from "../../drizzle/schema";
import { eq, desc, and, like, or, isNull } from "drizzle-orm";
import { searchKijiji, scrapeKijijiListing } from "../kijijiScraper";
import { qualifyBreederLead } from "../breederQualifier";
import { sendEmail } from "../email";
import Anthropic from "@anthropic-ai/sdk";

const now = () => Date.now();

async function sendTwilioSms(to: string, body: string): Promise<string | null> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const auth = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!sid || !auth || !from) throw new Error("Twilio not configured");
  const params = new URLSearchParams();
  params.append("To", to);
  params.append("From", from);
  params.append("Body", body);
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { "Authorization": "Basic " + Buffer.from(`${sid}:${auth}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const json = await res.json() as any;
  if (!res.ok) throw new Error(json.message ?? "SMS failed");
  return json.sid ?? null;
}

async function logActivity(db: any, leadId: number, activityType: string, description: string) {
  await db.insert(breederLeadActivities).values({ leadId, activityType, description, createdAt: now() });
}

export const breederLeadsRouter = router({
  list: staffProcedure
    .input(z.object({
      status: z.string().optional(),
      search: z.string().optional(),
      limit: z.number().default(50),
      offset: z.number().default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      let query = db.select().from(breederLeads).$dynamic();
      const conditions = [];
      if (input.status) conditions.push(eq(breederLeads.pipelineStatus, input.status));
      if (input.search) conditions.push(or(
        like(breederLeads.breed, `%${input.search}%`),
        like(breederLeads.sellerName, `%${input.search}%`),
        like(breederLeads.city, `%${input.search}%`),
      ));
      if (conditions.length > 0) query = query.where(and(...conditions));
      return query.orderBy(desc(breederLeads.createdAt)).limit(input.limit).offset(input.offset);
    }),

  stats: staffProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const all = await db.select().from(breederLeads);
    const total = all.length;
    const byStatus = (s: string) => all.filter(l => l.pipelineStatus === s).length;
    const booked = byStatus("booked");
    return {
      total,
      new: byStatus("new"),
      qualified: byStatus("qualified"),
      awaitingResponse: byStatus("contacted") + byStatus("replied"),
      interested: byStatus("interested"),
      booked,
      conversionRate: total > 0 ? Math.round((booked / total) * 100) : 0,
      followUpsDueToday: 0,
    };
  }),

  getById: staffProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [lead] = await db.select().from(breederLeads).where(eq(breederLeads.id, input.id));
      if (!lead) return null;
      const messages = await db.select().from(breederLeadMessages).where(eq(breederLeadMessages.leadId, input.id)).orderBy(desc(breederLeadMessages.sentAt));
      const activities = await db.select().from(breederLeadActivities).where(eq(breederLeadActivities.leadId, input.id)).orderBy(desc(breederLeadActivities.createdAt));
      return { lead, messages, activities };
    }),

  create: staffProcedure
    .input(z.object({
      breed: z.string().min(1),
      sellerName: z.string().optional(),
      phoneNumber: z.string().optional(),
      email: z.string().optional(),
      city: z.string().optional(),
      puppyCount: z.number().optional(),
      listingUrl: z.string().optional(),
      internalNotes: z.string().optional(),
      source: z.string().default("manual"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const ts = now();
      const [result] = await db.insert(breederLeads).values({
        ...input,
        pipelineStatus: "new",
        createdAt: ts,
        updatedAt: ts,
      });
      const id = (result as any).insertId;
      await logActivity(db, id, "created", `Lead created manually for ${input.breed}`);
      return { id };
    }),

  update: staffProcedure
    .input(z.object({
      id: z.number(),
      pipelineStatus: z.string().optional(),
      internalNotes: z.string().optional(),
      sellerName: z.string().optional(),
      phoneNumber: z.string().optional(),
      email: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { id, ...updates } = input;
      await db.update(breederLeads).set({ ...updates, updatedAt: now() }).where(eq(breederLeads.id, id));
      if (updates.pipelineStatus) {
        await logActivity(db, id, "status_change", `Status changed to ${updates.pipelineStatus}`);
      }
      return { success: true };
    }),

  delete: staffProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.delete(breederLeads).where(eq(breederLeads.id, input.id));
      return { success: true };
    }),

  searchKijiji: staffProcedure
    .input(z.object({ keyword: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const listings = await searchKijiji(input.keyword, 20);
      // Check which are already imported
      const existing = await db.select({ url: breederLeads.listingUrl }).from(breederLeads);
      const existingUrls = new Set(existing.map(e => e.url));
      return listings.map(l => ({ ...l, alreadyImported: existingUrls.has(l.url) }));
    }),

  importFromUrl: staffProcedure
    .input(z.object({ url: z.string().url() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      // Check duplicate
      const [existing] = await db.select().from(breederLeads).where(like(breederLeads.listingUrl, `%${input.url.slice(-40)}%`));
      if (existing) return { duplicate: true, id: existing.id, qualification: null };
      const listing = await scrapeKijijiListing(input.url);
      if (!listing) throw new Error("Could not extract listing data from this URL");
      const breed = listing.title.replace(/puppies?|pups?|for sale|available|\d+/gi, "").trim() || "Unknown";
      const qual = await qualifyBreederLead({
        breed,
        title: listing.title,
        description: listing.description,
        city: listing.location.city,
        province: listing.location.province,
        puppyCount: null,
        price: listing.price,
      });
      const ts = now();
      const [result] = await db.insert(breederLeads).values({
        breed: qual.extractedBreed ?? breed,
        city: qual.extractedCity ?? listing.location.city,
        province: listing.location.province,
        puppyCount: qual.extractedCount,
        listingPrice: listing.price,
        listingUrl: listing.url,
        listingTitle: listing.title,
        listingDescription: listing.description,
        listingImageUrls: JSON.stringify(listing.imageUrls),
        listingPostedAt: listing.postedAt,
        qualificationScore: qual.score,
        qualificationReasons: JSON.stringify(qual.reasons),
        disqualificationReasons: JSON.stringify(qual.warnings),
        source: "kijiji",
        pipelineStatus: qual.score >= 60 ? "qualified" : "new",
        createdAt: ts,
        updatedAt: ts,
      });
      const id = (result as any).insertId;
      await logActivity(db, id, "imported", `Imported from Kijiji — score ${qual.score}/100`);
      return { duplicate: false, id, qualification: qual };
    }),

  generateOutreach: staffProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [lead] = await db.select().from(breederLeads).where(eq(breederLeads.id, input.id));
      if (!lead) throw new Error("Lead not found");
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 512,
        messages: [{
          role: "user",
          content: `Write a short, friendly outreach SMS (under 160 chars) from AfroPuppyYoga to a ${lead.breed} breeder in ${lead.city ?? "Ontario"}. We want to borrow their puppies for yoga classes (1-2 hours, supervised, well-paid). Be warm, professional, brief. Sign off as "The AfroPuppyYoga Team". No emojis in SMS.`
        }]
      });
      const message = (response.content[0] as any).text ?? "";
      return { message };
    }),

  sendSms: staffProcedure
    .input(z.object({ id: z.number(), message: z.string().min(1), phone: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const smsSid = await sendTwilioSms(input.phone, input.message);
      const ts = now();
      await db.insert(breederLeadMessages).values({
        leadId: input.id, channel: "sms", direction: "outbound",
        body: input.message, smsSid: smsSid ?? undefined, sentAt: ts,
      });
      await db.update(breederLeads).set({ lastContactedAt: ts, pipelineStatus: "contacted", updatedAt: ts }).where(eq(breederLeads.id, input.id));
      await logActivity(db, input.id, "sms_sent", `SMS sent to ${input.phone}`);
      return { success: true };
    }),

  sendEmail: staffProcedure
    .input(z.object({ id: z.number(), to: z.string().email(), subject: z.string(), body: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await sendEmail({ to: input.to, subject: input.subject, html: `<pre style="font-family:sans-serif;white-space:pre-wrap">${input.body}</pre>` });
      const ts = now();
      await db.insert(breederLeadMessages).values({
        leadId: input.id, channel: "email", direction: "outbound",
        body: input.body, subject: input.subject, sentAt: ts,
      });
      await db.update(breederLeads).set({ lastContactedAt: ts, pipelineStatus: "contacted", updatedAt: ts }).where(eq(breederLeads.id, input.id));
      await logActivity(db, input.id, "email_sent", `Email sent to ${input.to}: ${input.subject}`);
      return { success: true };
    }),

  addNote: staffProcedure
    .input(z.object({ id: z.number(), note: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [lead] = await db.select().from(breederLeads).where(eq(breederLeads.id, input.id));
      if (!lead) throw new Error("Lead not found");
      const newNotes = lead.internalNotes ? `${lead.internalNotes}\n\n[${new Date().toLocaleDateString("en-CA")}] ${input.note}` : `[${new Date().toLocaleDateString("en-CA")}] ${input.note}`;
      await db.update(breederLeads).set({ internalNotes: newNotes, updatedAt: now() }).where(eq(breederLeads.id, input.id));
      await logActivity(db, input.id, "note_added", "Note added");
      return { success: true };
    }),

  convertToBreeder: staffProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [lead] = await db.select().from(breederLeads).where(eq(breederLeads.id, input.id));
      if (!lead) throw new Error("Lead not found");
      const ts = now();
      const [result] = await db.insert(breeders).values({
        name: lead.sellerName ?? lead.breed,
        contactName: lead.sellerName ?? undefined,
        phone: lead.phoneNumber ?? undefined,
        email: lead.email ?? undefined,
        breed: lead.breed,
        notes: lead.internalNotes ?? undefined,
        isActive: 1,
      });
      const breederId = (result as any).insertId;
      await db.update(breederLeads).set({ pipelineStatus: "booked", convertedBreederId: breederId, updatedAt: ts }).where(eq(breederLeads.id, input.id));
      await logActivity(db, input.id, "converted", `Converted to breeder ID ${breederId}`);
      return { breederId };
    }),
});
