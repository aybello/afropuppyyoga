/** Shared public-class settings shown in APY HQ and sent to Luma at creation. */
export const APY_REGULAR_CLASS_TIME_SLOTS = [
  { label: "10AM", startHour: 10, startMinute: 0, endHour: 11, endMinute: 0 },
  { label: "11:30AM", startHour: 11, startMinute: 30, endHour: 12, endMinute: 30 },
  { label: "1:30PM", startHour: 13, startMinute: 30, endHour: 14, endMinute: 30 },
] as const;

type RegularClassTicketOption = {
  label: "Early Bird" | "Bring a Friend" | "Group of 3" | "Regular";
  suffix: string;
  cents: number;
  displayPrice: string;
  maxCapacity: number;
};

const KITCHENER_HAMILTON_FALL_TICKET_LADDER = [
  { label: "Early Bird", suffix: "Early Bird 🐣❤️", cents: 5600, displayPrice: "$56", maxCapacity: 4 },
  { label: "Bring a Friend", suffix: "Bring a Friend 👯‍♀️", cents: 10800, displayPrice: "$108 for 2", maxCapacity: 3 },
  { label: "Group of 3", suffix: "Group of 3 👯‍♀️", cents: 15600, displayPrice: "$156 for 3", maxCapacity: 1 },
  { label: "Regular", suffix: "Regular", cents: 5800, displayPrice: "$58", maxCapacity: 7 },
] as const satisfies readonly RegularClassTicketOption[];

const OAKVILLE_FALL_TICKET_LADDER = [
  { label: "Early Bird", suffix: "Early Bird 🐣❤️", cents: 6100, displayPrice: "$61", maxCapacity: 4 },
  { label: "Bring a Friend", suffix: "Bring a Friend 👯‍♀️", cents: 11800, displayPrice: "$118 for 2", maxCapacity: 3 },
  { label: "Group of 3", suffix: "Group of 3 👯‍♀️", cents: 17100, displayPrice: "$171 for 3", maxCapacity: 1 },
  { label: "Regular", suffix: "Regular", cents: 6300, displayPrice: "$63", maxCapacity: 7 },
] as const satisfies readonly RegularClassTicketOption[];

/**
 * Approved conservative Fall ladder. Ticket capacity is measured in purchases:
 * 4 Early Bird seats + 3 two-person friend packages + 1 three-person group
 * package + 7 Regular seats = 20 attendees per time slot.
 */
export const APY_REGULAR_CLASS_TICKET_LADDERS = {
  Kitchener: KITCHENER_HAMILTON_FALL_TICKET_LADDER,
  Hamilton: KITCHENER_HAMILTON_FALL_TICKET_LADDER,
  Oakville: OAKVILLE_FALL_TICKET_LADDER,
} as const;

export function getRegularClassTicketOptions(location?: string | null): readonly RegularClassTicketOption[] {
  return location?.trim().toLocaleLowerCase() === "oakville"
    ? OAKVILLE_FALL_TICKET_LADDER
    : KITCHENER_HAMILTON_FALL_TICKET_LADDER;
}

/** Default to the Kitchener/Hamilton conservative ladder when a caller has not selected a studio yet. */
export const APY_REGULAR_CLASS_TICKET_OPTIONS = KITCHENER_HAMILTON_FALL_TICKET_LADDER;

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
