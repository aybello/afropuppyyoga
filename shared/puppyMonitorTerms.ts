// Recruitment wording reflects the owner's description, not a legal classification.
export const PUPPY_MONITOR_POSITION_TYPE = "Paid Volunteer";
export const PUPPY_MONITOR_SHIFT_PAY_CAD = 60;
export const PUPPY_MONITOR_PAY_LABEL = `CA$${PUPPY_MONITOR_SHIFT_PAY_CAD}/shift`;
export const PUPPY_MONITOR_PAY_DESCRIPTION = `CA$${PUPPY_MONITOR_SHIFT_PAY_CAD} per shift`;

// Offers issued before compensation was stored retain the historical CA$50 rate.
export function getPuppyMonitorOfferShiftPay(savedAmount: number | null | undefined): 50 | 60 {
  if (savedAmount == null || savedAmount === 50) return 50;
  if (savedAmount === 60) return 60;
  throw new Error("Unsupported Puppy Monitor offer payment. Please contact AfroPuppyYoga.");
}
