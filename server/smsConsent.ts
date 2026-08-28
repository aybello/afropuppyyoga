import { eq } from "drizzle-orm";
import { smsSuppressions } from "../drizzle/schema";
import { normalizeCanadianPhoneNumber } from "../shared/phone";
import { getDb } from "./db";

const STOP_WORDS = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"]);
const START_WORDS = new Set(["START", "UNSTOP", "YES"]);

export function classifySmsConsentKeyword(body: string): "stop" | "start" | null {
  const keyword = body.trim().toUpperCase();
  if (STOP_WORDS.has(keyword)) return "stop";
  if (START_WORDS.has(keyword)) return "start";
  return null;
}

export async function applyInboundSmsConsent(phoneInput: string, body: string, sourceTwilioSid?: string) {
  const action = classifySmsConsentKeyword(body);
  const phone = normalizeCanadianPhoneNumber(phoneInput);
  if (!action || !phone) return null;
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const now = new Date();
  await db.insert(smsSuppressions).values({ phone, isActive: action === "stop", keyword: body.trim().toUpperCase(), sourceTwilioSid: sourceTwilioSid ?? null, suppressedAt: now, reactivatedAt: action === "start" ? now : null })
    .onDuplicateKeyUpdate({ set: { isActive: action === "stop", keyword: body.trim().toUpperCase(), sourceTwilioSid: sourceTwilioSid ?? null, reactivatedAt: action === "start" ? now : null } });
  return action;
}

export async function isSmsSuppressed(phoneInput: string | null | undefined): Promise<boolean> {
  if (!phoneInput) return false;
  const phone = normalizeCanadianPhoneNumber(phoneInput);
  if (!phone) return false;
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [row] = await db.select({ isActive: smsSuppressions.isActive }).from(smsSuppressions).where(eq(smsSuppressions.phone, phone)).limit(1);
  return row?.isActive === true;
}
