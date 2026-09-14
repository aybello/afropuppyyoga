import { describe, expect, it, vi } from "vitest";
import { createLocalVideoPreview, releaseLocalVideoPreview } from "../client/src/lib/localVideoPreview";

describe("local applicant video preview", () => {
  it("creates a browser-local preview URL without uploading the selected file", () => {
    const createObjectURL = vi.fn(() => "blob:applicant-video-preview");
    const previewUrl = createLocalVideoPreview(new Blob(["preview"]), { createObjectURL });

    expect(previewUrl).toBe("blob:applicant-video-preview");
    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });

  it("releases preview URLs when an applicant replaces or removes a selected video", () => {
    const revokeObjectURL = vi.fn();

    releaseLocalVideoPreview("blob:applicant-video-preview", { revokeObjectURL });
    releaseLocalVideoPreview(null, { revokeObjectURL });

    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:applicant-video-preview");
  });
});
