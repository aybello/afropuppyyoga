import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildRegularClassTicketTypes,
  createLumaEventForSchedule,
  REGULAR_CLASS_LUMA_EVENT_DEFAULTS,
  torontoDateTimeIso,
  updateLumaEventForSchedule,
} from "./lumaScheduleHelper";

const originalApiKey = process.env.LUMA_API_KEY;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalApiKey === undefined) delete process.env.LUMA_API_KEY;
  else process.env.LUMA_API_KEY = originalApiKey;
});

describe("regular class Luma event defaults", () => {
  it("uses the correct Toronto offset in summer and winter", () => {
    expect(torontoDateTimeIso("2026-07-11", "10:00")).toBe("2026-07-11T10:00:00-04:00");
    expect(torontoDateTimeIso("2026-11-14", "10:00")).toBe("2026-11-14T10:00:00-05:00");
    expect(torontoDateTimeIso("2026-03-08", "10:00")).toBe("2026-03-08T10:00:00-04:00");
    expect(torontoDateTimeIso("2026-11-01", "10:00")).toBe("2026-11-01T10:00:00-05:00");
  });

  it("enables group registration with the cranberry hypnotic presentation", () => {
    expect(REGULAR_CLASS_LUMA_EVENT_DEFAULTS).toEqual({
      can_register_for_multiple_tickets: true,
      tint_color: "#9B2335",
      theme: "hypnotic",
    });
  });

  it("creates only APY paid tickets and never the default free Standard ticket", () => {
    const tickets = buildRegularClassTicketTypes();

    expect(tickets).toHaveLength(13);
    expect(tickets.every((ticket) => ticket.type === "paid")).toBe(true);
    expect(tickets.some((ticket) => ticket.name === "Standard")).toBe(false);
    expect(tickets.some((ticket) => ticket.name.includes("Mat Rental"))).toBe(true);
  });

  it("sends the required registration, appearance, and paid-ticket settings to Luma on creation", async () => {
    process.env.LUMA_API_KEY = "test-key";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "evt_test" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ url: "https://luma.com/test-event" }) });
    vi.stubGlobal("fetch", fetchMock);

    await createLumaEventForSchedule({
      classDate: "2026-11-14",
      location: "Kitchener",
      breed: "Cavapoos",
      startTime: "09:00",
      endTime: "15:00",
      classType: "regular",
    });

    const createPayload = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(createPayload).toMatchObject(REGULAR_CLASS_LUMA_EVENT_DEFAULTS);
    expect(createPayload.ticket_types).toEqual(buildRegularClassTicketTypes());
    expect(createPayload.ticket_types.some((ticket: { name: string }) => ticket.name === "Standard")).toBe(false);
    expect(createPayload.start_at).toBe("2026-11-14T10:00:00-05:00");
    expect(createPayload.end_at).toBe("2026-11-14T14:30:00-05:00");
  });

  it("never creates a public regular-class page for a private event", async () => {
    process.env.LUMA_API_KEY = "test-key";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await createLumaEventForSchedule({ classDate: "2026-11-16", location: "Kitchener", breed: "Cavapoos", startTime: "18:00", endTime: "20:00", classType: "private" });

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("synchronizes date, location, breed and DST-safe time to an existing Luma event", async () => {
    process.env.LUMA_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await updateLumaEventForSchedule("evt_existing", { classDate: "2026-11-14", location: "Hamilton", breed: "Goldens", startTime: "09:00", endTime: "15:00", classType: "regular" });

    const payload = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(payload).toMatchObject({
      event_id: "evt_existing",
      name: "AfroPuppyYoga |📍Hamilton |🐶Goldens",
      start_at: "2026-11-14T10:00:00-05:00",
      end_at: "2026-11-14T14:30:00-05:00",
      timezone: "America/Toronto",
      suppress_notifications: true,
    });
  });
});
