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
import { callLogs } from "../drizzle/schema";

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

export default webhookRouter;
