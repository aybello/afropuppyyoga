import { UNAUTHED_ERR_MSG } from "./const";

export type ApyQueryError = {
  message?: string;
  data?: { code?: string };
} | null | undefined;

export function isApyUnauthorizedError(error: ApyQueryError) {
  return error?.message === UNAUTHED_ERR_MSG || error?.data?.code === "UNAUTHORIZED";
}

export function getApyHqSessionRedirect(pathname: string, search = "") {
  if (pathname === "/staff" || pathname.startsWith("/admin/")) {
    return `/staff-access?returnTo=${encodeURIComponent(`${pathname}${search}`)}`;
  }
  return null;
}

export function getSafeApyHqReturnPath(search: string) {
  const requested = new URLSearchParams(search).get("returnTo");
  if (!requested) return "/staff";
  if (requested === "/staff" || requested.startsWith("/admin/")) return requested;
  return "/staff";
}

export function shouldRetryApyQuery(failureCount: number, error: ApyQueryError) {
  if (isApyUnauthorizedError(error)) return false;
  return failureCount < 1;
}
