export type CompletedVideoUpload = {
  url: string;
  key: string;
};

type UploadStatusResponse = {
  status?: string;
  url?: string;
  key?: string;
};

type RecoveryOptions = {
  fetchImpl?: (input: string) => Promise<{ ok: boolean; status?: number; json?: () => Promise<UploadStatusResponse> }>;
  delay?: (milliseconds: number) => Promise<void>;
  attempts?: number;
};

const wait = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

/**
 * Checks the durable upload status written by the server after video assembly.
 * This lets a browser recover if the final assembly response was interrupted
 * after the video had already been safely stored.
 */
export async function recoverCompletedVideoUpload(
  uploadId: string,
  { fetchImpl = (input) => fetch(input), delay = wait, attempts = 6 }: RecoveryOptions = {}
): Promise<CompletedVideoUpload | null> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    let response: { ok: boolean; status?: number; json?: () => Promise<UploadStatusResponse> };
    try {
      response = await fetchImpl(`/api/upload-video-status/${uploadId}`);
    } catch {
      response = { ok: false };
    }

    if (!response.ok || !response.json) return null;

    let result: UploadStatusResponse;
    try {
      result = await response.json();
    } catch {
      return null;
    }

    if (result.status === "completed" && result.url && result.key) {
      return { url: result.url, key: result.key };
    }

    if (result.status !== "processing" && result.status !== "pending") return null;
    if (attempt < attempts - 1) await delay(2_000);
  }

  return null;
}
