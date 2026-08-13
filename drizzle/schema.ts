import { bigint, boolean, index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "staff"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// TODO: Add your tables here

export const invoices = mysqlTable("invoices", {
  id: int("id").autoincrement().primaryKey(),
  /** Staff member's name extracted from the invoice */
  staffName: varchar("staffName", { length: 255 }),
  /** Position/role extracted from the invoice */
  position: varchar("position", { length: 255 }),
  /** Pay amount extracted from the invoice (stored as string to preserve currency formatting) */
  payAmount: varchar("payAmount", { length: 100 }),
  /** Due date extracted from the invoice */
  dueDate: timestamp("dueDate"),
  /** S3 URL of the uploaded PDF */
  fileUrl: text("fileUrl").notNull(),
  /** S3 key of the uploaded PDF */
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  /** Original filename */
  originalFilename: varchar("originalFilename", { length: 255 }),
  /** Amount paid so far (in cents, to avoid floating point issues) */
  amountPaidCents: int("amountPaidCents").default(0).notNull(),
  /** Payment notes (e.g. "half payment on May 1") */
  paymentNotes: text("paymentNotes"),
  /** Payment status */
  status: mysqlEnum("status", ["pending", "partial", "paid", "overdue"]).default("pending").notNull(),
  /** Whether AI extraction has been completed */
  extractionStatus: mysqlEnum("extractionStatus", ["pending", "completed", "failed"]).default("pending").notNull(),
  /** Raw extracted text for debugging */
  extractedData: text("extractedData"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [index("idx_invoices_status").on(t.status)]);

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;

export const jobApplications = mysqlTable("jobApplications", {
  id: int("id").autoincrement().primaryKey(),
  /** Role they're applying for */
  role: varchar("role", { length: 255 }).notNull(),
  /** Location (KW, Hamilton, BDR) */
  location: varchar("location", { length: 100 }).notNull(),
  /** Applicant's full name */
  name: varchar("name", { length: 255 }).notNull(),
  /** Applicant's email */
  email: varchar("email", { length: 320 }).notNull(),
  /** Applicant's phone number */
  phone: varchar("phone", { length: 50 }),
  /** Why they want to work at APY */
  whyAPY: text("whyAPY"),
  /** Relevant experience */
  experience: text("experience"),
  /** S3 URL of the uploaded video */
  videoUrl: text("videoUrl"),
  /** S3 key of the uploaded video */
  videoKey: varchar("videoKey", { length: 500 }),
  /** S3 URL of the uploaded resume */
  resumeUrl: text("resumeUrl"),
  /** S3 key of the uploaded resume */
  resumeKey: varchar("resumeKey", { length: 500 }),
  /** Application status */
  status: mysqlEnum("appStatus", ["new", "reviewed", "shortlisted", "interview_scheduled", "accepted", "rejected", "onboarded"]).default("new").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  /** Soft-delete timestamp — null means active, non-null means archived */
  deletedAt: timestamp("deletedAt"),
}, (t) => [index("idx_jobapps_status").on(t.status), index("idx_jobapps_email").on(t.email)]);

export type JobApplication = typeof jobApplications.$inferSelect;
export type InsertJobApplication = typeof jobApplications.$inferInsert;

export const birthdayInquiries = mysqlTable("birthdayInquiries", {
  id: int("id").autoincrement().primaryKey(),
  /** Name of the person booking */
  name: varchar("name", { length: 255 }).notNull(),
  /** Contact email */
  email: varchar("email", { length: 320 }).notNull(),
  /** Contact phone number */
  phone: varchar("phone", { length: 50 }),
  /** Preferred date for the birthday session */
  preferredDate: varchar("preferredDate", { length: 100 }).notNull(),
  /** Location: KW or Hamilton */
  location: mysqlEnum("location", ["KW", "Hamilton"]).notNull(),
  /** Package tier selected */
  tier: mysqlEnum("tier", ["Basic", "Premium", "Deluxe"]).notNull(),
  /** Estimated group size */
  groupSize: int("groupSize").notNull(),
  /** Additional message or requests */
  message: text("message"),
  /** Inquiry status */
  status: mysqlEnum("inquiryStatus", ["new", "contacted", "confirmed", "cancelled"]).default("new").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [index("idx_birthday_status").on(t.status)]);

export type BirthdayInquiry = typeof birthdayInquiries.$inferSelect;
export type InsertBirthdayInquiry = typeof birthdayInquiries.$inferInsert;

export const partnershipInquiries = mysqlTable("partnershipInquiries", {
  id: int("id").autoincrement().primaryKey(),
  /** Partnership type */
  partnershipType: mysqlEnum("partnershipType", [
    "Corporate Wellness",
    "Brand Collaboration",
    "Media & Production",
    "Local Business",
    "Breeder Partnership",
  ]).notNull(),
  /** Organization or brand name */
  organizationName: varchar("organizationName", { length: 255 }).notNull(),
  /** Contact person's name */
  contactName: varchar("contactName", { length: 255 }).notNull(),
  /** Contact email */
  email: varchar("email", { length: 320 }).notNull(),
  /** Contact phone number */
  phone: varchar("phone", { length: 50 }),
  /** Website or social media URL */
  website: varchar("website", { length: 500 }),
  /** Description of the proposed partnership */
  proposal: text("proposal").notNull(),
  /** Inquiry status */
  status: mysqlEnum("partnerStatus", ["new", "reviewing", "active", "declined"]).default("new").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [index("idx_partnership_status").on(t.status)]);

export type PartnershipInquiry = typeof partnershipInquiries.$inferSelect;
export type InsertPartnershipInquiry = typeof partnershipInquiries.$inferInsert;

export const staffInvites = mysqlTable("staffInvites", {
  id: int("id").autoincrement().primaryKey(),
  /** Staff member's name */
  name: varchar("name", { length: 255 }).notNull(),
  /** Staff member's email address */
  email: varchar("email", { length: 320 }).notNull(),
  /** Secure random token for the magic link */
  token: varchar("token", { length: 128 }).notNull().unique(),
  /** Whether this invite has been used to log in (still valid for re-login until expiry) */
  isActive: int("isActive").default(1).notNull(),
  /** Token expiry — magic links expire after 48 hours of first use, but staff stay active */
  expiresAt: timestamp("expiresAt").notNull(),
  /** When the invite was first used */
  firstUsedAt: timestamp("firstUsedAt"),
  /** Last login via this token */
  lastUsedAt: timestamp("lastUsedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [index("idx_staff_isActive").on(t.isActive), index("idx_staff_email").on(t.email)]);

export type StaffInvite = typeof staffInvites.$inferSelect;
export type InsertStaffInvite = typeof staffInvites.$inferInsert;

export const signingTokens = mysqlTable("signingTokens", {
  id: int("id").autoincrement().primaryKey(),
  /** The job application this signing request is for */
  applicationId: int("applicationId").notNull(),
  /** Applicant's name */
  applicantName: varchar("applicantName", { length: 255 }).notNull(),
  /** Applicant's email */
  applicantEmail: varchar("applicantEmail", { length: 320 }).notNull(),
  /** Role (Puppy Monitor / Yoga Instructor) */
  role: varchar("role", { length: 255 }).notNull(),
  /** Location (KW / Hamilton / BDR) */
  location: varchar("location", { length: 100 }).notNull(),
  /** Which offer letter to show (puppy_monitor_kw | puppy_monitor_hamilton | yoga_instructor | puppy_specialist) */
  offerLetterType: mysqlEnum("offerLetterType", ["puppy_monitor_kw", "puppy_monitor_hamilton", "yoga_instructor", "puppy_specialist"]).notNull(),
  /** Secure random token sent in the signing link */
  token: varchar("token", { length: 128 }).notNull().unique(),
  /** Whether the applicant has signed */
  signed: int("signed").default(0).notNull(),
  /** Typed name used as digital signature */
  signedName: varchar("signedName", { length: 255 }),
  /** IP address at time of signing */
  signedIp: varchar("signedIp", { length: 64 }),
  /** When they signed */
  signedAt: timestamp("signedAt"),
  /** Token expiry (7 days) */
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SigningToken = typeof signingTokens.$inferSelect;
export type InsertSigningToken = typeof signingTokens.$inferInsert;
export const privateEventInquiries = mysqlTable("privateEventInquiries", {
  id: int("id").autoincrement().primaryKey(),
  /** Name of the person booking */
  name: varchar("name", { length: 255 }).notNull(),
  /** Contact email */
  email: varchar("email", { length: 320 }).notNull(),
  /** Contact phone number */
  phone: varchar("phone", { length: 50 }),
  /** Type of event (Birthday, Bachelorette, etc.) */
  eventType: varchar("eventType", { length: 100 }).notNull(),
  /** Number of guests */
  guests: int("guests").notNull(),
  /** Location label */
  location: varchar("location", { length: 255 }).notNull(),
  /** Package type: classic, signature, luxury */
  packageType: varchar("packageType", { length: 50 }).notNull(),
  /** Preferred date string */
  preferredDate: varchar("preferredDate", { length: 100 }),
  /** Additional notes */
  notes: text("notes"),
  /** Estimated minimum price */
  estimatedMin: int("estimatedMin").notNull(),
  /** Estimated maximum price */
  estimatedMax: int("estimatedMax").notNull(),
  /** Inquiry status */
  status: mysqlEnum("peStatus", ["new", "contacted", "confirmed", "cancelled", "quote_sent", "booked"]).default("new").notNull(),
  /** Internal notes from admin */
  adminNotes: text("adminNotes"),
  /** Final approved price in cents (CAD) */
  finalPriceCents: int("finalPriceCents"),
  /** HST amount in cents */
  hstCents: int("hstCents"),
  /** Whether price is plus HST or all-inclusive */
  pricingType: varchar("pricingType", { length: 20 }),
  /** Number of sessions */
  sessions: int("sessions").default(1),
  /** Puppy breed request */
  puppyBreed: varchar("puppyBreed", { length: 100 }),
  /** Organization name (for corporate events) */
  organization: varchar("organization", { length: 255 }),
  /** Final venue selected while preparing the payment-ready offer */
  eventVenue: varchar("eventVenue", { length: 255 }),
  /** Final event start time in local Toronto HH:mm format */
  eventStartTime: varchar("eventStartTime", { length: 5 }),
  /** Final event end time in local Toronto HH:mm format */
  eventEndTime: varchar("eventEndTime", { length: 5 }),
  /** Generated Luma event URL */
  lumaEventUrl: varchar("lumaEventUrl", { length: 500 }),
  /** Luma event ID */
  lumaEventId: varchar("lumaEventId", { length: 100 }),
  /** Exact client-facing quote response, stored for preview and audit */
  quoteEmailSubject: varchar("quoteEmailSubject", { length: 500 }),
  quoteEmailBody: text("quoteEmailBody"),
  /** Whether owner approval was required and given */
  ownerApproved: boolean("ownerApproved"),
  /** Quote email sent timestamp */
  quoteSentAt: timestamp("quoteSentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [index("idx_pe_status").on(t.status)]);

export type PrivateEventInquiry = typeof privateEventInquiries.$inferSelect;
export type InsertPrivateEventInquiry = typeof privateEventInquiries.$inferInsert;

export const breeders = mysqlTable("breeders", {
  id: int("id").autoincrement().primaryKey(),
  /** Breeder / kennel name */
  name: varchar("name", { length: 255 }).notNull(),
  /** Contact person name */
  contactName: varchar("contactName", { length: 255 }),
  /** Phone number(s) */
  phone: varchar("phone", { length: 255 }),
  /** Email address */
  email: varchar("email", { length: 320 }),
  /** Instagram handle */
  instagram: varchar("instagram", { length: 255 }),
  /** Breed(s) they supply */
  breed: varchar("breed", { length: 255 }),
  /** Litter timeline / availability notes */
  litterTimeline: varchar("litterTimeline", { length: 255 }),
  /** Typical rate (stored as string to handle ranges like '$500-550') */
  typicalRate: varchar("typicalRate", { length: 100 }),
  /** Transport arrangement */
  transport: varchar("transport", { length: 255 }),
  /** Contract status */
  contractStatus: mysqlEnum("contractStatus", ["No contract yet", "Contract sent", "Contract completed"]).default("No contract yet").notNull(),
  /** Internal notes */
  notes: text("notes"),
  /** Whether this breeder is currently active */
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [index("idx_breeders_contractStatus").on(t.contractStatus), index("idx_breeders_isActive").on(t.isActive)]);

export type Breeder = typeof breeders.$inferSelect;
export type InsertBreeder = typeof breeders.$inferInsert;

export const locationPresets = mysqlTable("locationPresets", {
  id: int("id").autoincrement().primaryKey(),
  /** Display label e.g. "TenC Dance Studio - Kitchener" */
  label: varchar("label", { length: 255 }).notNull(),
  /** City name */
  city: varchar("city", { length: 100 }).notNull(),
  /** Full address */
  address: text("address").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LocationPreset = typeof locationPresets.$inferSelect;
export type InsertLocationPreset = typeof locationPresets.$inferInsert;

export const breederConfirmations = mysqlTable("breederConfirmations", {
  id: int("id").autoincrement().primaryKey(),
  /** The breeder this confirmation was sent to */
  breederId: int("breederId").notNull(),
  /** Breeder name snapshot at time of sending */
  breederName: varchar("breederName", { length: 255 }).notNull(),
  /** Email address it was sent to */
  sentToEmail: varchar("sentToEmail", { length: 320 }).notNull(),
  /** JSON array of event blocks */
  events: text("events").notNull(),
  /** Optional availability check note */
  availabilityNote: text("availabilityNote"),
  /** Full email body that was sent (HTML) */
  emailBody: text("emailBody").notNull(),
  /** Send status */
  status: mysqlEnum("confStatus", ["sent", "failed"]).default("sent").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [index("idx_conf_breederId").on(t.breederId)]);

export type BreederConfirmation = typeof breederConfirmations.$inferSelect;
export type InsertBreederConfirmation = typeof breederConfirmations.$inferInsert;

// ─── Refund Tracker ──────────────────────────────────────────────────────────

export const refunds = mysqlTable("refunds", {
  id: int("id").autoincrement().primaryKey(),
  /** Customer full name */
  customerName: varchar("customerName", { length: 255 }).notNull(),
  /** Customer email */
  customerEmail: varchar("customerEmail", { length: 320 }),
  /** Order / booking reference (e.g. Luma order ID or Stripe payment intent) */
  orderRef: varchar("orderRef", { length: 255 }),
  /** Class / event name the refund is for */
  eventName: varchar("eventName", { length: 255 }),
  /** City / location */
  location: mysqlEnum("refundLocation", ["Hamilton", "Kitchener", "Oakville", "Other"]).default("Other").notNull(),
  /** Refund amount in cents (e.g. 5000 = $50.00) */
  amountCents: int("amountCents").notNull(),
  /** Reason for the refund */
  reason: mysqlEnum("refundReason", [
    "Customer request",
    "Event cancelled",
    "Event rescheduled",
    "Duplicate charge",
    "No show",
    "Medical / emergency",
    "Other",
  ]).default("Customer request").notNull(),
  /** Additional notes */
  notes: text("notes"),
  /** Refund method */
  method: mysqlEnum("refundMethod", ["Stripe", "E-Transfer", "Cash", "Credit", "Other"]).default("Stripe").notNull(),
  /** Current status */
  status: mysqlEnum("refundStatus", ["Pending", "Processed", "Denied"]).default("Pending").notNull(),
  /** Date the refund was requested (UTC ms) */
  requestedAt: bigint("requestedAt", { mode: "number" }).notNull(),
  /** Date the refund was processed (UTC ms), null if not yet processed */
  processedAt: bigint("processedAt", { mode: "number" }),
  /** Staff member who processed the refund */
  processedBy: varchar("processedBy", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_refunds_status").on(t.status),
  index("idx_refunds_location").on(t.location),
  index("idx_refunds_requestedAt").on(t.requestedAt),
]);

export type Refund = typeof refunds.$inferSelect;
export type InsertRefund = typeof refunds.$inferInsert;

// ─── Breeder Availability Blasts ──────────────────────────────────────────────
/**
 * One row per monthly availability blast sent to all active breeders.
 */
export const breederAvailabilityBlasts = mysqlTable("breederAvailabilityBlasts", {
  id: int("id").autoincrement().primaryKey(),
  /** e.g. "July 2026" */
  monthLabel: varchar("monthLabel", { length: 100 }).notNull(),
  /** ISO month string e.g. "2026-07" for sorting */
  monthKey: varchar("monthKey", { length: 7 }).notNull(),
  /** Number of breeders emailed */
  emailedCount: int("emailedCount").default(0).notNull(),
  /** Optional custom message included in the blast */
  customMessage: text("customMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [index("idx_blasts_monthKey").on(t.monthKey)]);

export type BreederAvailabilityBlast = typeof breederAvailabilityBlasts.$inferSelect;
export type InsertBreederAvailabilityBlast = typeof breederAvailabilityBlasts.$inferInsert;

/**
 * One row per breeder per blast.
 * Breeder clicks a unique token link in their email to submit availability.
 */
export const breederAvailabilityResponses = mysqlTable("breederAvailabilityResponses", {
  id: int("id").autoincrement().primaryKey(),
  blastId: int("blastId").notNull(),
  breederId: int("breederId").notNull(),
  breederName: varchar("breederName", { length: 255 }).notNull(),
  breederEmail: varchar("breederEmail", { length: 320 }).notNull(),
  /** Unique one-time token embedded in the email link */
  token: varchar("token", { length: 64 }).notNull().unique(),
  /** Whether the breeder has responded */
  responded: int("responded").default(0).notNull(),
  /** Free-text availability e.g. "July 5, 12, 19 - mornings preferred" */
  availabilityText: text("availabilityText"),
  /** Any additional notes from the breeder */
  responseNotes: text("responseNotes"),
  respondedAt: timestamp("respondedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_avail_blastId").on(t.blastId),
  index("idx_avail_breederId").on(t.breederId),
  index("idx_avail_token").on(t.token),
]);

export type BreederAvailabilityResponse = typeof breederAvailabilityResponses.$inferSelect;
export type InsertBreederAvailabilityResponse = typeof breederAvailabilityResponses.$inferInsert;

// ─── Puppy Class Schedule ──────────────────────────────────────────────────────
/**
 * One row per scheduled class slot.
 * Owner selects a Saturday or Sunday date, a location, a breed, and the breeder attending.
 */
export const puppySchedule = mysqlTable("puppySchedule", {
  id: int("id").autoincrement().primaryKey(),
  /** ISO date string e.g. "2026-07-12" — must be a Saturday or Sunday */
  classDate: varchar("classDate", { length: 10 }).notNull(),
  /** Day of week — Saturday/Sunday for regular classes; any day for private events */
  dayOfWeek: mysqlEnum("dayOfWeek", ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]).notNull(),
  /** Location */
  location: mysqlEnum("schedLocation", ["Kitchener", "Hamilton", "Oakville"]).notNull(),
  /** Breed attending this class */
  breed: varchar("breed", { length: 255 }).notNull(),
  /** FK to breeders.id */
  breederId: int("breederId").notNull(),
  /** Breeder name snapshot for display without join */
  breederName: varchar("breederName", { length: 255 }).notNull(),
  /** Start time in HH:MM 24h format e.g. "09:00" */
  startTime: varchar("startTime", { length: 5 }).notNull().default("09:00"),
  /** End time in HH:MM 24h format e.g. "15:00" */
  endTime: varchar("endTime", { length: 5 }).notNull().default("15:00"),
  /** Class type — regular weekend class or private event (can be any weekday) */
  classType: mysqlEnum("classType", ["regular", "private"]).notNull().default("regular"),
  /** Optional notes e.g. number of puppies, special instructions */
  notes: text("notes"),
  /** Luma event ID — set after auto-creating the Luma event page */
  lumaEventId: varchar("lumaEventId", { length: 128 }),
  /** Luma event URL — e.g. https://lu.ma/abc123 */
  lumaEventUrl: varchar("lumaEventUrl", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_schedule_classDate").on(t.classDate),
  index("idx_schedule_location").on(t.location),
  index("idx_schedule_breederId").on(t.breederId),
]);
export type PuppySchedule = typeof puppySchedule.$inferSelect;
export type InsertPuppySchedule = typeof puppySchedule.$inferInsert;

// ─── Inbound SMS ──────────────────────────────────────────────────────────────
/**
 * Stores inbound SMS replies received on the Twilio number.
 * Used for the SMS Inbox in the admin portal.
 */
export const inboundSms = mysqlTable("inboundSms", {
  id: int("id").autoincrement().primaryKey(),
  /** The phone number that sent the message (E.164 format) */
  fromPhone: varchar("fromPhone", { length: 20 }).notNull(),
  /** The Twilio phone number that received it */
  toPhone: varchar("toPhone", { length: 20 }).notNull(),
  /** The message body */
  body: text("body").notNull(),
  /** Twilio message SID for deduplication */
  twilioSid: varchar("twilioSid", { length: 64 }).notNull().unique(),
  /** Matched breeder ID (if we can match by phone) */
  breederId: int("breederId"),
  /** Matched breeder name snapshot */
  breederName: varchar("breederName", { length: 255 }),
  /** Whether the admin has read/acknowledged this message */
  isRead: int("isRead").default(0).notNull(),
  /** When Twilio received the message */
  receivedAt: timestamp("receivedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_inbound_sms_fromPhone").on(t.fromPhone),
  index("idx_inbound_sms_breederId").on(t.breederId),
  index("idx_inbound_sms_isRead").on(t.isRead),
]);

export type InboundSms = typeof inboundSms.$inferSelect;
export type InsertInboundSms = typeof inboundSms.$inferInsert;

// ─── Meta Conversions API ─────────────────────────────────────────────────────
/**
 * One row per Luma guest registration that needs to be (or has been) sent
 * to the Meta Conversions API as a Purchase event.
 *
 * Lifecycle: pending → sent (on success) | failed (on CAPI error, retried up to 3×)
 * Idempotency key: lumaGuestId — the poller will INSERT IGNORE on this column.
 */
export const metaConversionEvents = mysqlTable("metaConversionEvents", {
  id: int("id").autoincrement().primaryKey(),
  /** Luma guest API ID — unique, used as idempotency key */
  lumaGuestId: varchar("lumaGuestId", { length: 128 }).notNull().unique(),
  /** Luma event API ID */
  lumaEventId: varchar("lumaEventId", { length: 128 }).notNull(),
  /** Luma event name (snapshot for debugging) */
  lumaEventName: varchar("lumaEventName", { length: 255 }),
  /** Ticket amount in cents as returned by Luma (e.g. 5500 = $55.00 CAD) */
  amountCents: int("amountCents").notNull(),
  /** Currency code (lowercase, e.g. 'cad') */
  currency: varchar("currency", { length: 10 }).notNull().default("cad"),
  /** UTC ms timestamp of when the guest registered in Luma */
  lumaRegisteredAt: bigint("lumaRegisteredAt", { mode: "number" }).notNull(),
  /** SHA-256 hash of lowercased trimmed email */
  hashedEmail: varchar("hashedEmail", { length: 64 }),
  /** SHA-256 hash of E.164-normalised phone (digits only, no +) */
  hashedPhone: varchar("hashedPhone", { length: 64 }),
  /** SHA-256 hash of lowercased trimmed first name */
  hashedFirstName: varchar("hashedFirstName", { length: 64 }),
  /** SHA-256 hash of lowercased trimmed last name */
  hashedLastName: varchar("hashedLastName", { length: 64 }),
  /** UTM source from Luma guest record (may be null) */
  utmSource: varchar("utmSource", { length: 255 }),
  /** Processing status */
  // 'processing' = atomically claimed by a sender run (prevents double-send if two runs overlap)
  status: mysqlEnum("metaStatus", ["pending", "processing", "sent", "failed", "skipped"]).default("pending").notNull(),
  /** Number of send attempts */
  attempts: int("attempts").default(0).notNull(),
  /** Meta event ID returned on success (for deduplication) */
  metaEventId: varchar("metaEventId", { length: 255 }),
  /** Error message from last failed attempt */
  lastError: text("lastError"),
  /** When the CAPI send was completed */
  sentAt: timestamp("sentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_meta_status").on(t.status),
  index("idx_meta_lumaEventId").on(t.lumaEventId),
  index("idx_meta_lumaRegisteredAt").on(t.lumaRegisteredAt),
]);

export type MetaConversionEvent = typeof metaConversionEvents.$inferSelect;
export type InsertMetaConversionEvent = typeof metaConversionEvents.$inferInsert;

// ─── Call Logs (Twilio class cancellation calls) ────────────────────────────
export const callLogs = mysqlTable("callLogs", {
  id: int("id").autoincrement().primaryKey(),
  lumaEventId: varchar("lumaEventId", { length: 128 }).notNull(),
  eventName: varchar("eventName", { length: 255 }).notNull(),
  guestName: varchar("guestName", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 30 }).notNull(),
  callSid: varchar("callSid", { length: 64 }),
  status: varchar("status", { length: 32 }).notNull().default("queued"),
  smsSid: varchar("smsSid", { length: 64 }),
  smsStatus: varchar("smsStatus", { length: 32 }).notNull().default("queued"),
  emailStatus: varchar("emailStatus", { length: 32 }).notNull().default("queued"),
  errorMessage: text("errorMessage"),
  calledAt: bigint("calledAt", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_callLogs_lumaEventId").on(t.lumaEventId),
  index("idx_callLogs_status").on(t.status),
]);
export type CallLog = typeof callLogs.$inferSelect;
export type InsertCallLog = typeof callLogs.$inferInsert;

// ─── Review Text Logs ─────────────────────────────────────────────────────────
// Tracks post-class Google review SMS sends per guest per event.
// Unique constraint on (lumaEventId, lumaGuestId) prevents duplicate sends.
export const reviewTextLogs = mysqlTable("reviewTextLogs", {
  id: int("id").autoincrement().primaryKey(),
  lumaEventId: varchar("lumaEventId", { length: 128 }).notNull(),
  lumaGuestId: varchar("lumaGuestId", { length: 128 }).notNull(),
  eventName: varchar("eventName", { length: 255 }).notNull(),
  eventEndAt: varchar("eventEndAt", { length: 64 }).notNull(),
  guestName: varchar("guestName", { length: 255 }).notNull(),
  guestEmail: varchar("guestEmail", { length: 320 }),
  phone: varchar("phone", { length: 30 }).notNull(),
  smsSid: varchar("smsSid", { length: 64 }),
  status: varchar("status", { length: 32 }).notNull().default("sent"),
  errorMessage: text("errorMessage"),
  sentAt: bigint("sentAt", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_reviewTextLogs_lumaEventId").on(t.lumaEventId),
  index("idx_reviewTextLogs_guest").on(t.lumaEventId, t.lumaGuestId),
]);
export type ReviewTextLog = typeof reviewTextLogs.$inferSelect;
export type InsertReviewTextLog = typeof reviewTextLogs.$inferInsert;

// ── Breeder Acquisition Engine ────────────────────────────────────────────────
export const breederLeads = mysqlTable("breederLeads", {
  id: int("id").autoincrement().primaryKey(),
  breed: varchar("breed", { length: 128 }).notNull(),
  sellerName: varchar("sellerName", { length: 255 }),
  phoneNumber: varchar("phoneNumber", { length: 30 }),
  email: varchar("email", { length: 320 }),
  city: varchar("city", { length: 128 }),
  province: varchar("province", { length: 64 }),
  postalCode: varchar("postalCode", { length: 16 }),
  distanceKm: int("distanceKm"),
  puppyCount: int("puppyCount"),
  puppyAge: varchar("puppyAge", { length: 64 }),
  expectedReadyDate: varchar("expectedReadyDate", { length: 32 }),
  listingPrice: int("listingPrice"),
  listingUrl: text("listingUrl"),
  listingTitle: varchar("listingTitle", { length: 512 }),
  listingDescription: text("listingDescription"),
  listingImageUrls: text("listingImageUrls"),
  listingPostedAt: varchar("listingPostedAt", { length: 64 }),
  qualificationScore: int("qualificationScore"),
  qualificationReasons: text("qualificationReasons"),
  disqualificationReasons: text("disqualificationReasons"),
  source: varchar("source", { length: 32 }).notNull().default("manual"),
  pipelineStatus: varchar("pipelineStatus", { length: 32 }).notNull().default("new"),
  lastContactedAt: bigint("lastContactedAt", { mode: "number" }),
  convertedBreederId: int("convertedBreederId"),
  internalNotes: text("internalNotes"),
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
}, (t) => [
  index("idx_breederLeads_status").on(t.pipelineStatus),
  index("idx_breederLeads_breed").on(t.breed),
]);
export type BreederLead = typeof breederLeads.$inferSelect;
export type InsertBreederLead = typeof breederLeads.$inferInsert;

export const breederLeadMessages = mysqlTable("breederLeadMessages", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull(),
  channel: varchar("channel", { length: 16 }).notNull(),
  direction: varchar("direction", { length: 16 }).notNull().default("outbound"),
  body: text("body").notNull(),
  subject: varchar("subject", { length: 512 }),
  smsSid: varchar("smsSid", { length: 64 }),
  sentAt: bigint("sentAt", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_breederLeadMessages_leadId").on(t.leadId),
]);
export type BreederLeadMessage = typeof breederLeadMessages.$inferSelect;

export const breederLeadActivities = mysqlTable("breederLeadActivities", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull(),
  activityType: varchar("activityType", { length: 64 }).notNull(),
  description: text("description").notNull(),
  performedBy: varchar("performedBy", { length: 128 }),
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
}, (t) => [
  index("idx_breederLeadActivities_leadId").on(t.leadId),
]);
export type BreederLeadActivity = typeof breederLeadActivities.$inferSelect;

export const breederLeadFollowUps = mysqlTable("breederLeadFollowUps", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull(),
  dueAt: bigint("dueAt", { mode: "number" }).notNull(),
  note: text("note"),
  completed: boolean("completed").notNull().default(false),
  completedAt: bigint("completedAt", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_breederLeadFollowUps_leadId").on(t.leadId),
  index("idx_breederLeadFollowUps_dueAt").on(t.dueAt),
]);
export type BreederLeadFollowUp = typeof breederLeadFollowUps.$inferSelect;

export const staffAvailability = mysqlTable("staffAvailability", {
  id: int("id").autoincrement().primaryKey(),
  staffId: int("staffId").notNull(),
  staffName: varchar("staffName", { length: 255 }).notNull(),
  leaveType: mysqlEnum("leaveType", ["vacation", "sick", "personal", "leave", "unavailable"]).notNull(),
  startDate: varchar("startDate", { length: 20 }).notNull(),
  endDate: varchar("endDate", { length: 20 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_staffAvailability_staffId").on(t.staffId),
  index("idx_staffAvailability_dates").on(t.startDate, t.endDate),
]);
export type StaffAvailability = typeof staffAvailability.$inferSelect;

// ─── Weekend Leadership Coverage ─────────────────────────────────────────────
// One assignment per location / leadership role / Saturday-or-Sunday date.
// Primary availability is derived from staffAvailability; this table stores the
// chosen backup when the primary person is away or coverage is otherwise needed.
export const weekendLeadershipCoverage = mysqlTable("weekendLeadershipCoverage", {
  id: int("id").autoincrement().primaryKey(),
  coverageDate: varchar("coverageDate", { length: 10 }).notNull(),
  location: mysqlEnum("weekendCoverageLocation", ["KW", "OAK", "HAM"]).notNull(),
  role: mysqlEnum("weekendCoverageRole", ["Operations Manager", "Yoga Instructor"]).notNull(),
  coverageStaffId: int("coverageStaffId"),
  coverageStaffName: varchar("coverageStaffName", { length: 255 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_weekendCoverage_date").on(t.coverageDate),
  index("idx_weekendCoverage_shift").on(t.coverageDate, t.location, t.role),
]);
export type WeekendLeadershipCoverage = typeof weekendLeadershipCoverage.$inferSelect;
