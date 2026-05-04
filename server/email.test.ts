/**
 * Email SMTP connectivity test.
 * Verifies that the GMAIL_APP_PASSWORD env var is set and the SMTP
 * connection to Gmail is valid. Skips gracefully if the env var is absent.
 */
import { describe, it, expect } from "vitest";
import nodemailer from "nodemailer";

describe("Email SMTP", () => {
  it("should verify Gmail SMTP connection when GMAIL_APP_PASSWORD is set", async () => {
    const pass = process.env.GMAIL_APP_PASSWORD;

    if (!pass) {
      console.warn("GMAIL_APP_PASSWORD not set — skipping SMTP test");
      return;
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "afropuppyyogaofficial@gmail.com",
        pass,
      },
    });

    await expect(transporter.verify()).resolves.toBe(true);
  }, 15000);
});
