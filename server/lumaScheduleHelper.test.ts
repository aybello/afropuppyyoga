import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildRegularClassTicketTypes,
  createLumaEventForSchedule,
  REGULAR_CLASS_LUMA_EVENT_DEFAULTS,
} from "./lumaScheduleHelper";

const originalApiKey = process.env.LUMA_API_KEY;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalApiKey === undefined) delete process.env.LUMA_API_KEY;
  else process.env.LUMA_API_KEY = originalApiKey;
});

describe("regular class Luma event defaults", () => {
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
  });
});
