// Proposed price bands approved for testing. They are not proven optimal prices or margin guarantees.
export const PRIVATE_EVENT_PACKAGE_BANDS = {
  classic: { name: "Classic Experience", min: 1500, max: 1750 },
  signature: { name: "Signature Experience", min: 2000, max: 2250 },
  luxury: { name: "Luxury Experience", min: 2500, max: 3500 },
} as const;

export type PrivateEventPackageType = keyof typeof PRIVATE_EVENT_PACKAGE_BANDS;

export const PRIVATE_EVENT_PRICE_NOTE = "Indicative package ranges in CAD, plus HST. Final pricing depends on the confirmed scope, date and delivery costs. Off-site travel is quoted separately. Larger or more complex events receive a custom quote and may exceed these ranges.";
export const PRIVATE_EVENT_TRAVEL_NOTE = "Off-site travel is quoted separately, not included in the package range.";
export const PRIVATE_EVENT_CUSTOM_NOTE = "Larger or more complex events receive a custom quote and may exceed the advertised package range.";

const formatMoney = (value: number) => `$${value.toLocaleString("en-CA")}`;

export function privateEventBandLabel(packageType: PrivateEventPackageType): string {
  const band = PRIVATE_EVENT_PACKAGE_BANDS[packageType];
  return `${formatMoney(band.min)}-${formatMoney(band.max)} + HST`;
}

export function estimatePrivateEventPackage(input: {
  guests: number;
  packageType: PrivateEventPackageType;
}) {
  const band = PRIVATE_EVENT_PACKAGE_BANDS[input.packageType];
  const requiresCustomQuote = input.guests > 20;
  return {
    min: band.min,
    max: band.max,
    sessions: Math.max(1, Math.ceil(input.guests / 20)),
    requiresCustomQuote,
    breakdown: [
      `${band.name}: ${privateEventBandLabel(input.packageType)} (CAD)`,
      "Final pricing depends on the confirmed scope, date and delivery costs.",
      PRIVATE_EVENT_TRAVEL_NOTE,
      ...(requiresCustomQuote ? [PRIVATE_EVENT_CUSTOM_NOTE] : []),
    ],
  };
}

// Zero/zero is a non-numeric custom estimate for new larger-group inquiries, never a free event.
// This display helper does not reprice or rewrite any existing inquiry or final booking amount.
export function formatStoredPrivateEventEstimate(min: number, max: number): string {
  if (min <= 0 && max <= 0) return "Custom quote required";
  return `${formatMoney(min)}-${formatMoney(max)} CAD + HST`;
}
