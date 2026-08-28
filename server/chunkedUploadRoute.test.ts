import { describe, expect, it } from "vitest";
import {
  VIDEO_UPLOAD_LIMITS,
  expectedChunkSize,
  isConsistentUploadShape,
} from "./videoUploadConfig";
import { isVideoBuffer } from "./videoUploadValidation";

describe("applicant video upload capacity", () => {
  it("supports a full 500MB video within the configured chunk-session limit", () => {
    const browserChunkSize = VIDEO_UPLOAD_LIMITS.browserChunkSizeBytes;
    const chunksForLargestVideo = Math.ceil(VIDEO_UPLOAD_LIMITS.maxTotalBytes / browserChunkSize);

    expect(VIDEO_UPLOAD_LIMITS.maxTotalBytes).toBe(500 * 1024 * 1024);
    expect(chunksForLargestVideo).toBe(100);
    expect(chunksForLargestVideo).toBeLessThanOrEqual(VIDEO_UPLOAD_LIMITS.maxChunks);
    expect(isConsistentUploadShape(
      VIDEO_UPLOAD_LIMITS.maxTotalBytes,
      chunksForLargestVideo,
      browserChunkSize
    )).toBe(true);
  });

  it("keeps resumable upload sessions available for one day", () => {
    expect(VIDEO_UPLOAD_LIMITS.sessionTtlMs).toBe(24 * 60 * 60 * 1000);
  });

  it("rejects a declared chunk count that does not match the file size", () => {
    expect(isConsistentUploadShape(
      12 * 1024 * 1024,
      2,
      VIDEO_UPLOAD_LIMITS.browserChunkSizeBytes
    )).toBe(false);
  });

  it("requires an exact final chunk so assembled bytes cannot exceed the manifest", () => {
    const chunkSize = VIDEO_UPLOAD_LIMITS.browserChunkSizeBytes;
    const manifest = {
      chunkSize,
      totalChunks: 3,
      totalSize: chunkSize * 2 + 1234,
    };

    expect(expectedChunkSize(manifest, 0)).toBe(chunkSize);
    expect(expectedChunkSize(manifest, 1)).toBe(chunkSize);
    expect(expectedChunkSize(manifest, 2)).toBe(1234);
    expect(expectedChunkSize(manifest, 3)).toBe(0);
  });

  it("recognizes a phone-style MP4 header and rejects plain text", () => {
    const mp4Header = Buffer.alloc(40);
    mp4Header.write("ftyp", 4, "ascii");
    mp4Header.write("hvc1", 8, "ascii");

    expect(isVideoBuffer(mp4Header)).toBe(true);
    expect(isVideoBuffer(Buffer.from("this is not a video file"))).toBe(false);
  });
});
