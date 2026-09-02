import crypto from "crypto";
import {
  dayOfWeekForDate,
  schedulesOverlap,
  validateScheduleCandidate,
  type ScheduleCandidate,
} from "./scheduleValidation";

export const APY_STUDIO_LOCATIONS = ["Kitchener", "Hamilton", "Oakville"] as const;
export type ApyStudioLocation = typeof APY_STUDIO_LOCATIONS[number];

export const APY_PUBLIC_CLASS_SLOTS = {
  "10:00": { startTime: "10:00", endTime: "11:00" },
  "11:30": { startTime: "11:30", endTime: "12:30" },
  "13:30": { startTime: "13:30", endTime: "14:30" },
} as const;
export type ApyPublicClassSlot = keyof typeof APY_PUBLIC_CLASS_SLOTS;

export type BreederConfirmationEvent = {
  city: string;
  date: string;
  location: string;
  isPrivateEvent?: boolean;
  classSlot?: ApyPublicClassSlot;
  apyTransport: boolean;
  dropOffTime?: string;
  pickUpTime?: string;
  pickupTime?: string;
  returnTime?: string;
  compensation: string;
};

export type PreparedCalendarConfirmationEvent = Omit<BreederConfirmationEvent, "isPrivateEvent"> & {
  isPrivateEvent: boolean;
};

export type PlannedBreederEvent = {
  event: BreederConfirmationEvent;
  schedule: (ScheduleCandidate & { location: ApyStudioLocation }) | null;
};

export type ExistingCalendarConfirmationSchedule = {
  id: number;
  breederId: number;
  classDate: string;
  location: string;
  classType: string;
  scheduleStatus: string;
};

/**
 * A confirmation opened from the breeder calendar must describe the existing
 * class rather than creating a new schedule or Luma event. Calendar-controlled
 * public details are therefore replaced from the saved schedule before send.
 */
export function prepareExistingCalendarConfirmation(input: {
  schedule: ExistingCalendarConfirmationSchedule;
  breederId: number;
  events: BreederConfirmationEvent[];
}): PreparedCalendarConfirmationEvent[] {
  if (input.schedule.scheduleStatus !== "scheduled") {
    throw new Error("Only an active scheduled class can receive a breeder confirmation.");
  }
  if (input.schedule.breederId !== input.breederId) {
    throw new Error("This calendar class is assigned to a different breeder.");
  }
  if (input.events.length !== 1) {
    throw new Error("A calendar confirmation can include only its selected class.");
  }

  const [event] = input.events;
  return [{
    ...event,
    city: input.schedule.location,
    date: input.schedule.classDate,
    isPrivateEvent: input.schedule.classType === "private",
  }];
}

export function parseBreederEventTime(value: string | undefined, label: string) {
  const time = value?.trim();
  if (!time) throw new Error(`${label} is required.`);
  if (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) return time;
  const match = time.match(/^(\d{1,2}):([0-5]\d)\s*(AM|PM)$/i);
  if (!match) throw new Error(`${label} must be a valid time.`);
  let hour = Number(match[1]);
  if (hour < 1 || hour > 12) throw new Error(`${label} must be a valid time.`);
  const period = match[3].toUpperCase();
  if (period === "PM" && hour !== 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${match[2]}`;
}

export function normalizeBreederPhone(value: string | null | undefined) {
  if (!value?.trim()) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  throw new Error("The breeder's saved phone number is invalid. Update it before sending the confirmation.");
}

export function planBreederConfirmationEvents(events: BreederConfirmationEvent[]): PlannedBreederEvent[] {
  const plans = events.map((event, index) => {
    const prefix = `Event ${index + 1}`;
    const locationAddress = event.location.trim();
    if (!locationAddress) throw new Error(`${prefix}: location is required.`);
    if (!event.compensation.trim()) throw new Error(`${prefix}: compensation is required.`);

    const dayOfWeek = dayOfWeekForDate(event.date);
    const logisticsStart = event.apyTransport
      ? parseBreederEventTime(event.pickupTime, `${prefix} pickup time`)
      : parseBreederEventTime(event.dropOffTime, `${prefix} drop-off time`);
    const logisticsEnd = event.apyTransport
      ? parseBreederEventTime(event.returnTime, `${prefix} return time`)
      : parseBreederEventTime(event.pickUpTime, `${prefix} pick-up time`);
    if (logisticsEnd <= logisticsStart) {
      throw new Error(`${prefix}: breeder pickup or drop-off window must end after it starts.`);
    }
    const knownStudio = APY_STUDIO_LOCATIONS.includes(event.city.trim() as ApyStudioLocation);
    if (!event.isPrivateEvent && !knownStudio) {
      throw new Error(`${prefix}: choose Kitchener, Hamilton, Oakville, or mark the venue as a private event.`);
    }
    const isStudio = knownStudio && !event.isPrivateEvent;
    if (isStudio && !event.classSlot) {
      throw new Error(`${prefix}: choose the APY public class slot before confirming the breeder.`);
    }
    const classTimes = isStudio
      ? APY_PUBLIC_CLASS_SLOTS[event.classSlot!]
      : { startTime: logisticsStart, endTime: logisticsEnd };
    const candidate: ScheduleCandidate = {
      classDate: event.date,
      dayOfWeek,
      location: isStudio ? event.city.trim() : locationAddress.toLowerCase(),
      startTime: classTimes.startTime,
      endTime: classTimes.endTime,
      classType: isStudio && (dayOfWeek === "Saturday" || dayOfWeek === "Sunday") ? "regular" : "private",
    };
    validateScheduleCandidate(candidate);

    return {
      event,
      schedule: isStudio ? { ...candidate, location: event.city.trim() as ApyStudioLocation } : null,
    };
  });

  for (let first = 0; first < plans.length; first++) {
    for (let second = first + 1; second < plans.length; second++) {
      const left = plans[first];
      const right = plans[second];
      const leftBlock = left.schedule ?? {
        classDate: left.event.date,
        location: left.event.location.trim().toLowerCase(),
        startTime: left.event.apyTransport
          ? parseBreederEventTime(left.event.pickupTime, "Pickup time")
          : parseBreederEventTime(left.event.dropOffTime, "Drop-off time"),
        endTime: left.event.apyTransport
          ? parseBreederEventTime(left.event.returnTime, "Return time")
          : parseBreederEventTime(left.event.pickUpTime, "Pick-up time"),
      };
      const rightBlock = right.schedule ?? {
        classDate: right.event.date,
        location: right.event.location.trim().toLowerCase(),
        startTime: right.event.apyTransport
          ? parseBreederEventTime(right.event.pickupTime, "Pickup time")
          : parseBreederEventTime(right.event.dropOffTime, "Drop-off time"),
        endTime: right.event.apyTransport
          ? parseBreederEventTime(right.event.returnTime, "Return time")
          : parseBreederEventTime(right.event.pickUpTime, "Pick-up time"),
      };
      if (schedulesOverlap(leftBlock, rightBlock)) {
        throw new Error(`Events ${first + 1} and ${second + 1} overlap at the same venue.`);
      }
    }
  }
  return plans;
}

export function breederConfirmationRequestKey(input: {
  breederId: number;
  events: BreederConfirmationEvent[];
  availabilityNote?: string;
  sourceScheduleId?: number;
}) {
  return crypto.createHash("sha256").update(JSON.stringify({
    breederId: input.breederId,
    events: input.events,
    availabilityNote: input.availabilityNote?.trim() || null,
    sourceScheduleId: input.sourceScheduleId ?? null,
  })).digest("hex");
}
