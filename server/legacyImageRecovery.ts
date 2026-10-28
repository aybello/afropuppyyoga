const MANAGED = "/manus-storage/";

const KITCHENER_LEGACY_IMAGES = [
  "IMG_0657_84447a5e.jpg",
  "IMG_0678_3441ad46.jpg",
  "IMG_1121_59eac423.jpg",
  "IMG_0892_6bf1345a.jpg",
  "IMG_0865_5d67a419.jpg",
  "IMG_9003_901821b0.jpg",
  "IMG_8944_79a0d5de.jpg",
  "IMG_8613_744d02c1.jpg",
  "IMG_8573_464bace7.jpg",
] as const;

const KITCHENER_RESTORED_IMAGES = [
  "apy_kitchener_01_be82fd91.jpg",
  "apy_kitchener_02_e96ccd1f.jpg",
  "apy_kitchener_03_98a3dc92.jpg",
  "apy_kitchener_04_f0ee333e.jpg",
  "apy_kitchener_05_9a53f2d4.jpg",
  "apy_kitchener_06_a11f167a.jpg",
  "apy_kitchener_07_927d18f3.jpg",
  "apy_kitchener_08_68c9b289.jpg",
  "apy_kitchener_09_a602301b.jpg",
] as const;

const SHARED_LEGACY_IMAGES = [
  "ham_oak_IMG_3209_d7f2d0c0.jpg",
  "ham_oak_IMG_2020_bb38b4e3.jpg",
  "ham_oak_IMG_7923_87d8073f.jpg",
  "ham_oak_IMG_3785_6a9e3699.jpg",
  "ham_oak_IMG_4663_bee61155.jpg",
  "ham_oak_IMG_3338_bcc391a0.jpg",
  "ham_oak_IMG_6465_25b2d5a8.jpg",
  "ham_oak_SAM06140_bdf088f2.jpg",
  "ham_oak_IMG_3627_6584a1af.jpg",
  "ham_oak_IMG_8624_621fe5bf.jpg",
] as const;

const HAMILTON_RESTORED_IMAGES = [
  "apy_hamilton_01_7eb2d831.jpg",
  "apy_hamilton_02_9988ec38.jpg",
  "apy_hamilton_03_f2f5d54e.jpg",
  "apy_hamilton_04_e6d3a3ec.jpg",
  "apy_hamilton_05_49dbd964.jpg",
  "apy_hamilton_06_2f7917c8.jpg",
  "apy_hamilton_07_69b39dc5.jpg",
  "apy_hamilton_08_f829b0cf.jpg",
  "apy_hamilton_09_0509434b.jpg",
] as const;

const OAKVILLE_RESTORED_IMAGES = [
  "apy_oakville_01_53c61421.jpg",
  "apy_oakville_02_5e215788.jpg",
  "apy_oakville_03_6e1d8088.jpg",
  "apy_oakville_04_9dae40cb.jpg",
  "apy_oakville_05_c8c23baf.jpg",
  "apy_oakville_06_9d9681f7.jpg",
  "apy_oakville_07_8aaf0e91.jpg",
  "apy_oakville_08_e580c39b.jpg",
  "apy_oakville_09_8bd7bc37.jpg",
] as const;

function managed(filename: string) {
  return `${MANAGED}${filename}`;
}

function isOakvilleReferrer(referrer: string | undefined) {
  try {
    return new URL(referrer ?? "https://afropuppyyoga.ca/").pathname.includes("puppy-yoga-oakville");
  } catch {
    return false;
  }
}

/**
 * Restores images for visitors whose browser still executes a pre-repair JavaScript bundle.
 * New bundles use only the restored URLs. This mapping can be removed after stale client
 * bundles age out of browser caches.
 */
export function getLegacyImageRecoveryTarget(pathname: string, referrer?: string): string | null {
  if (!pathname.startsWith(MANAGED)) return null;

  const filename = pathname.slice(MANAGED.length);
  const kitchenerIndex = KITCHENER_LEGACY_IMAGES.indexOf(filename as never);
  if (kitchenerIndex >= 0) return managed(KITCHENER_RESTORED_IMAGES[kitchenerIndex]);

  const sharedIndex = SHARED_LEGACY_IMAGES.indexOf(filename as never);
  if (sharedIndex >= 0) {
    const restored = isOakvilleReferrer(referrer)
      ? OAKVILLE_RESTORED_IMAGES[Math.min(sharedIndex, OAKVILLE_RESTORED_IMAGES.length - 1)]
      : HAMILTON_RESTORED_IMAGES[Math.min(sharedIndex, HAMILTON_RESTORED_IMAGES.length - 1)];
    return managed(restored);
  }

  switch (filename) {
    case "corporate_hero_95e52cfc.jpg":
    case "afropuppyyoga-hero_3919ee3c.webp":
    case "og_image_apy.jpg":
      return managed("apy_corporate_hero_202ea280.jpg");
    case "private-events-hero_72e6b8e7.jpg":
      return managed("apy_private_events_hero_43ef0f7d.jpg");
    default:
      return null;
  }
}
