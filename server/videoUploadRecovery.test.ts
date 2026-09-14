import { describe, expect, it, vi } from "vitest";
import { recoverCompletedVideoUpload } from "../client/src/lib/videoUploadRecovery";

describe("recoverCompletedVideoUpload", () => {
  it("recovers the stored video result when a completed upload response is lost", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "completed",
        url: "https://example.invalid/applicant-video.mp4",
        key: "applications/videos/recovered-video.mp4",
      }),
    });

    const result = await recoverCompletedVideoUpload("a".repeat(32), {
      fetchImpl,
      delay: vi.fn().mockResolvedValue(undefined),
    });

    expect(result).toEqual({
      url: "https://example.invalid/applicant-video.mp4",
      key: "applications/videos/recovered-video.mp4",
    });
    expect(fetchImpl).toHaveBeenCalledWith(`/api/upload-video-status/${"a".repeat(32)}`);
  });

  it("waits for a pending server assembly to save its recoverable result", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "processing" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "completed",
          url: "https://example.invalid/applicant-video.mp4",
          key: "applications/videos/recovered-video.mp4",
        }),
      });
    const delay = vi.fn().mockResolvedValue(undefined);

    const result = await recoverCompletedVideoUpload("b".repeat(32), { fetchImpl, delay });

    expect(result?.key).toBe("applications/videos/recovered-video.mp4");
    expect(delay).toHaveBeenCalledTimes(1);
  });

  it("does not treat an expired upload session as a successfully submitted video", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 404 });

    await expect(recoverCompletedVideoUpload("c".repeat(32), { fetchImpl })).resolves.toBeNull();
  });
});
