import { describe, expect, it } from "vitest";
import {
  LUMA_CALENDAR_EMBED_URL,
  LUMA_CALENDAR_LOAD_MARGIN,
  shouldActivateLumaCalendar,
} from "../shared/lumaCalendarEmbed";

describe("public Luma calendar loading", () => {
  it("keeps the calendar on-demand until the visitor approaches or requests it", () => {
    expect(shouldActivateLumaCalendar(false, false)).toBe(false);
    expect(shouldActivateLumaCalendar(true, false)).toBe(true);
    expect(shouldActivateLumaCalendar(false, true)).toBe(true);
  });

  it("uses the live light-theme Luma calendar and a near-view load margin", () => {
    expect(LUMA_CALENDAR_EMBED_URL).toContain("https://lu.ma/embed/calendar/");
    expect(LUMA_CALENDAR_EMBED_URL).toContain("theme=light");
    expect(LUMA_CALENDAR_LOAD_MARGIN).toBe("400px 0px");
  });
});
