import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const read = (relativePath: string) => readFileSync(resolve(root, relativePath), "utf8");

describe("previewed breeder cancellation UI", () => {
  it("uses one shared preview-and-confirm dialog on every APY HQ class deletion surface", () => {
    const sharedDialog = read("client/src/components/BreederCancellationArchiveDialog.tsx");
    const deleteViews = [
      read("client/src/pages/PuppySchedule.tsx"),
      read("client/src/pages/ScheduleCalendar.tsx"),
      read("client/src/components/ScheduleCalendarPanel.tsx"),
    ];

    expect(sharedDialog).toContain("getBreederCancellationPreview.useQuery");
    expect(sharedDialog).toContain("archiveWithBreederCancellationNotice.useMutation");
    expect(sharedDialog).toContain("Email preview");
    expect(sharedDialog).toContain("Text preview");
    expect(sharedDialog).toContain("Archive class & notify breeder");
    for (const source of deleteViews) {
      expect(source).toContain("BreederCancellationArchiveDialog");
      expect(source).not.toContain("deleteMutation.mutate({ id: deleteId })");
    }
  });
});
