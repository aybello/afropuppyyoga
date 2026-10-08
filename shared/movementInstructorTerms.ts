export const MOVEMENT_INSTRUCTOR_HOURLY_PAY_CAD = 22;
export const MOVEMENT_INSTRUCTOR_PAY_LABEL = `CA$${MOVEMENT_INSTRUCTOR_HOURLY_PAY_CAD}/hr`;
export const MOVEMENT_INSTRUCTOR_PAY_DESCRIPTION = `CA$${MOVEMENT_INSTRUCTOR_HOURLY_PAY_CAD} per hour`;

// Offers issued before compensation was stored retain the historical CA$20 hourly rate.
export function getMovementInstructorOfferHourlyPay(savedAmount: number | null | undefined): 20 | 22 {
  if (savedAmount == null || savedAmount === 20) return 20;
  if (savedAmount === 22) return 22;
  throw new Error("Unsupported Movement Instructor offer payment. Please contact AfroPuppyYoga.");
}
