# Security Hardening Audit Notes

## Phase 1: Luma API Proxy
- File: `server/_core/index.ts` lines 177-203
- Current state: allowlist exists (3 paths), but NO auth check — any unauthenticated user can call `/api/luma/*`
- Fix: Add Express middleware before the proxy that calls `sdk.authenticateRequest(req)` and checks `role === "admin" || role === "staff"`. Return 401/403 on failure.
- Public homepage does NOT use `/api/luma` — it uses direct Luma iframes and `lu.ma` links. Safe to lock down.
- Rate limit: add `lumaProxyLimiter` (e.g. 60 req/min per IP) before the allowlist check
- Fail-safe: if `LUMA_API_KEY` is empty, return 503 immediately

## Phase 2: Applicant file access routes
- File: `server/_core/index.ts`
- `/api/video-url` (line 99): NO auth check — any user can generate presigned video URLs for `applications/` keys
- `/api/video-proxy` (line 115): NO auth check — any user can proxy arbitrary `https://` URLs
- `/api/pdf-proxy` (line 159): restricted to cloudfront domain only — acceptable
- Fix: Add `requireStaffOrAdmin` middleware to `/api/video-url` and `/api/video-proxy`
- Note: `/api/video-proxy` also accepts arbitrary `https://` URLs — should be restricted to CDN domain only (like pdf-proxy)

## Phase 3: Public upload routes
- File: `server/uploadRoute.ts`
- `/api/upload-video`: NO auth, NO rate limit before Multer, 150MB limit, video only — acceptable for public job applications
- `/api/upload-resume`: NO auth, NO rate limit before Multer, 10MB limit — acceptable for public job applications
- `/api/upload-invoice`: NO auth, NO rate limit before Multer, 16MB limit — PROBLEM: invoices should require staff auth
- File: `server/chunkedUploadRoute.ts`
- `/api/upload-video-init`, `/api/upload-video-chunk`, `/api/upload-video-complete`: NO auth, NO rate limit before Multer
- Fix: Add rate limiter BEFORE Multer on all upload routes. Add magic bytes check (first 4 bytes) for video uploads. Add path traversal check on filenames. Require staff auth on `/api/upload-invoice`.

## Phase 4: Staff session revocation
- File: `server/routers/staff.ts`
- `revokeStaff` (line 175): calls `revokeStaffInvite(id)` which sets `isActive = 0` on the invite
- BUT: the staff user's JWT session cookie is still valid for 1 year after revocation
- `authenticateRequest` in `sdk.ts` (line 259): looks up user by openId, does NOT check if the staffInvite is still active
- Fix: In `authenticateRequest`, after getting the user, if `user.role === "staff"`, query `staffInvites` to check `isActive === 1`. If not active, throw ForbiddenError.
- Also: reduce JWT TTL for staff from `ONE_YEAR_MS` to `7 * 24 * 60 * 60 * 1000` (7 days)

## Phase 5: Puppy schedule auth
- File: `server/routers/puppySchedule.ts`
- All 4 procedures use `protectedProcedure` (any logged-in user)
- Fix: Change all to `staffProcedure` (admin or staff only)

## Phase 6: Rate limiter wiring
- File: `server/_core/index.ts` lines 86-91
- Current paths: `birthday.submit`, `partnership.submit` — these are correct tRPC paths
- Need to verify: do these paths actually match the tRPC route names in the routers?
- birthday router is `birthdayRouter` mounted as `birthday` — `birthday.submit` should be correct
- partnership router is `partnershipRouter` mounted as `partnership` — `partnership.submit` should be correct
- Need to test: send a test request to confirm the limiter fires

## Phase 7: Invoice race condition
- File: `server/routers/invoices.ts` lines 25-45
- Problem: `createInvoice()` then `getAllInvoices()[0]` — race condition if two invoices submitted simultaneously
- Fix: Return the inserted ID directly from `createInvoice()` using `db.insert().values().$returningId()` or by querying with the exact S3 key
- Also: `fileUrl` accepts any `z.string().url()` — should validate it starts with the CDN domain
- Also: `fileKey` accepts any string — should validate it starts with `invoices/`

## Phase 8: Lockfile
- Both `package-lock.json` and `pnpm-lock.yaml` exist — remove `package-lock.json`
- Run `pnpm audit` to find vulnerabilities

## Phase 9: Structured data
- File: `server/seoRenderer.ts`
- Hardcoded claims to verify: `$35` price, `4.6` rating, `494` reviews
- Check for expired event schema entries

## Phase 10: GitHub Actions CI
- No `.github/workflows/` directory exists
- Need: frozen install, tsc, tests, build, audit
