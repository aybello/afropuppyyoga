import { FIVE_STAR_REVIEW_COUNT } from "./reviewMetrics";

/** Public service cities only. This is not a list of permanent studios or staffing codes. */
export const PUBLIC_LOCATION_NAMES = ["Kitchener", "Hamilton", "Oakville", "Guelph"] as const;
export const PUBLIC_LOCATION_COUNT = PUBLIC_LOCATION_NAMES.length;
export const PUBLIC_LOCATION_LIST = new Intl.ListFormat("en-CA", {
  style: "long",
  type: "conjunction",
}).format(PUBLIC_LOCATION_NAMES);

export const MEMBERSHIP_LOCATION_COPY = `Your Puppy Pass or Wellness Pack is valid in ${PUBLIC_LOCATION_LIST}. One membership, all ${PUBLIC_LOCATION_COUNT} cities.`;
export const PUBLIC_LOCATION_FAQ = `We host classes in ${PUBLIC_LOCATION_LIST}. Check the venue, date and arrival details on your selected Luma event listing before booking.`;
export const HOME_SEO_TITLE = "AfroPuppyYoga | Ontario's #1 Puppy Yoga Experience";
export const HOME_SEO_DESCRIPTION = `Puppy yoga in ${PUBLIC_LOCATION_LIST.replace("Kitchener", "Kitchener-Waterloo")}. ${FIVE_STAR_REVIEW_COUNT} five-star reviews. Guided movement, Afrobeats and puppy cuddles. Book on Luma.`;
export const LOYALTY_SEO_DESCRIPTION = `Free APY rewards across ${PUBLIC_LOCATION_LIST}. Attend 3 classes and earn a free standard class. Book with the same email to track your visits.`;
export const PUBLIC_SERVICE_DESCRIPTION = `Guided movement, Afrobeats and puppy cuddles in ${PUBLIC_LOCATION_LIST}, Ontario.`;
