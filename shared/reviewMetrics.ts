// Verified on 2026-10-25 from Google Maps and authenticated Luma CSV export.
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
    earliestFeedback: "2025-07-06",
    latestFeedback: "2026-10-24",
    stars: { 5: 364, 4: 29, 3: 4, 2: 7, 1: 10 },
  },
} as const;

export const FIVE_STAR_REVIEW_COUNT = REVIEW_METRICS.google.stars[5] + REVIEW_METRICS.luma.stars[5];
export const REVIEW_COUNT_LABEL = "Five-Star Reviews";
