/** Shared public-class settings shown in APY HQ and sent to Luma at creation. */
export const APY_REGULAR_CLASS_TIME_SLOTS = [
  { label: "10AM", startHour: 10, startMinute: 0, endHour: 11, endMinute: 0 },
  { label: "11:30AM", startHour: 11, startMinute: 30, endHour: 12, endMinute: 30 },
  { label: "1:30PM", startHour: 13, startMinute: 30, endHour: 14, endMinute: 30 },
] as const;

export const APY_REGULAR_CLASS_TICKET_OPTIONS = [
  { label: "Early Bird", suffix: "Early Bird 🐣❤️", cents: 5000, displayPrice: "$50", maxCapacity: 5 },
  { label: "Bring a Friend", suffix: "Bring a Friend 👯‍♀️", cents: 9600, displayPrice: "$96", maxCapacity: 4 },
  { label: "Group of 3", suffix: "Group of 3 👯‍♀️", cents: 13800, displayPrice: "$138", maxCapacity: 1 },
  { label: "Regular", suffix: "Regular", cents: 5200, displayPrice: "$52", maxCapacity: 4 },
] as const;

export const APY_MAT_RENTAL_TICKET = {
  name: "Mat Rental 🧘‍♀️",
  cents: 250,
  displayPrice: "$2.50",
} as const;

export const APY_REGULAR_CLASS_LUMA_PREVIEW = {
  groupRegistration: true,
  tintColor: "#9B2335",
  pattern: "Hypnotic",
  display: "Light",
} as const;
