export type IndividualNotificationDeliveryStatus = "sent" | "sms_suppressed" | "not_configured" | "failed";

export function individualScheduleDeliveryFeedback(input: { deliveryStatus: IndividualNotificationDeliveryStatus; name: string; errors: string[] }) {
  if (input.deliveryStatus === "sent") return { kind: "success" as const, message: `Schedule sent to ${input.name}` };
  if (input.deliveryStatus === "sms_suppressed") return { kind: "warning" as const, message: `${input.name} has opted out of SMS, and no email was delivered.` };
  if (input.deliveryStatus === "not_configured") return { kind: "error" as const, message: `Schedule was not delivered to ${input.name}: no configured delivery channel is available.` };
  return { kind: "error" as const, message: `Schedule was not delivered to ${input.name}. ${input.errors.join(" ") || "Check their contact details and delivery setup."}` };
}
