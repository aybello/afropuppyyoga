import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const calendarSource = readFileSync(
  resolve(import.meta.dirname, "../client/src/components/ScheduleCalendarPanel.tsx"),
  "utf8",
);
const breederDashboardSource = readFileSync(
  resolve(import.meta.dirname, "../client/src/pages/BreedersDashboard.tsx"),
  "utf8",
);

describe("calendar breeder confirmation integration", () => {
  it("launches the detailed confirmation workflow instead of the retired email-only calendar mutation", () => {
    expect(calendarSource).toContain("onOpenBreederConfirmation");
    expect(calendarSource).toContain("handleOpenBreederConfirmation");
    expect(calendarSource).not.toContain("notifyBreeder.useMutation");
    expect(breederDashboardSource).toContain("onOpenBreederConfirmation={openCalendarConfirmation}");
  });

  it("marks calendar-originated confirmation requests so the shared server path preserves the existing class", () => {
    expect(breederDashboardSource).toContain("existingScheduleId: calendarConfirmationScheduleId ?? undefined");
    expect(breederDashboardSource).toContain("setCalendarConfirmationScheduleId(slot.id)");
    expect(breederDashboardSource).toContain("disabled={calendarConfirmationScheduleId !== null}");
  });
});
