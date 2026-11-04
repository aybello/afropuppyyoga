// Byte-identical copies of the three approved APY portraits. Public delivery
// uses the same CDN as the logo, without the managed route's signed redirect.
const PUBLIC_PORTRAITS: Readonly<Record<string, string>> = {
  "/manus-storage/apy_portrait_chow_cuddle_nov01_52f30f49.jpg": "https://files.manuscdn.com/user_upload_by_module/session_file/310519663446228701/zstgfhkhgJOsMcBx.jpg",
  "/manus-storage/apy_portrait_golden_cuddle_oct19_d7e4953e.jpg": "https://files.manuscdn.com/user_upload_by_module/session_file/310519663446228701/tkTWwpxwClsSwSww.jpg",
  "/manus-storage/apy_portrait_two_goldens_oct13_44cd44f3.jpg": "https://files.manuscdn.com/user_upload_by_module/session_file/310519663446228701/sVIpZHnGcGArBGBj.jpg",
};

const RECOVERY_VERSION = "apy-portraits-20261104";

export function publicPortraitUrl(source: string): string {
  return Object.hasOwn(PUBLIC_PORTRAITS, source) ? PUBLIC_PORTRAITS[source] : source;
}

/** Exact known marketing photos only. No arbitrary or private storage lookup. */
export function publicPortraitSources(source: string): readonly string[] {
  if (!Object.hasOwn(PUBLIC_PORTRAITS, source)) return [source];
  return [PUBLIC_PORTRAITS[source], `${source}?v=${RECOVERY_VERSION}`];
}

/** Advance once to the same approved portrait, then stop. */
export function nextPublicPortraitSource(current: string): string | null {
  for (const source of Object.keys(PUBLIC_PORTRAITS)) {
    const [primary, recovery] = publicPortraitSources(source);
    if (current === primary) return recovery;
  }
  return null;
}
