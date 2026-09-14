type ObjectUrlFactory = Pick<typeof URL, "createObjectURL">;
type ObjectUrlReleaser = Pick<typeof URL, "revokeObjectURL">;

/**
 * Creates a browser-local preview URL for a selected applicant video. The file
 * remains on the applicant's device until they explicitly submit the form.
 */
export function createLocalVideoPreview(file: Blob, urlFactory: ObjectUrlFactory = URL): string {
  return urlFactory.createObjectURL(file);
}

/** Releases a local preview URL when a file is replaced, removed, or the form closes. */
export function releaseLocalVideoPreview(previewUrl: string | null | undefined, urlReleaser: ObjectUrlReleaser = URL): void {
  if (previewUrl) {
    urlReleaser.revokeObjectURL(previewUrl);
  }
}
