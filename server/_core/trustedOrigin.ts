export function getTrustedAppOrigin(requestedOrigin?: string): string {
  if (process.env.NODE_ENV !== "production" && requestedOrigin) {
    try {
      const parsed = new URL(requestedOrigin);
      if (["localhost", "127.0.0.1"].includes(parsed.hostname)) return parsed.origin;
    } catch {
      // Invalid origins use the production application URL.
    }
  }
  return "https://afropuppyyoga.ca";
}
