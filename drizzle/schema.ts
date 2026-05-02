import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
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
  /** Payment status */
  status: mysqlEnum("status", ["pending", "paid", "overdue"]).default("pending").notNull(),
  /** Whether AI extraction has been completed */
  extractionStatus: mysqlEnum("extractionStatus", ["pending", "completed", "failed"]).default("pending").notNull(),
  /** Raw extracted text for debugging */
  extractedData: text("extractedData"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

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
  /** Application status */
  status: mysqlEnum("appStatus", ["new", "reviewed", "shortlisted", "rejected"]).default("new").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type JobApplication = typeof jobApplications.$inferSelect;
export type InsertJobApplication = typeof jobApplications.$inferInsert;