import { describe, expect, it, vi } from "vitest";
import { ensureFreeCalendarRebookingCoupon, rebookingCodeForClassDate } from "./lumaCalendarCoupon";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("calendar-wide cancellation rebooking coupons", () => {
  it("creates a free, unrestricted calendar coupon when the daily code does not exist", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ entries: [], has_more: false }))
      .mockResolvedValueOnce(jsonResponse({
        id: "coup-free",
        code: "AUG29",
        remaining_count: 1_000_000,
        percent_off: 100,
        cents_off: null,
      }));

    const result = await ensureFreeCalendarRebookingCoupon("aug29", { apiKey: "test-key", fetchImpl });

    expect(result).toEqual({ code: "AUG29", couponId: "coup-free", state: "created" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain("/calendars/coupons/list");
    expect(String(fetchImpl.mock.calls[1]?.[0])).toContain("/calendars/coupons/create");
    expect(JSON.parse(String(fetchImpl.mock.calls[1]?.[1]?.body))).toEqual({
      code: "AUG29",
      remaining_count: 1_000_000,
      discount: { discount_type: "percent", percent_off: 100 },
    });
  });

  it("reuses an active free calendar coupon instead of creating a duplicate", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
      entries: [{ id: "coup-existing", code: "AUG29", remaining_count: 4, percent_off: 100, cents_off: null }],
      has_more: false,
    }));

    await expect(ensureFreeCalendarRebookingCoupon("AUG29", { apiKey: "test-key", fetchImpl }))
      .resolves.toEqual({ code: "AUG29", couponId: "coup-existing", state: "reused" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("uses the Ontario class date for the daily rebooking code", () => {
    expect(rebookingCodeForClassDate("2026-08-30T01:30:00.000Z")).toBe("AUG29");
  });
});
