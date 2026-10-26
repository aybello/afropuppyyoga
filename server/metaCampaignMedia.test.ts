import { describe, expect, it } from "vitest";
import { inspectCampaignMedia, safeCampaignFilename } from "./metaCampaignMedia";

function png(width: number, height: number): Buffer {
  const out = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(out, 0);
  out.write("IHDR", 12, "ascii");
  out.writeUInt32BE(width, 16);
  out.writeUInt32BE(height, 20);
  return out;
}

describe("campaign media validation", () => {
  it("accepts a Meta-placement-compatible PNG and returns its metadata", async () => {
    await expect(inspectCampaignMedia(png(1080, 1080))).resolves.toEqual(expect.objectContaining({
      ok: true,
      metadata: expect.objectContaining({ kind: "image", width: 1080, height: 1080, mimeType: "image/png" }),
    }));
  });

  it("rejects an image that is too small", async () => {
    await expect(inspectCampaignMedia(png(599, 599))).resolves.toEqual(expect.objectContaining({ ok: false, message: expect.stringContaining("600px") }));
  });

  it("rejects non-media bytes rather than trusting a filename", async () => {
    await expect(inspectCampaignMedia(Buffer.from("not an image or video"))).resolves.toEqual(expect.objectContaining({ ok: false }));
  });

  it("sanitizes a user filename without retaining traversal characters", () => {
    expect(safeCampaignFilename("../../promo <script>.png")).toBe("____promo__script_.png");
  });
});
