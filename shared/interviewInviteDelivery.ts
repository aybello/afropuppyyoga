export type InterviewInviteDelivery = {
  email: { status: "sent" | "unknown" | "failed"; reason?: string };
  sms: { status: "queued" | "sent" | "delivered" | "skipped" | "failed" | "unknown"; reason?: string };
  trackingWarning?: string;
};

export function describeInterviewInviteDelivery(result: InterviewInviteDelivery) {
  const email = result.email.status === "sent" ? "Email accepted for sending."
    : result.email.status === "unknown" ? "Email outcome unconfirmed. Check the APY Sent folder before sending again."
      : "Email was not sent.";
  const sms = result.sms.status === "queued" ? "Text queued, not yet confirmed delivered."
    : result.sms.status === "sent" ? "Text sent to the carrier, not yet confirmed delivered."
      : result.sms.status === "delivered" ? "Text delivery confirmed by the provider."
        : result.sms.status === "skipped" ? `Text skipped. ${result.sms.reason ?? "No eligible saved phone number."}`
          : result.sms.status === "failed" ? `Text was not sent. ${result.sms.reason ?? "The provider rejected the text."}`
            : "Text outcome unconfirmed. Check delivery history before sending again.";
  const warning = result.email.status !== "sent" || !["queued", "sent", "delivered"].includes(result.sms.status)
    || Boolean(result.email.reason) || Boolean(result.trackingWarning);
  return { message: [email, sms, result.email.reason, result.trackingWarning].filter(Boolean).join(" "), warning };
}
