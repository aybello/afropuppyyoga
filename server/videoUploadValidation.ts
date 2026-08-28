// Magic-byte validation shared by the direct and chunked applicant-video routes.

const VIDEO_SIGNATURES: Array<{ bytes: number[] }> = [
  { bytes: [0x1a, 0x45, 0xdf, 0xa3] },                          // WebM / MKV
  { bytes: [0x52, 0x49, 0x46, 0x46] },                          // AVI (RIFF)
  { bytes: [0x00, 0x00, 0x00, 0x08, 0x77, 0x69, 0x64, 0x65] }, // QuickTime wide
];

const FTYP_BRANDS = [
  "isom", "iso2", "iso4", "iso5", "iso6", "avc1", "mp41", "mp42",
  "qt  ", "M4V ", "M4A ", "f4v ",
  "hvc1", "hev1", "hevc", "mif1", "msf1", "miaf", "heic",
  "3gp5", "3gp6", "3g2a",
];

/**
 * Check common MP4/MOV, WebM/MKV, and AVI container signatures.
 * The ftyp box scan accepts new printable brands so newer phones are not
 * accidentally blocked while obviously non-video uploads are rejected.
 */
export function isVideoBuffer(buf: Buffer): boolean {
  if (buf.length < 8) return false;

  for (let offset = 0; offset <= 32 && offset + 11 < buf.length; offset += 4) {
    if (
      buf[offset + 4] === 0x66 &&
      buf[offset + 5] === 0x74 &&
      buf[offset + 6] === 0x79 &&
      buf[offset + 7] === 0x70
    ) {
      const brand = buf.subarray(offset + 8, offset + 12).toString("ascii");
      if (FTYP_BRANDS.includes(brand) || /^[a-zA-Z0-9 ]{4}$/.test(brand)) {
        return true;
      }
    }
  }

  return VIDEO_SIGNATURES.some((signature) =>
    signature.bytes.every((byte, index) => buf[index] === byte)
  );
}
