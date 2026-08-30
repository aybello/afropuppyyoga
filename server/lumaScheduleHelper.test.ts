import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildLumaClassInviteMessage,
  buildLumaClassInviteRecipients,
  buildRegularClassTicketTypes,
  createLumaEventForSchedule,
  isEligibleCreatedLumaEventForInvites,
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

  it("uses the approved conservative 4/3/1/7 Fall ladder by location", () => {
    const paidTicketDetails = (location: "Kitchener" | "Hamilton" | "Oakville") =>
      buildRegularClassTicketTypes(location)
        .filter((ticket) => !ticket.name.includes("Mat Rental"))
        .map((ticket) => ({ name: ticket.name.replace(/^(10AM|11:30AM|1:30PM) /, ""), cents: ticket.cents, maxCapacity: ticket.max_capacity }));

    expect(paidTicketDetails("Kitchener").slice(0, 4)).toEqual([
      { name: "Early Bird 🐣❤️", cents: 5600, maxCapacity: 4 },
      { name: "Bring a Friend 👯‍♀️", cents: 10800, maxCapacity: 3 },
      { name: "Group of 3 👯‍♀️", cents: 15600, maxCapacity: 1 },
      { name: "Regular", cents: 5800, maxCapacity: 7 },
    ]);
    expect(paidTicketDetails("Hamilton").slice(0, 4)).toEqual(paidTicketDetails("Kitchener").slice(0, 4));
    expect(paidTicketDetails("Oakville").slice(0, 4)).toEqual([
      { name: "Early Bird 🐣❤️", cents: 6100, maxCapacity: 4 },
      { name: "Bring a Friend 👯‍♀️", cents: 11800, maxCapacity: 3 },
      { name: "Group of 3 👯‍♀️", cents: 17100, maxCapacity: 1 },
      { name: "Regular", cents: 6300, maxCapacity: 7 },
    ]);
  });

  it("sends the required registration, appearance, paid-ticket, and empty-audience settings to Luma on creation", async () => {
    process.env.LUMA_API_KEY = "test-key";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ entries: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "evt_test" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ url: "https://luma.com/test-event", visibility: "public", registration_open: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ entries: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ entries: [] }) });
    vi.stubGlobal("fetch", fetchMock);

    await expect(createLumaEventForSchedule({
      classDate: "2026-11-14",
      location: "Kitchener",
      breed: "Cavapoos",
      startTime: "09:00",
      endTime: "15:00",
      classType: "regular",
    })).resolves.toEqual({
      lumaEventId: "evt_test",
      lumaEventUrl: "https://luma.com/test-event",
      created: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/calendar/list-events");
    const createPayload = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(createPayload).toMatchObject(REGULAR_CLASS_LUMA_EVENT_DEFAULTS);
    expect(createPayload.ticket_types).toEqual(buildRegularClassTicketTypes("Kitchener"));
    expect(createPayload.ticket_types.some((ticket: { name: string }) => ticket.name === "Standard")).toBe(false);
    expect(createPayload.start_at).toBe("2026-11-14T10:00:00-05:00");
    expect(createPayload.end_at).toBe("2026-11-14T14:30:00-05:00");
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/events/guests/send-invites"))).toBe(false);
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

describe("automatic Luma class invitations", () => {
  const params = {
    classDate: "2026-11-14",
    location: "Kitchener",
    breed: "Cavapoos",
    startTime: "09:00",
    endTime: "15:00",
    classType: "regular" as const,
  };

  it("keeps the full Luma event URL and refuses a message that cannot safely fit it", () => {
    const message = buildLumaClassInviteMessage({ ...params, eventUrl: "https://lu.ma/apy-class" });
    expect(message).toContain("https://lu.ma/apy-class");
    expect(message?.length).toBeLessThanOrEqual(200);

    const tooLongUrl = `https://lu.ma/${"a".repeat(240)}`;
    expect(buildLumaClassInviteMessage({ ...params, eventUrl: tooLongUrl })).toBeNull();
  });

  it("uses the owner-approved full calendar audience while excluding registered guests and duplicate addresses", async () => {
    process.env.LUMA_API_KEY = "test-key";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ entries: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "evt_invite" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ url: "https://lu.ma/apy-class", visibility: "public", registration_open: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({
        entries: [
          { email: "  MEMBER@example.com  ", name: "Member One" },
          { contact: { email: "member@example.com", name: "Duplicate Member" } },
          { email: "registered@example.com", name: "Already Going" },
          { email: "new@example.com", first_name: "New", last_name: "Guest" },
        ],
      }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ entries: [{ guest: { email: "REGISTERED@example.com" } }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    await createLumaEventForSchedule(params);

    const inviteCall = fetchMock.mock.calls.find(([url]) => String(url).includes("/events/guests/send-invites"));
    expect(inviteCall).toBeDefined();
    const invitePayload = JSON.parse(inviteCall?.[1].body as string);
    expect(invitePayload).toMatchObject({ event_id: "evt_invite" });
    expect(invitePayload.guests).toEqual([
      { email: "member@example.com", name: "Member One" },
      { email: "new@example.com", name: "New Guest" },
    ]);
    expect(invitePayload.message).toContain("https://lu.ma/apy-class");
    expect(invitePayload.message.length).toBeLessThanOrEqual(200);
  });

  it("reads all paginated audiences before the single invitation submission", async () => {
    process.env.LUMA_API_KEY = "test-key";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ entries: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "evt_paged" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ url: "https://lu.ma/paged", visibility: "public", registration_open: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ entries: [{ email: "first@example.com" }], has_more: true, next_cursor: "contacts-next" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ entries: [], has_more: true, next_cursor: "guests-next" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ entries: [{ email: "second@example.com" }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ entries: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    await createLumaEventForSchedule(params);

    expect(String(fetchMock.mock.calls[5][0])).toContain("pagination_cursor=contacts-next");
    expect(String(fetchMock.mock.calls[6][0])).toContain("pagination_cursor=guests-next");
    const inviteCall = fetchMock.mock.calls.find(([url]) => String(url).includes("/events/guests/send-invites"));
    const invitePayload = JSON.parse(inviteCall?.[1].body as string);
    expect(invitePayload.guests.map((guest: { email: string }) => guest.email)).toEqual(["first@example.com", "second@example.com"]);
  });

  it("does not send when a calendar-contact or guest audit fails", async () => {
    process.env.LUMA_API_KEY = "test-key";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ entries: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "evt_audit_failure" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ url: "https://lu.ma/audit-failure", visibility: "public", registration_open: true }) })
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ entries: [] }) })
      .mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    await createLumaEventForSchedule(params);

    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/events/guests/send-invites"))).toBe(false);
  });

  it("does not invite from a new event that verification marks as private, hidden, cancelled, closed, or sold out", () => {
    expect(isEligibleCreatedLumaEventForInvites({ visibility: "private" })).toBe(false);
    expect(isEligibleCreatedLumaEventForInvites({ visibility: "hidden" })).toBe(false);
    expect(isEligibleCreatedLumaEventForInvites({ cancelled_at: "2026-11-01T12:00:00Z" })).toBe(false);
    expect(isEligibleCreatedLumaEventForInvites({ registration_open: false })).toBe(false);
    expect(isEligibleCreatedLumaEventForInvites({ is_sold_out: true })).toBe(false);
  });

  it("does not request recipients for an event that is not publicly eligible", async () => {
    process.env.LUMA_API_KEY = "test-key";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ entries: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "evt_private" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ url: "https://lu.ma/private", visibility: "private" }) });
    vi.stubGlobal("fetch", fetchMock);

    await createLumaEventForSchedule(params);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/calendars/contacts/list"))).toBe(false);
  });

  it("does not send or read recipients when the verified URL cannot fit in Luma's invite-message limit", async () => {
    process.env.LUMA_API_KEY = "test-key";
    const tooLongUrl = `https://lu.ma/${"x".repeat(240)}`;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ entries: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "evt_long_url" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ url: tooLongUrl, visibility: "public", registration_open: true }) })
      .mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    await createLumaEventForSchedule(params);

    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/calendars/contacts/list"))).toBe(false);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/events/guests/send-invites"))).toBe(false);
  });

  it("never invokes the invitation workflow when an existing public Luma event is reused", async () => {
    process.env.LUMA_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        entries: [{
          event: {
            api_id: "evt_existing",
            name: "AfroPuppyYoga |📍Kitchener |🐶Goldens",
            start_at: "2026-11-14T10:00:00-05:00",
            url: "https://lu.ma/existing",
          },
        }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(createLumaEventForSchedule(params)).resolves.toEqual({
      lumaEventId: "evt_existing",
      lumaEventUrl: "https://lu.ma/existing",
      created: false,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("deduplicates recipient email case-insensitively before any Luma request", () => {
    const recipients = buildLumaClassInviteRecipients(
      [{ email: "a@example.com" }, { email: " A@example.com " }, { email: "invalid" }, { email: "b@example.com" }],
      new Set(["b@example.com"])
    );
    expect(recipients).toEqual([{ email: "a@example.com" }]);
  });
});
