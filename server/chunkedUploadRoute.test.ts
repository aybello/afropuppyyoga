import { describe, expect, it } from "vitest";
import { VIDEO_UPLOAD_LIMITS } from "./chunkedUploadRoute";

describe("applicant video upload capacity", () => {
  it("supports a full 500MB video within the configured chunk-session limit", () => {
    const browserChunkSize = 5 * 1024 * 1024;
    const chunksForLargestVideo = Math.ceil(VIDEO_UPLOAD_LIMITS.maxTotalBytes / browserChunkSize);

    expect(VIDEO_UPLOAD_LIMITS.maxTotalBytes).toBe(500 * 1024 * 1024);
    expect(chunksForLargestVideo).toBe(100);
    expect(chunksForLargestVideo).toBeLessThanOrEqual(VIDEO_UPLOAD_LIMITS.maxChunks);
  });

  it("keeps resumable upload sessions available for one day", () => {
    expect(VIDEO_UPLOAD_LIMITS.sessionTtlMs).toBe(24 * 60 * 60 * 1000);
  });
});
