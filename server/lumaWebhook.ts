import { Router, Request, Response } from "express";
import crypto from "crypto";
import { getDb } from "./db";
import { privateEventInquiries } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { notifyOwner } from "./_core/notification";
import { syncMetaPurchases } from "./metaCapi";

const router = Router();

const MAX_WEBHOOK_AGE_SECONDS = 5 * 60;

type RawBodyRequest = Request & { rawBody?: string };

/**
 * Verify Luma's timestamped HMAC-SHA256 signature and reject replays.
 */
export function verifyLumaWebhookSignature(args: {
  secret: string;
  signatureHeader?: string;
  rawBody: string;
  nowSeconds?: number;
}): boolean {
  const { secret, signatureHeader, rawBody } = args;
  if (!secret || !signatureHeader || !rawBody) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(",").map(part => {
      const separator = part.indexOf("=");
      return separator < 0
        ? [part.trim(), ""]
        : [part.slice(0, separator).trim(), part.slice(separator + 1).trim()];
    }),
  );
  const timestamp = Number(parts.t);
  const signature = parts.v1;
  if (!Number.isFinite(timestamp) || !signature) return false;

  const nowSeconds = args.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestamp) > MAX_WEBHOOK_AGE_SECONDS) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  return expectedBuffer.length === actualBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

let metaSyncTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleMetaPurchaseSync(): void {
  if (metaSyncTimer) return;
  metaSyncTimer = setTimeout(() => {
    metaSyncTimer = null;
    void syncMetaPurchases().catch(error => {
      console.error("[Luma Webhook] Background Meta purchase sync failed:", error);
    });
  }, 1_000);
  metaSyncTimer.unref?.();
}

/**
 * POST /api/luma/webhook
 * Receives Luma webhook events for guest.registered and ticket.registered.
 * When a guest registers (pays) for a private event, auto-updates the inquiry status to "booked".
 */
router.post("/api/luma/webhook", async (req: Request, res: Response) => {
  try {
    const webhookSecret = process.env.LUMA_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("[Luma Webhook] LUMA_WEBHOOK_SECRET is not configured");
      return res.status(503).json({ error: "Webhook unavailable" });
    }

    const rawBody = (req as RawBodyRequest).rawBody ?? "";
    const signatureHeader = req.get("webhook-signature") ?? undefined;
    if (!verifyLumaWebhookSignature({ secret: webhookSecret, signatureHeader, rawBody })) {
      console.warn("[Luma Webhook] Rejected invalid or stale signature");
      return res.status(401).json({ error: "Invalid signature" });
    }

    const { type, data } = req.body;
    console.log(`[Luma Webhook] Received event: ${type}`);

    // Handle guest.registered and ticket.registered — both indicate a payment/registration
    if (type === "guest.registered" || type === "ticket.registered") {
      const eventId = data?.event?.api_id || data?.guest?.event_api_id || data?.event_api_id;
      
      if (!eventId) {
        console.warn("[Luma Webhook] Registration payload did not contain an event ID");
        return res.status(200).json({ received: true });
      }

      // Reconcile the new paid registration through the same idempotent Luma
      // poller used by the scheduled fallback. Debouncing avoids duplicate API
      // work when Luma emits both guest.registered and ticket.registered.
      scheduleMetaPurchaseSync();

      const db = await getDb();
      if (!db) {
        console.error("[Luma Webhook] Database unavailable");
        return res.status(500).json({ error: "Database unavailable" });
      }

      // Find the inquiry linked to this Luma event
      const [inquiry] = await db
        .select()
        .from(privateEventInquiries)
        .where(eq(privateEventInquiries.lumaEventId, eventId));

      if (!inquiry) {
        // Not a private event we track — could be a public class registration
        console.log(`[Luma Webhook] No matching inquiry for event ${eventId} — ignoring`);
        return res.status(200).json({ received: true });
      }

      // Only update if currently in quote_sent status (avoid double-processing)
      if (inquiry.status === "quote_sent") {
        await db
          .update(privateEventInquiries)
          .set({ status: "booked" })
          .where(eq(privateEventInquiries.id, inquiry.id));

        console.log(`[Luma Webhook] Inquiry #${inquiry.id} (${inquiry.name}) status updated to "booked"`);

        // Notify the owner
        const guestName = data?.guest?.name || data?.name || "A client";
        const guestEmail = data?.guest?.email || data?.email || "";
        await notifyOwner({
          title: `Private Event Booked: ${inquiry.name}`,
          content: [
            `${guestName} (${guestEmail}) just paid for the private event.`,
            `Organization: ${inquiry.organization || "N/A"}`,
            `Event Date: ${inquiry.preferredDate || "TBD"}`,
            `Amount: $${inquiry.finalPriceCents ? (inquiry.finalPriceCents / 100).toFixed(2) : "N/A"}`,
            `Luma Link: ${inquiry.lumaEventUrl || "N/A"}`,
          ].join("\n"),
        });
      } else {
        console.log(`[Luma Webhook] Inquiry #${inquiry.id} already in status "${inquiry.status}" — no update needed`);
      }
    }

    return res.status(200).json({ received: true });
  } catch (err: any) {
    console.error("[Luma Webhook] Error processing webhook:", err.message);
    return res.status(500).json({ error: "Internal error" });
  }
});

export default router;
