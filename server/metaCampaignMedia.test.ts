import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { inspectCampaignMedia, inspectCampaignMediaFile, safeCampaignFilename } from "./metaCampaignMedia";

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

  it("inspects a disk-backed creative without a Multer memory buffer", async () => {
    const directory = await mkdtemp(join(tmpdir(), "apy-campaign-test-"));
    const file = join(directory, "creative.png");
    try {
      await writeFile(file, png(1080, 1080));
      await expect(inspectCampaignMediaFile(file)).resolves.toEqual(expect.objectContaining({ ok: true, metadata: expect.objectContaining({ kind: "image", width: 1080 }) }));
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("sanitizes a user filename without retaining traversal characters", () => {
    expect(safeCampaignFilename("../../promo <script>.png")).toBe("____promo__script_.png");
  });
});
