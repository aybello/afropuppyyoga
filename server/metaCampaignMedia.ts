import { mkdtemp, open, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import ffprobeStatic from "ffprobe-static";
import {
  isMetaPlacementAspectRatio,
  META_CAMPAIGN_MAX_IMAGE_BYTES,
  META_CAMPAIGN_MAX_VIDEO_BYTES,
  META_CAMPAIGN_MAX_VIDEO_SECONDS,
  META_CAMPAIGN_MIN_VIDEO_SECONDS,
} from "../shared/metaCampaigns";

const execFileAsync = promisify(execFile);

export type CampaignMediaKind = "image" | "video";
export type CampaignMediaMetadata = {
  kind: CampaignMediaKind;
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "video/mp4" | "video/quicktime";
  extension: "jpg" | "png" | "webp" | "mp4" | "mov";
  width: number;
  height: number;
  durationSeconds: number | null;
};

export type CampaignMediaValidation =
  | { ok: true; metadata: CampaignMediaMetadata }
  | { ok: false; message: string };

function readUInt24LE(buffer: Buffer, offset: number): number {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

function readImageMetadata(buffer: Buffer): CampaignMediaValidation {
  // PNG IHDR
  if (buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) && buffer.subarray(12, 16).toString("ascii") === "IHDR") {
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return imageResult("image/png", "png", width, height);
  }

  // JPEG SOF markers
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) return { ok: false, message: "Image file is corrupted." };
      const marker = buffer[offset + 1];
      offset += 2;
      if (marker === 0xd8 || marker === 0xd9) continue;
      if (offset + 2 > buffer.length) break;
      const length = buffer.readUInt16BE(offset);
      if (length < 2 || offset + length > buffer.length) break;
      const isSof = marker >= 0xc0 && marker <= 0xc3 || marker >= 0xc5 && marker <= 0xc7 || marker >= 0xc9 && marker <= 0xcb || marker >= 0xcd && marker <= 0xcf;
      if (isSof && length >= 7) {
        const height = buffer.readUInt16BE(offset + 3);
        const width = buffer.readUInt16BE(offset + 5);
        return imageResult("image/jpeg", "jpg", width, height);
      }
      offset += length;
    }
    return { ok: false, message: "Image dimensions could not be read." };
  }

  // WebP RIFF container: VP8X, VP8L and VP8 lossy headers.
  if (buffer.length >= 30 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    const kind = buffer.subarray(12, 16).toString("ascii");
    if (kind === "VP8X" && buffer.length >= 30) {
      const width = 1 + readUInt24LE(buffer, 24);
      const height = 1 + readUInt24LE(buffer, 27);
      return imageResult("image/webp", "webp", width, height);
    }
    if (kind === "VP8L" && buffer.length >= 25 && buffer[20] === 0x2f) {
      const bits = buffer.readUInt32LE(21);
      const width = 1 + (bits & 0x3fff);
      const height = 1 + ((bits >> 14) & 0x3fff);
      return imageResult("image/webp", "webp", width, height);
    }
    if (kind === "VP8 " && buffer.length >= 30 && buffer[23] === 0x9d && buffer[24] === 0x01 && buffer[25] === 0x2a) {
      const width = buffer.readUInt16LE(26) & 0x3fff;
      const height = buffer.readUInt16LE(28) & 0x3fff;
      return imageResult("image/webp", "webp", width, height);
    }
    return { ok: false, message: "WebP image dimensions could not be read." };
  }

  return { ok: false, message: "Only valid JPEG, PNG, or WebP images are supported." };
}

