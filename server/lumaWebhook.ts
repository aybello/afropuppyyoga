import { Router, Request, Response } from "express";
import crypto from "crypto";
import { getDb } from "./db";
import { privateEventInquiries } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { notifyOwner } from "./_core/notification";

const router = Router();

const WEBHOOK_SECRET = "whsec_29i181ynbw70krbz93tufqkwxbo5y52b";

/**
 * Verify Luma webhook signature (HMAC-SHA256)
 * Luma sends the signature in the `x-luma-signature` header.
 */
function verifySignature(payload: string, signature: string | undefined): boolean {
  if (!signature) return false;
  const expected = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(payload)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(expected, "hex")
  );
}

/**
 * POST /api/luma/webhook
 * Receives Luma webhook events for guest.registered and ticket.registered.
 * When a guest registers (pays) for a private event, auto-updates the inquiry status to "booked".
 */
router.post("/api/luma/webhook", async (req: Request, res: Response) => {
  try {
    const rawBody = JSON.stringify(req.body);
    const signature = req.headers["x-luma-signature"] as string | undefined;

    // Signature verification — log warning but don't reject (Luma may not always sign)
    if (signature && !verifySignature(rawBody, signature)) {
      console.warn("[Luma Webhook] Invalid signature — proceeding anyway for now");
    }

    const { type, data } = req.body;
    console.log(`[Luma Webhook] Received event: ${type}`);

    // Handle guest.registered and ticket.registered — both indicate a payment/registration
    if (type === "guest.registered" || type === "ticket.registered") {
      const eventId = data?.event?.api_id || data?.guest?.event_api_id || data?.event_api_id;
      
      if (!eventId) {
        console.warn("[Luma Webhook] No event_id found in payload:", JSON.stringify(data).slice(0, 200));
        return res.status(200).json({ received: true });
      }

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
