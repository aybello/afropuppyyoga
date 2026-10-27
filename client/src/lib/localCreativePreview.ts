type ObjectUrlFactory = Pick<typeof URL, "createObjectURL">;
type ObjectUrlReleaser = Pick<typeof URL, "revokeObjectURL">;

/** Creates a browser-local preview; a file is not uploaded merely to be previewed. */
export function createLocalCreativePreview(file: Blob, urlFactory: ObjectUrlFactory = URL): string {
  return urlFactory.createObjectURL(file);
}

/** Releases a local campaign-media preview URL when it is replaced, removed, or the page unmounts. */
export function releaseLocalCreativePreview(previewUrl: string | null | undefined, urlReleaser: ObjectUrlReleaser = URL): void {
  if (previewUrl) urlReleaser.revokeObjectURL(previewUrl);
}
