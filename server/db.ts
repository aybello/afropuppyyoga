import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertInvoice, InsertJobApplication, InsertUser, InsertBirthdayInquiry, InsertPartnershipInquiry, invoices, jobApplications, users, birthdayInquiries, partnershipInquiries } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// TODO: add feature queries here as your schema grows.

export async function createInvoice(data: InsertInvoice) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(invoices).values(data);
  return result;
}

export async function getAllInvoices() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(invoices).orderBy(desc(invoices.createdAt));
}

export async function getInvoiceById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  return result[0] ?? null;
}

export async function updateInvoice(id: number, data: Partial<InsertInvoice>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(invoices).set(data).where(eq(invoices.id, id));
}

export async function deleteInvoice(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(invoices).where(eq(invoices.id, id));
}

export async function createJobApplication(data: InsertJobApplication) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(jobApplications).values(data);
  return result;
}

export async function getAllJobApplications() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(jobApplications).orderBy(desc(jobApplications.createdAt));
}

export async function updateJobApplication(id: number, data: Partial<InsertJobApplication>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(jobApplications).set(data).where(eq(jobApplications.id, id));
}

export async function createBirthdayInquiry(data: InsertBirthdayInquiry) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(birthdayInquiries).values(data);
  return result;
}

export async function getAllBirthdayInquiries() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(birthdayInquiries).orderBy(desc(birthdayInquiries.createdAt));
}

export async function updateBirthdayInquiry(id: number, data: Partial<InsertBirthdayInquiry>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(birthdayInquiries).set(data).where(eq(birthdayInquiries.id, id));
}

export async function createPartnershipInquiry(data: InsertPartnershipInquiry) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(partnershipInquiries).values(data);
  return result;
}

export async function getAllPartnershipInquiries() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(partnershipInquiries).orderBy(desc(partnershipInquiries.createdAt));
}

export async function updatePartnershipInquiry(id: number, data: Partial<InsertPartnershipInquiry>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(partnershipInquiries).set(data).where(eq(partnershipInquiries.id, id));
}