function hasImageSignature(buffer: Buffer): boolean {
  return (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    || (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xd8)
    || (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP");
}

function isSupportedMp4MovBuffer(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  for (let offset = 0; offset <= 32 && offset + 11 < buffer.length; offset += 4) {
    if (buffer.subarray(offset + 4, offset + 8).toString("ascii") !== "ftyp") continue;
    const brand = buffer.subarray(offset + 8, offset + 12).toString("ascii");
    return brand === "qt  " || ["isom", "iso2", "iso4", "iso5", "iso6", "avc1", "mp41", "mp42", "M4V ", "f4v ", "hvc1", "hev1", "hevc"].includes(brand);
  }
  return false;
}

function imageResult(mimeType: CampaignMediaMetadata["mimeType"], extension: CampaignMediaMetadata["extension"], width: number, height: number): CampaignMediaValidation {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) return { ok: false, message: "Image dimensions are invalid." };
  if (!isMetaPlacementAspectRatio(width, height)) {
    return { ok: false, message: "Images need to be at least 600px wide and high, with an aspect ratio from 4:5 to 1.91:1." };
  }
  return { ok: true, metadata: { kind: "image", mimeType, extension, width, height, durationSeconds: null } };
}

async function readVideoMetadata(buffer: Buffer): Promise<CampaignMediaValidation> {
  if (!isSupportedMp4MovBuffer(buffer)) return { ok: false, message: "Only valid MP4 or MOV videos are supported." };
  const directory = await mkdtemp(join(tmpdir(), "apy-campaign-media-"));
  const inputPath = join(directory, "creative.mp4");
  try {
    await writeFile(inputPath, buffer, { flag: "wx" });
    const { stdout } = await execFileAsync(ffprobeStatic.path, [
      "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_type,width,height:format=duration", "-of", "json", inputPath,
    ], { timeout: 15_000, maxBuffer: 512 * 1024 });
    const payload = JSON.parse(stdout) as { streams?: Array<{ codec_type?: string; width?: number; height?: number }>; format?: { duration?: string } };
    const stream = payload.streams?.find(item => item.codec_type === "video");
    const width = stream?.width ?? 0;
    const height = stream?.height ?? 0;
    const duration = Number(payload.format?.duration);
    if (!stream || !Number.isFinite(duration) || duration <= 0) return { ok: false, message: "Video has no readable video stream." };
    if (duration < META_CAMPAIGN_MIN_VIDEO_SECONDS || duration > META_CAMPAIGN_MAX_VIDEO_SECONDS) {
      return { ok: false, message: `Videos must be ${META_CAMPAIGN_MIN_VIDEO_SECONDS} to ${META_CAMPAIGN_MAX_VIDEO_SECONDS} seconds long.` };
    }
    if (!isMetaPlacementAspectRatio(width, height)) {
      return { ok: false, message: "Videos need to be at least 600px wide and high, with an aspect ratio from 4:5 to 1.91:1." };
    }
    const majorBrand = buffer.subarray(8, 12).toString("ascii");
    return {
      ok: true,
      metadata: {
        kind: "video",
        mimeType: majorBrand === "qt  " ? "video/quicktime" : "video/mp4",
        extension: majorBrand === "qt  " ? "mov" : "mp4",
        width,
        height,
        durationSeconds: Math.round(duration * 100) / 100,
      },
    };
  } catch {
    return { ok: false, message: "Video metadata could not be read. Please use a standard MP4 or MOV file." };
  } finally {
    await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function inspectCampaignMedia(buffer: Buffer): Promise<CampaignMediaValidation> {
  if (buffer.length === 0) return { ok: false, message: "The selected file is empty." };
  const image = readImageMetadata(buffer);
  if (hasImageSignature(buffer)) {
    if (buffer.length > META_CAMPAIGN_MAX_IMAGE_BYTES) return { ok: false, message: "Images must be 20MB or smaller." };
    return image;
  }
  if (isSupportedMp4MovBuffer(buffer)) {
    if (buffer.length > META_CAMPAIGN_MAX_VIDEO_BYTES) return { ok: false, message: "Videos must be 250MB or smaller." };
    return readVideoMetadata(buffer);
  }
  return { ok: false, message: "Only JPEG, PNG, WebP, MP4, and MOV files are supported." };
}

async function readFilePrefix(filePath: string, maxBytes = 1_048_576): Promise<Buffer> {
  const handle = await open(filePath, "r");
  try {
    const output = Buffer.alloc(maxBytes);
    const { bytesRead } = await handle.read(output, 0, maxBytes, 0);
    return output.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

/** Inspect a Multer disk file without loading a 250MB video into Node's heap. */
export async function inspectCampaignMediaFile(filePath: string): Promise<CampaignMediaValidation> {
  const info = await stat(filePath);
  if (info.size === 0) return { ok: false, message: "The selected file is empty." };
  const header = await readFilePrefix(filePath);
  const image = readImageMetadata(header);
  if (hasImageSignature(header)) {
    if (info.size > META_CAMPAIGN_MAX_IMAGE_BYTES) return { ok: false, message: "Images must be 20MB or smaller." };
    return image;
  }
  if (!isSupportedMp4MovBuffer(header)) return { ok: false, message: "Only JPEG, PNG, WebP, MP4, and MOV files are supported." };
  if (info.size > META_CAMPAIGN_MAX_VIDEO_BYTES) return { ok: false, message: "Videos must be 250MB or smaller." };
  try {
    const { stdout } = await execFileAsync(ffprobeStatic.path, [
      "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_type,width,height:format=duration", "-of", "json", filePath,
    ], { timeout: 15_000, maxBuffer: 512 * 1024 });
    const payload = JSON.parse(stdout) as { streams?: Array<{ codec_type?: string; width?: number; height?: number }>; format?: { duration?: string } };
    const stream = payload.streams?.find(item => item.codec_type === "video");
    const width = stream?.width ?? 0;
    const height = stream?.height ?? 0;
    const duration = Number(payload.format?.duration);
    if (!stream || !Number.isFinite(duration) || duration <= 0) return { ok: false, message: "Video has no readable video stream." };
    if (duration < META_CAMPAIGN_MIN_VIDEO_SECONDS || duration > META_CAMPAIGN_MAX_VIDEO_SECONDS) return { ok: false, message: `Videos must be ${META_CAMPAIGN_MIN_VIDEO_SECONDS} to ${META_CAMPAIGN_MAX_VIDEO_SECONDS} seconds long.` };
    if (!isMetaPlacementAspectRatio(width, height)) return { ok: false, message: "Videos need to be at least 600px wide and high, with an aspect ratio from 4:5 to 1.91:1." };
    const majorBrand = header.subarray(8, 12).toString("ascii");
    return { ok: true, metadata: { kind: "video", mimeType: majorBrand === "qt  " ? "video/quicktime" : "video/mp4", extension: majorBrand === "qt  " ? "mov" : "mp4", width, height, durationSeconds: Math.round(duration * 100) / 100 } };
  } catch {
    return { ok: false, message: "Video metadata could not be read. Please use a standard MP4 or MOV file." };
  }
}

export function safeCampaignFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/\.{2,}/g, "_").slice(0, 128) || "creative";
}
