export type PrivateEventSessionSlot = {
  startTime: string;
  endTime: string;
};

export type PrivateEventSessionPlan = PrivateEventSessionSlot & {
  sessionNumber: number;
  paymentMode: "combined_checkout" | "included";
};

function parseTime(value: string): number {
  if (!/^\d{2}:\d{2}$/.test(value)) throw new Error("Session times must use HH:mm format.");
  const [hours, minutes] = value.split(":").map(Number);
  if (hours > 23 || minutes > 59) throw new Error("Session time is invalid.");
  return hours * 60 + minutes;
}

function formatTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 * Builds same-day private class slots. Every extra session begins 30 minutes
 * after the preceding class ends and keeps the original class duration.
 */
export function buildPrivateEventSessionSchedule(input: {
  startTime: string;
  endTime: string;
  sessions: number;
  breakMinutes?: number;
}): PrivateEventSessionSlot[] {
  if (!Number.isInteger(input.sessions) || input.sessions < 1) {
    throw new Error("At least one private-event session is required.");
  }
  const start = parseTime(input.startTime);
  const end = parseTime(input.endTime);
  const duration = end - start;
  if (duration <= 0) throw new Error("The first class must end after it starts on the same day.");
  const breakMinutes = input.breakMinutes ?? 30;
  if (!Number.isInteger(breakMinutes) || breakMinutes < 0) throw new Error("The class break must be a whole number of minutes.");

  return Array.from({ length: input.sessions }, (_, index) => {
    const sessionStart = start + index * (duration + breakMinutes);
    const sessionEnd = sessionStart + duration;
    if (sessionEnd > 24 * 60) {
      throw new Error("All private-event sessions must fit within the selected date.");
    }
    return { startTime: formatTime(sessionStart), endTime: formatTime(sessionEnd) };
  });
}

/**
 * The first Luma class hosts the sole combined checkout. Any following class
 * is part of that paid booking and never receives its own purchasable ticket.
 */
export function buildPrivateEventSessionPlan(input: {
  startTime: string;
  endTime: string;
  sessions: number;
}): PrivateEventSessionPlan[] {
  return buildPrivateEventSessionSchedule(input).map((slot, index) => ({
    ...slot,
    sessionNumber: index + 1,
    paymentMode: index === 0 ? "combined_checkout" : "included",
  }));
}
