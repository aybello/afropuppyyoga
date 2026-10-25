// Verified on 2026-10-25 from Google Maps and authenticated Luma CSV export.
// The requested comparison excludes Google 1-star entries. Never use it as
// a five-star count, unique-customer count, or aggregate-rating denominator.
export const REVIEW_METRICS = {
  checkedOn: "2026-10-25",
  google: {
    location: "Kitchener",
    rating: 4.7,
    total: 208,
    stars: { 5: 182, 4: 6, 3: 6, 2: 3, 1: 11 },
    url: "https://www.google.com/maps/place/AfroPuppyYoga/@43.4473836,-80.4838649,17z/data=!3m1!4b1!4m6!3m5!1s0x882b9be3e3b9efcb:0x6ba6398cb4eaa8c!8m2!3d43.4473836!4d-80.4838649!16s%2Fg%2F11wgb47kx4?hl=en",
  },
  luma: {
    total: 414,
    // Past Year on Insights changes page views, not this all-history export.
    earliestFeedback: "2025-07-06",
    latestFeedback: "2026-10-24",
    stars: { 5: 364, 4: 29, 3: 4, 2: 7, 1: 10 },
  },
} as const;

export const COUNTED_GOOGLE_REVIEWS = Object.entries(REVIEW_METRICS.google.stars)
  .filter(([stars]) => stars !== "1")
  .reduce((total, [, count]) => total + count, 0);
export const REVIEW_FEEDBACK_COUNT = COUNTED_GOOGLE_REVIEWS + REVIEW_METRICS.luma.total;
export const REVIEW_COUNT_LABEL = "Reviews & feedback counted";
export const REVIEW_COUNT_NOTE = `${COUNTED_GOOGLE_REVIEWS} Google reviews rated 2 to 5 stars, plus ${REVIEW_METRICS.luma.total} Luma feedback responses exported on October 25, 2026. Google 1-star reviews are excluded from this count. Luma feedback spans July 2025 to October 2026. Responses may come from repeat guests.`;
