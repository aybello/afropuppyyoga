import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const read = (relativePath: string) => readFileSync(resolve(root, relativePath), "utf8");

describe("previewed breeder replacement UI", () => {
  it("uses one shared preview-and-confirm dialog on every APY HQ class edit surface", () => {
    const sharedDialog = read("client/src/components/BreederReplacementDialog.tsx");
    const editViews = [
      read("client/src/pages/PuppySchedule.tsx"),
      read("client/src/pages/ScheduleCalendar.tsx"),
      read("client/src/components/ScheduleCalendarPanel.tsx"),
    ];

    expect(sharedDialog).toContain("getBreederReplacementPreview.useQuery");
    expect(sharedDialog).toContain("replaceBreederWithNotice.useMutation");
    expect(sharedDialog).toContain("Luma event remains active");
    expect(sharedDialog).toContain("Replace breeder & notify outgoing breeder");
    expect(sharedDialog).toContain("No customer message is sent.");
    for (const source of editViews) {
      expect(source).toContain("BreederReplacementDialog");
      expect(source).toContain("originalBreederId !== null && originalBreederId !== form.breederId");
      expect(source).toContain("setReplacementRequest");
    }
  });
});
