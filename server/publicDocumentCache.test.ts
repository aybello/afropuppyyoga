import { describe, expect, it } from "vitest";
import {
  getDocumentCacheControl,
  PRIVATE_DOCUMENT_CACHE_CONTROL,
  PUBLIC_DOCUMENT_CACHE_CONTROL,
} from "./publicDocumentCache";

describe("public document cache policy", () => {
  it("allows anonymous public marketing pages to use shared stale-while-revalidate caching", () => {
    expect(getDocumentCacheControl("/")).toBe(PUBLIC_DOCUMENT_CACHE_CONTROL);
    expect(getDocumentCacheControl("/puppy-yoga-kitchener")).toBe(
      PUBLIC_DOCUMENT_CACHE_CONTROL
    );
    expect(getDocumentCacheControl("/careers?source=instagram")).toBe(
      PUBLIC_DOCUMENT_CACHE_CONTROL
    );
  });

  it("never applies shared document caching to APY HQ, access, signing, invoice, review, or API paths", () => {
    [
      "/admin/employees",
      "/api/trpc/staffAvailability.listEmployees",
      "/staff",
      "/staff-access",
      "/staff-login",
      "/sign/token-123",
      "/invoice-submit",
      "/review/abc123",
    ].forEach(pathname => {
      expect(getDocumentCacheControl(pathname)).toBe(PRIVATE_DOCUMENT_CACHE_CONTROL);
    });
  });
});
