export const SOCIAL_MEDIA_INTERN_START_HOURLY_PAY_CAD = 19 as const;
export const SOCIAL_MEDIA_INTERN_POST_PROBATION_HOURLY_PAY_CAD = 20 as const;
/** Probation length in months. Ontario's ESA treats the first three months as the standard threshold. */
export const SOCIAL_MEDIA_INTERN_PROBATION_MONTHS = 3;

export const SOCIAL_MEDIA_INTERN_PAY_LABEL = `CA$${SOCIAL_MEDIA_INTERN_START_HOURLY_PAY_CAD}/hr`;
export const SOCIAL_MEDIA_INTERN_PAY_DESCRIPTION =
  `CA$${SOCIAL_MEDIA_INTERN_START_HOURLY_PAY_CAD}/hr to start, rising to CA$${SOCIAL_MEDIA_INTERN_POST_PROBATION_HOURLY_PAY_CAD}/hr after a ${SOCIAL_MEDIA_INTERN_PROBATION_MONTHS}-month probation`;

/** Offer letter wording. Bound to the amount saved on the offer so an issued document never changes. */
export function getSocialMediaCompensationText(savedStartPay: number | null | undefined): string {
  const startPay = getSocialMediaOfferStartHourlyPay(savedStartPay);
  if (startPay == null) {
    return "Paid part-time role. Compensation and approved hours will follow the terms confirmed in writing by APY.";
  }
  return `CA$${startPay}.00 per hour. Following successful completion of a ${SOCIAL_MEDIA_INTERN_PROBATION_MONTHS}-month probationary period, your rate increases to CA$${SOCIAL_MEDIA_INTERN_POST_PROBATION_HOURLY_PAY_CAD}.00 per hour.`;
}

/**
 * Offers issued before a rate was approved carry no saved amount. Those documents keep
 * their original wording so an already-issued offer is never changed by a later decision.
 */
export function getSocialMediaOfferStartHourlyPay(savedAmount: number | null | undefined): 19 | null {
  if (savedAmount == null) return null;
  if (savedAmount === SOCIAL_MEDIA_INTERN_START_HOURLY_PAY_CAD) return SOCIAL_MEDIA_INTERN_START_HOURLY_PAY_CAD;
  throw new Error("Unsupported Social Media offer payment. Please contact AfroPuppyYoga.");
}
