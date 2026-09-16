import { afterEach, describe, expect, it, vi } from "vitest";
import { createLumaEventForSchedule, findExistingLumaScheduleEvent } from "./lumaScheduleHelper";

describe("Luma schedule duplicate prevention", () => {
  const schedule = {
    classDate: "2026-09-20",
    location: "Kitchener",
    breed: "Huskies",
    startTime: "09:30",
    endTime: "15:30",
    classType: "regular" as const,
  };

  it("reuses the APY Luma event already scheduled for the same Toronto date and studio", () => {
    const existing = findExistingLumaScheduleEvent([
      {
        api_id: "evt_existing_kitchener",
        name: "AfroPuppyYoga |📍Kitchener |🐶Golden Retrievers",
        start_at: "2026-09-20T10:00:00-04:00",
      },
    ], schedule);

    expect(existing).toEqual({
      lumaEventId: "evt_existing_kitchener",
      lumaEventUrl: "https://lu.ma/evt_existing_kitchener",
    });
  });

  it("does not reuse a similarly named event at a different studio or on another date", () => {
    const existing = findExistingLumaScheduleEvent([
      {
        api_id: "evt_other_date",
        name: "AfroPuppyYoga |📍Kitchener |🐶Huskies",
        start_at: "2026-09-27T10:00:00-04:00",
      },
      {
        api_id: "evt_other_studio",
        name: "AfroPuppyYoga |📍Hamilton |🐶Huskies",
        start_at: "2026-09-20T10:00:00-04:00",
      },
    ], schedule);

    expect(existing).toBeNull();
  });

  it("checks the live calendar and returns the matching event without creating another one", async () => {
    const originalApiKey = process.env.LUMA_API_KEY;
    process.env.LUMA_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        entries: [{
          event: {
            api_id: "evt_existing_kitchener",
            name: "AfroPuppyYoga |📍Kitchener |🐶Golden Retrievers",
            start_at: "2026-09-20T10:00:00-04:00",
          },
        }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    try {
      await expect(createLumaEventForSchedule(schedule)).resolves.toEqual({
        lumaEventId: "evt_existing_kitchener",
        lumaEventUrl: "https://lu.ma/evt_existing_kitchener",
        created: false,
      });
      expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/calendar/list-events"))).toBe(true);
      expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/events/create"))).toBe(false);
    } finally {
      vi.unstubAllGlobals();
      if (originalApiKey === undefined) delete process.env.LUMA_API_KEY;
      else process.env.LUMA_API_KEY = originalApiKey;
    }
  });

  it("does not create a class when the live calendar duplicate check cannot be completed", async () => {
    const originalApiKey = process.env.LUMA_API_KEY;
    process.env.LUMA_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    vi.stubGlobal("fetch", fetchMock);

    try {
      await expect(createLumaEventForSchedule(schedule)).resolves.toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/calendar/list-events");
    } finally {
      vi.unstubAllGlobals();
      if (originalApiKey === undefined) delete process.env.LUMA_API_KEY;
      else process.env.LUMA_API_KEY = originalApiKey;
    }
  });
});
