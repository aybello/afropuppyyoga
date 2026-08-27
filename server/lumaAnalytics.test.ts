import { describe, expect, it } from "vitest";
import { getLumaAttendance, lumaTestUtils } from "./lumaAnalytics";

describe("Luma attendance analytics", () => {
  it("converts ticket bundles into actual seats and excludes mat rentals", () => {
    expect(lumaTestUtils.ticketSeats("Bring a Friend 👯‍♀️")).toBe(2);
    expect(lumaTestUtils.ticketSeats("Group of 3")).toBe(3);
    expect(lumaTestUtils.ticketSeats("Mat Rental")).toBe(0);
    expect(lumaTestUtils.ticketSeats("Early Bird")).toBe(1);
  });

  it("paginates events and guests and keeps guests attached to their event", async () => {
    const requested: URL[] = [];
    const fakeFetch = async (input: string | URL | Request) => {
      const url = new URL(String(input));
      requested.push(url);
      let body: unknown;
      if (url.pathname.endsWith("/calendars/events/list")) {
        body = url.searchParams.has("pagination_cursor")
          ? { entries: [{ id: "evt_2", name: "Oakville", start_at: "2026-08-02T10:00:00Z" }], has_more: false }
          : { entries: [{ id: "evt_1", name: "Kitchener", start_at: "2026-08-01T10:00:00Z" }], has_more: true, next_cursor: "events_2" };
      } else {
        const eventId = url.searchParams.get("event_id");
        body = eventId === "evt_1"
          ? { entries: [{ event_tickets: [{ name: "Bring a Friend", checked_in_at: "2026-08-01" }, { name: "Mat Rental" }] }], has_more: false }
          : { entries: [{ event_tickets: [{ name: "Group of 3", checked_in_at: null }] }], has_more: false };
      }
      return new Response(JSON.stringify(body), { status: 200 });
    };

    const result = await getLumaAttendance("test", "2026-08-01T00:00:00Z", fakeFetch as typeof fetch);
    expect(result.totalEvents).toBe(2);
    expect(result.totalRegistrations).toBe(2);
    expect(result.totalGuests).toBe(5);
    expect(result.totalCheckedIn).toBe(2);
    expect(requested.some(url => url.searchParams.get("pagination_cursor") === "events_2")).toBe(true);
    expect(requested.filter(url => url.pathname.endsWith("/events/guests/list")).map(url => url.searchParams.get("event_id")).sort()).toEqual(["evt_1", "evt_2"]);
  });
});
