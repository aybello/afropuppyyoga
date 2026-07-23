/**
 * SMS Broadcast Router
 *
 * Allows staff to send SMS messages to individual contacts or bulk lists.
 * Supports single send, manual multi-number entry, and CSV-parsed bulk sends.
 *
 * All procedures are staff-only.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import twilio from "twilio";
import { staffProcedure, router } from "../_core/trpc";

/** Normalize a phone number to E.164 format (+1XXXXXXXXXX for CA/US) */
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const withCountry = digits.startsWith("1") ? digits : "1" + digits;
  if (withCountry.length < 11) return null;
  return "+" + withCountry;
}

/** Get a configured Twilio client or throw */
function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Twilio credentials are not configured",
    });
  }

  return { client: twilio(accountSid, authToken), fromNumber };
}

export const smsBroadcastRouter = router({
  /**
   * Send a single SMS to one recipient.
   */
  sendSingle: staffProcedure
    .input(
      z.object({
        phone: z.string().min(10),
        name: z.string().optional(),
        message: z.string().min(1, "Message cannot be empty").max(1600),
      })
    )
    .mutation(async ({ input }) => {
      const { client, fromNumber } = getTwilioClient();

      const to = normalizePhone(input.phone);
      if (!to) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Invalid phone number: ${input.phone}`,
        });
      }

      try {
        const msg = await client.messages.create({
          to,
          from: fromNumber,
          body: input.message,
        });
        return { success: true, to, sid: msg.sid, status: msg.status };
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }),

  /**
   * Send an SMS to multiple recipients.
   * Each recipient gets the same message body (with optional {name} substitution).
   * Returns per-recipient results so the UI can show a progress log.
   */
  sendBulk: staffProcedure
    .input(
      z.object({
        recipients: z
          .array(
            z.object({
              phone: z.string(),
              name: z.string().optional(),
            })
          )
          .min(1)
          .max(500, "Maximum 500 recipients per batch"),
        message: z.string().min(1, "Message cannot be empty").max(1600),
        /** If true, replace {name} in the message with the recipient's name */
        personalise: z.boolean().default(false),
      })
    )
    .mutation(async ({ input }) => {
      const { client, fromNumber } = getTwilioClient();

      const results: Array<{
        phone: string;
        name: string;
        to: string;
        status: string;
        sid?: string;
        error?: string;
      }> = [];

      for (const recipient of input.recipients) {
        const to = normalizePhone(recipient.phone);
        const name = recipient.name ?? "";

        if (!to) {
          results.push({
            phone: recipient.phone,
            name,
            to: recipient.phone,
            status: "invalid",
            error: "Invalid phone number",
          });
          continue;
        }

        const body = input.personalise && name
          ? input.message.replace(/\{name\}/gi, name)
          : input.message;

        try {
          const msg = await client.messages.create({
            to,
            from: fromNumber,
            body,
          });
          results.push({ phone: recipient.phone, name, to, status: msg.status, sid: msg.sid });
        } catch (err) {
          results.push({
            phone: recipient.phone,
            name,
            to,
            status: "failed",
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      const sent = results.filter((r) => r.status !== "failed" && r.status !== "invalid").length;
      const failed = results.filter((r) => r.status === "failed" || r.status === "invalid").length;

      return { total: input.recipients.length, sent, failed, results };
    }),
});
