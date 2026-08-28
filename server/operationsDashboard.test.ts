import { describe, expect, it } from "vitest";
import { sortOperationsActions, torontoDate, type OperationsAction } from "./operationsDashboardHelpers";

const action = (id: string, severity: OperationsAction["severity"]): OperationsAction => ({
  id,
  severity,
  title: id,
  detail: `${id} detail`,
  href: `/admin/${id}`,
});

describe("Run APY dashboard helpers", () => {
  it("orders critical tasks before warnings and normal work without mutating input", () => {
    const input = [action("application", "normal"), action("staffing", "critical"), action("texts", "warning")];

    expect(sortOperationsActions(input).map(item => item.id)).toEqual(["staffing", "texts", "application"]);
    expect(input.map(item => item.id)).toEqual(["application", "staffing", "texts"]);
  });

  it("uses the Toronto operating date across UTC date boundaries", () => {
    const justBeforeTorontoMidnight = Date.parse("2026-08-29T03:30:00.000Z");

    expect(torontoDate(0, justBeforeTorontoMidnight)).toBe("2026-08-28");
    expect(torontoDate(1, justBeforeTorontoMidnight)).toBe("2026-08-29");
  });
});
