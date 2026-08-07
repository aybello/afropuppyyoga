/**
 * Twilio Webhook Routes
 *
 * Twilio calls these endpoints after each call/SMS to report final status.
 * We update the callLogs table so the admin UI shows real delivery status.
 *
 * Endpoints:
 *   POST /api/twilio/call-status  — called by Twilio after a voice call completes
 *   POST /api/twilio/sms-status   — called by Twilio after an SMS is delivered/failed
 *
 * Twilio sends application/x-www-form-urlencoded bodies.
 * We validate the request signature to prevent spoofing.
 */
import { Router } from "express";
import twilio from "twilio";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { callLogs, inboundSms, breeders } from "../drizzle/schema";

const webhookRouter = Router();

function validateTwilioSignature(req: import("express").Request): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return false;
  // In development, skip signature validation
  if (process.env.NODE_ENV === "development") return true;
  const signature = req.headers["x-twilio-signature"] as string | undefined;
  if (!signature) return false;
  const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  return twilio.validateRequest(authToken, signature, url, req.body as Record<string, string>);
}

/**
 * POST /api/twilio/call-status
 * Twilio sends: CallSid, CallStatus (completed | no-answer | busy | failed | canceled)
 */
webhookRouter.post("/api/twilio/call-status", async (req, res) => {
  if (!validateTwilioSignature(req)) {
    res.status(403).send("Forbidden");
    return;
  }

  const { CallSid, CallStatus } = req.body as { CallSid?: string; CallStatus?: string };

  if (CallSid && CallStatus) {
    try {
      const db = await getDb();
      if (db) {
        await db
          .update(callLogs)
          .set({ status: CallStatus })
          .where(eq(callLogs.callSid, CallSid));
      }
    } catch (err) {
      console.error("[Twilio webhook] call-status update error:", err);
    }
  }

  // Twilio expects a 200 with empty TwiML or plain text
  res.set("Content-Type", "text/xml");
  res.status(200).send("<Response></Response>");
});

/**
 * POST /api/twilio/sms-status
 * Twilio sends: SmsSid / MessageSid, MessageStatus (delivered | failed | undelivered | sent)
 */
webhookRouter.post("/api/twilio/sms-status", async (req, res) => {
  if (!validateTwilioSignature(req)) {
    res.status(403).send("Forbidden");
    return;
  }

  const body = req.body as {
    SmsSid?: string;
    MessageSid?: string;
    MessageStatus?: string;
    SmsStatus?: string;
  };

  const smsSid = body.SmsSid ?? body.MessageSid;
  const smsStatus = body.MessageStatus ?? body.SmsStatus;

  if (smsSid && smsStatus) {
    try {
      const db = await getDb();
      if (db) {
        await db
          .update(callLogs)
          .set({ smsStatus })
          .where(eq(callLogs.smsSid, smsSid));
      }
    } catch (err) {
      console.error("[Twilio webhook] sms-status update error:", err);
    }
  }

  res.status(200).send("OK");
});

/**
 * POST /api/twilio/sms-inbound
 * Twilio calls this when someone replies to our Twilio number.
 * 1. Saves the message to inboundSms table
 * 2. Tries to match the sender to a known breeder by phone number
 * 3. Forwards the message to the owner's personal cell via SMS
 */
webhookRouter.post("/api/twilio/sms-inbound", async (req, res) => {
  // Skip signature validation in dev; enforce in production
  if (process.env.NODE_ENV !== "development" && !validateTwilioSignature(req)) {
    res.status(403).send("Forbidden");
    return;
  }

  const body = req.body as {
    MessageSid?: string;
    SmsSid?: string;
    From?: string;
    To?: string;
    Body?: string;
  };

  const twilioSid = body.MessageSid ?? body.SmsSid ?? "";
  const fromPhone = body.From ?? "";
  const toPhone = body.To ?? "";
  const messageBody = body.Body ?? "";

  if (!twilioSid || !fromPhone || !messageBody) {
    res.status(200).send("<Response></Response>");
    return;
  }

  let breederId: number | null = null;
  let breederName: string | null = null;

  try {
    const db = await getDb();
    if (db) {
      // Normalize phone for matching (strip non-digits, add country code)
      const digits = fromPhone.replace(/\D/g, "");
      const normalized = digits.length === 10 ? "1" + digits : digits;

      // Try to match to a breeder by phone
      const allBreeders = await db.select().from(breeders).where(eq(breeders.isActive, 1));
      const matched = allBreeders.find(b => {
        if (!b.phone) return false;
        const bd = b.phone.replace(/\D/g, "");
        const bn = bd.length === 10 ? "1" + bd : bd;
        return bn === normalized;
      });

      if (matched) {
        breederId = matched.id;
        breederName = matched.name;
      }

      // Store in DB (ignore duplicate twilioSid)
      await db.insert(inboundSms).ignore().values({
        fromPhone,
        toPhone,
        body: messageBody,
        twilioSid,
        breederId: breederId ?? undefined,
        breederName: breederName ?? undefined,
        isRead: 0,
      });

      // Forward to owner's personal cell
      const ownerPhone = process.env.OWNER_PHONE_NUMBER;
      const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
      const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
      const twilioFromNumber = process.env.TWILIO_PHONE_NUMBER;

      if (ownerPhone && twilioAccountSid && twilioAuthToken && twilioFromNumber) {
        const senderLabel = breederName ?? fromPhone;
        const forwardBody = `📩 Reply from ${senderLabel}:\n"${messageBody}"`;
        const params = new URLSearchParams();
        params.append("To", ownerPhone);
        params.append("From", twilioFromNumber);
        params.append("Body", forwardBody);
        await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
          {
            method: "POST",
            headers: {
              Authorization: "Basic " + Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString("base64"),
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: params.toString(),
          }
        );
        console.log(`[SMS Inbound] Forwarded reply from ${senderLabel} to owner`);
      }
    }
  } catch (err) {
    console.error("[SMS Inbound] Error handling inbound SMS:", err);
  }

  // Respond with empty TwiML so Twilio doesn't auto-reply
  res.set("Content-Type", "text/xml");
  res.status(200).send("<Response></Response>");
});

export default webhookRouter;
