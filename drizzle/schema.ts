import { index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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
  status: mysqlEnum("peStatus", ["new", "contacted", "confirmed", "cancelled"]).default("new").notNull(),
  /** Internal notes from admin */
  adminNotes: text("adminNotes"),
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
