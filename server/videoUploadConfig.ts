export const VIDEO_UPLOAD_LIMITS = {
  browserChunkSizeBytes: 5 * 1024 * 1024,
  chunkSizeBytes: 6 * 1024 * 1024,
  maxTotalBytes: 500 * 1024 * 1024,
  maxChunks: 200,
  sessionTtlMs: 24 * 60 * 60 * 1000,
  maxConcurrentAssembliesPerInstance: 3,
} as const;

export type UploadShape = {
  chunkSize: number;
  totalChunks: number;
  totalSize: number;
};

export function expectedChunkSize(manifest: UploadShape, chunkIndex: number): number {
  if (chunkIndex < 0 || chunkIndex >= manifest.totalChunks) return 0;
  const offset = chunkIndex * manifest.chunkSize;
  return Math.min(manifest.chunkSize, manifest.totalSize - offset);
}

export function isConsistentUploadShape(
  totalSize: number,
  totalChunks: number,
  chunkSize: number
): boolean {
  return (
    Number.isInteger(totalSize) &&
    totalSize > 0 &&
    totalSize <= VIDEO_UPLOAD_LIMITS.maxTotalBytes &&
    Number.isInteger(chunkSize) &&
    chunkSize > 0 &&
    chunkSize <= VIDEO_UPLOAD_LIMITS.chunkSizeBytes &&
    Number.isInteger(totalChunks) &&
    totalChunks > 0 &&
    totalChunks <= VIDEO_UPLOAD_LIMITS.maxChunks &&
    totalChunks === Math.ceil(totalSize / chunkSize)
  );
}
