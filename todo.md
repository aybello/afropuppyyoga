
## Staff Invoice Portal
- [x] Add invoices table to drizzle schema (id, staffName, position, payAmount, dueDate, fileUrl, fileKey, status, extractedAt, createdAt)
- [x] Add tRPC procedure: uploadInvoice (upload PDF to S3, trigger AI extraction)
- [x] Add tRPC procedure: getInvoices (owner-only, returns all invoices with days left)
- [x] Add tRPC procedure: updateInvoiceStatus (owner marks as paid/pending)
- [x] Build /invoice-submit page for staff (PDF upload form, no auth required or basic auth)
- [x] Build /admin/invoices page for owner (table with name, position, pay, due date, days left, status)
- [x] AI extraction using LLM to parse PDF text for name, position, pay amount, due date
- [x] Color-code days left (red = overdue, orange = <7 days, green = safe)
- [x] Add invoice portal link to navbar/admin area

## Invoice Pages Redesign
- [x] Restyle InvoiceSubmit.tsx to match APY brand (warm cream bg, APY fonts, hot pink accents, Navbar/Footer)
- [x] Restyle InvoiceDashboard.tsx to match APY brand (same palette, consistent typography)
- [x] Add admin dashboard link to the invoice submission page (always visible)

## Careers Page
- [x] Add jobApplications table to drizzle schema (already built)
- [x] Add tRPC procedure: submitApplication (already built)
- [x] Build /careers page with 4 job listings (already built)
- [x] Application modal with questions (already built)
- [x] Send email notification to afropuppyyogaofficial@gmail.com on new application (already built)
- [x] Add Careers link to navbar and footer (already built)

## Birthday Packages Feature
- [x] Add birthdayInquiries table to drizzle schema (id, name, email, phone, date, location, tier, groupSize, message, status, createdAt)
- [x] Add tRPC procedure: submitBirthdayInquiry (public, saves to DB, sends email notification)
- [x] Add tRPC procedure: getBirthdayInquiries (owner-only, returns all inquiries with status)
- [x] Build /birthday page with 3 tiers (Basic $600, Premium $900, Deluxe $1,200) and booking inquiry form
- [x] Add birthday packages CTA to homepage (between Experience and LumaCalendar sections)
- [x] Wire email notification to afropuppyyogaofficial@gmail.com on new birthday inquiry
- [x] Add Birthday Packages link to navbar and footer

## Partnerships Feature
- [x] Add partnershipInquiries table to drizzle schema
- [x] Add DB helpers for partnership inquiries
- [x] Add tRPC procedures: submitPartnershipInquiry, getAllPartnershipInquiries, updatePartnershipStatus
- [x] Build /partnerships page with 5 categories and CLB Pilates Guelph featured
- [x] Add partnership inquiry form with category selector
- [x] Wire owner email notification on new partnership inquiry
- [x] Add Partnerships link to Navbar and Footer
- [x] Add Partnerships CTA to homepage
- [x] Write vitest tests for partnership procedures

## Application Pipeline & Video Upload Fix
- [x] Fix video upload: replace base64-in-body with multipart upload to /api/upload-video (multer + S3)
- [x] Add interview invite email with date/time modal in Applications Dashboard
- [x] Add offer letter email button in Applications Dashboard
- [x] Add rejection letter email button in Applications Dashboard
- [x] Update application status enum: added interview_scheduled, accepted
- [x] Wire automated emails via nodemailer/Gmail SMTP (afropuppyyogaofficial@gmail.com) for all three pipeline stages

## Delete Application Feature
- [x] Add deleteApplication tRPC procedure to careers router (already built)
- [x] Add delete button (trash icon) to each application row in ApplicationsDashboard (already built)
- [x] Add confirmation dialog before deleting (already built)

## Interview Invite Email Update
- [x] Update interview invite email template to use Google Calendar booking link (already built)
- [x] Simplify interview invite modal: booking link field (already built)
- [x] Update careers router: replace date/time/format fields with bookingLink field (already built)

## Magic Link Staff Login
- [x] Add staffInvites table to schema (already built)
- [x] Add staff session support (already built)
- [x] Build inviteStaff procedure (already built)
- [x] Build verifyMagicLink procedure (already built)
- [x] Build listStaff and revokeStaff procedures (already built)
- [x] Build /admin/staff-management page (already built)
- [x] Build /staff-login page (already built)
- [x] Gate all admin routes to allow staff sessions in addition to Manus owner (already built)
- [x] Test end-to-end magic link flow (already built)

## Offer Letter PDF Attachments
- [x] Upload OfferLetter_Volunteer_Kitchener_V2.pdf and NDA_Updated.pdf to S3 CDN
- [x] Attach both PDFs automatically to the offer letter email sent from Applications Dashboard

## Make Video Upload Optional
- [x] Remove video required validation in Careers.tsx handleSubmit
- [x] Update video upload zone label from required to optional
- [x] Update submit logic to not require videoUrl
- [x] Make videoUrl and videoKey optional in careers tRPC router schema
- [x] Update video size label from MAX 100MB to MAX 500MB

## Onboarding Email Feature
- [x] Add buildOnboardingEmail() template to server/email.ts
- [x] Add sendOnboardingEmail mutation to server/routers/careers.ts
- [x] Add OnboardingEmailModal component to ApplicationsDashboard.tsx
- [x] Add Send Onboarding Email button to table row actions and detail modal (only show when signingStatus === "signed")

## Onboarded Status
- [x] Add "onboarded" to APP_STATUS enum in drizzle/schema.ts
- [x] Run pnpm db:push to migrate
- [x] Add "onboarded" to APP_STATUS in careers router
- [x] Add "Onboarded" option to status dropdown in ApplicationsDashboard
- [x] Add teal StatusBadge style for "onboarded"
- [x] Auto-set status to "onboarded" when onboarding email is sent

## Manulife + Invoice Remaining Balance
- [x] Add Manulife logo to the Trusted By section on the homepage
- [x] Add amountPaidCents and paymentNotes fields to invoices schema
- [x] Run pnpm db:push for amountPaidCents migration
- [x] Add recordPayment mutation to invoice router
- [x] Add Remaining tab to InvoiceDashboard showing outstanding balances
- [x] Add Record Payment button in invoice rows to log partial/full payments

## Onboarding Email Improvements
- [x] Update buildOnboardingEmail: add time, location, training resources link, iMessage group chat, CTA, what-to-bring
- [x] Update OnboardingEmailModal: add time and location input fields
- [x] Add buildYogaInstructorOnboardingEmail template for yoga instructor role
- [x] Update sendOnboardingEmail router to use role-specific template

## Role-Specific Offer Letter Templates
- [x] Add buildYogaInstructorOfferLetterEmail template ($22/hr, paid, offer letter + NDA)
- [x] Wire yoga instructor offer letter to sendOfferLetter router (auto-select by role)

## Online Signing Portal
- [x] Add signingTokens table to drizzle schema (already built)
- [x] Run pnpm db:push for signingTokens migration (already done)
- [x] Add getSigningDocument public procedure (already built)
- [x] Add signDocument public procedure (already built)
- [x] Build /sign/:token public page (already built as SignDocuments.tsx)
- [x] Update sendOfferLetter router to generate signing token and email the link (already built)
- [x] Notify admin when applicant signs (already built)
- [x] Test full flow (already built and tested)

## Puppy Monitor + Puppy Specialist Offer Letters
- [x] Write buildPuppyMonitorOfferLetterEmail template ($50/shift, paid volunteer)
- [x] Write buildPuppySpecialistOfferLetterEmail template ($18/hr)
- [x] Add inline offer letter content for Puppy Monitor in SignDocuments.tsx getOfferLetterContent()
- [x] Add inline offer letter content for Puppy Specialist in SignDocuments.tsx getOfferLetterContent()
- [x] Update detectOfferLetterType in signing.ts to handle puppy_specialist role
- [x] Add puppy_specialist to offerLetterType enum in drizzle schema
- [x] Run pnpm db:push for puppy_specialist enum migration

## Luma API Proxy
- [x] Store LUMA_API_KEY as a server secret
- [x] Add http-proxy-middleware to dependencies
- [x] Add /api/luma/* proxy route in Express server (forward all methods/paths to https://api.lu.ma)
- [x] Test proxy with a real Luma API call (19/19 tests passing)

## Resend Invite Button
- [x] Add resendInvite tRPC procedure to staff router (regenerate token, update DB, resend email)
- [x] Add Resend Invite button to StaffManagement UI with loading/success state

## Staff Data Access Fix
- [x] Add staffProcedure to trpc.ts allowing admin and staff roles
- [x] Update invoices router: list, updateStatus, recordPayment, delete now use staffProcedure
- [x] Update careers router: list, updateStatus, sendInterviewInvite, sendOfferLetter, deleteApplication, sendOnboardingEmail, sendRejectionLetter now use staffProcedure
- [x] Update birthday router: getAll, updateStatus now use staffProcedure
- [x] Update signing router: createSigningRequest, getSigningStatus now use staffProcedure

## Video Required on Job Applications
- [x] Make videoUrl required in careers router backend schema
- [x] Add videoMode state (upload/link) to ApplicationModal
- [x] Add tab toggle UI: Upload Video vs Paste a Link
- [x] Add videoLink input with URL validation for link mode
- [x] Add required validation: block submit if no video provided
- [x] Update upload logic to use pasted link directly (no upload needed)
- [x] Update ApplicationsDashboard to handle external links (YouTube/Drive/Dropbox) vs S3 uploads

## Access Control Audit Fixes (May 2026)
- [x] Fix StaffPortal hub lock logic to check role (admin/staff) not just isAuthenticated
- [x] Fix AdminNav to hide Staff tab from staff role users
- [x] Add Partnerships tab to AdminNav (visible to admin and staff)
- [x] Convert partnership getAll and updateStatus to staffProcedure (backend)
- [x] Build PartnershipsDashboard page at /admin/partnerships (admin + staff access)
- [x] Register /admin/partnerships route in App.tsx
- [x] Add Partnership Inquiries tool card to StaffPortal hub
- [x] Add 18+ age confirmation checkbox to signing portal — must be checked before signature can be submitted
- [x] Add share button to job listing cards on Careers page (Facebook, X, LinkedIn, copy link) — X and LinkedIn added (Facebook was already there)

## UI/UX Audit Fixes (May 26, 2026)
- [x] Fix "Available Across GTA" → "Available Locations" in PrivateEvents.tsx
- [x] Fix membership button color inconsistency (Puppy Pass pink vs Wellness Pack dark)
- [x] Remove large white space gaps between Memberships→About and OurStory→PrivateEvents
- [x] Move "Our Values" cards out of Reviews section into its own section
- [x] Fix gallery portrait photo cropping (object-position: top) — already had object-top
- [x] Strengthen Loyalty section background color
- [x] Group footer navigation links into two columns — already implemented
- [x] Add hero subtitle text-shadow for legibility — already implemented
- [x] Reduce Private Events dark overlay opacity
- [x] Navbar: collapse secondary links (Birthday, Partnerships, Loyalty, Careers) into "More ▾" dropdown — Birthday and Partnerships already in More dropdown
- [x] Ethics section: replace full content with summary + "Read Our Full Standards →" link — already implemented
- [x] Luma calendar: add skeleton loader while iframe loads — already implemented
- [x] Our Story: add pull quote and visual break — already implemented

## Codebase Audit Fixes (May 26, 2026)
- [x] Add rate limiting (express-rate-limit) to public form endpoints
- [x] Fix HTML injection in careers email template (escapeHtml helper)
- [x] Fix HTML injection in privateEvents email template (escapeHtml helper)
- [x] Fix URL validation - block javascript: URIs and LinkedIn URLs in videoUrl fields
- [x] Add max length to careers whyAPY and experience fields
- [x] Add max length to chatbot message content (1000 chars)
- [x] Centralize LOGO_URL constant in const.ts (was duplicated in 10+ files)
- [x] Centralize BOOK_URL constant in const.ts (was duplicated in 8+ files)
- [x] Fix staff token leak - exclude token from getAllActiveStaff response
- [x] Fix gallery keyboard accessibility (role=button, tabIndex, onKeyDown)
- [x] Remove console.log from ComponentShowcase
- [x] Add canonical link tag to index.html
- [x] Update sitemap.xml to include all public pages (loyalty, careers, birthday, partnerships, ethics)
- [x] Add DB indexes on status columns for all 5 inquiry tables + staffInvites
- [x] Build missing Birthday Admin Dashboard (/admin/birthday)
- [x] Add Birthday tab to AdminNav
- [x] Add Birthday Inquiries card to StaffPortal
- [x] Fix streaming video proxy (was buffering entire file in memory)
- [x] Fix in-memory job registry memory leak in chunkedUploadRoute

## Refund Tracker (June 20, 2026)
- [x] Add refunds table to drizzle/schema.ts and push migration
- [x] Build tRPC refunds router (CRUD + stats)
- [x] Build RefundTracker page UI (/admin/refunds)
- [x] Add Refund Tracker to AdminNav
- [x] Add Refund Tracker card to StaffPortal
- [x] Add /admin/refunds route to App.tsx

## Technical SEO Fixes (Ahrefs Audit — Jul 6 2026)
- [x] Regenerate sitemap.xml with only 7 canonical public pages (removed admin/internal/redirect URLs)
- [x] Update robots.txt to disallow all admin, staff, sign, and utility routes
- [x] Create useSeoMeta hook for per-page canonical + meta description injection
- [x] Add useSeoMeta to Home, Ethics, Loyalty, Birthday, Partnerships, Careers, PrivateEventQuote pages
- [x] Fix Footer.tsx: change Ethics link from anchor to /ethics page; add Private Event Quote link
- [x] Fix Navbar More dropdown: add /ethics and /private-events/quote to remove orphan status
- [x] Fix duplicate H1 on Birthday.tsx (success state h1 changed to h2)
- [x] Expand Ethics.tsx with 5-question FAQ section, dual CTA, and internal links (word count fix)
- [x] Fix LocalBusiness schema: add required address field, fix logo to ImageObject, remove duplicate Organization entity
- [x] Add FAQPage schema to index.html (6 questions matching homepage FAQ)
- [x] Add BreadcrumbList schema to index.html
- [x] Consolidate duplicate google-site-verification meta tags in index.html

## Account Migration (Jul 9, 2026)
- [x] Clone repo from https://github.com/aybello/afropuppyyoga.git
- [x] Restore all source files from repo (client, server, drizzle, shared, vite config, server/_core)
- [x] Install missing packages (pdfkit, pdfjs-dist, http-proxy-middleware)
- [x] Migrate database from old account (16 tables, all row counts verified)
- [x] TypeScript check: 0 errors
- [x] Production build: successful
- [x] Tests: 17/19 passing (2 failures are LUMA_API_KEY not set — expected, key needs to be added as secret)
- [x] Add GMAIL_APP_PASSWORD secret (email notifications)
- [x] Add LUMA_API_KEY secret (Luma calendar proxy)

## Sprint 1 — Revenue + Conversion Cleanup (Jul 9, 2026)
- [x] Task 1: Standardize "Ontario's #1 Puppy Yoga Experience" across index.html, Navbar, Footer, Hero, Home.tsx, Partnerships.tsx, email.ts, signing.ts, seoRenderer.ts
- [x] Task 2: Add trust line to hero CTA area ("Trusted by universities, brands, and wellness communities across Ontario")
- [x] Task 3: Improve /private-events/quote page — package labels (Classic/Signature/Luxury), "Best for" labels, "What happens next" section, corporate CTA
- [x] Task 4: Fix backend quote recalculation — server calculates estimatedMin/estimatedMax from event type, guest count, location, package type

## Sprint 2 — Location SEO Pages (Jul 9, 2026) [superseded by second Sprint 2 block below]
- [x] Build shared LocationPage component (hero, about, schedule embed, FAQ, CTA, structured data)
- [x] Create /kitchener page with Kitchener-specific copy, TenC Dance Studio details, LocalBusiness schema
- [x] Create /hamilton page with Hamilton-specific copy, Colibri Studio details, LocalBusiness schema
- [x] Create /oakville page with Oakville-specific copy, "coming soon" framing, LocalBusiness schema
- [x] Register all 3 routes in App.tsx with React.lazy
- [x] Add "Locations" section to Footer navGroups
- [x] Add Locations dropdown to Navbar More menu
- [x] Update sitemap.xml with 3 new location URLs
- [x] Update robots.txt to allow location pages
- [x] Add internal links from homepage Experience section to location pages

## Sprint 2 — Location SEO Pages (Jul 9, 2026)
- [x] Build shared LocationPage component (hero, about, experience features, Luma calendar embed, FAQ accordion, CTA, cross-location links, JSON-LD structured data)
- [x] Create /kitchener page — unique copy, TenC Dance Studio venue, 6 FAQs, LocalBusiness schema
- [x] Create /hamilton page — unique copy, Colibri Studio venue, 6 FAQs, LocalBusiness schema
- [x] Create /oakville page — coming soon state, follow CTA, redirect to KW/Hamilton, 4 FAQs
- [x] Wire routes in App.tsx (lazy-loaded)
- [x] Add Locations column to Footer (Kitchener, Hamilton, Oakville Soon)
- [x] Add location links to Navbar More dropdown
- [x] Update sitemap.xml with all three location URLs

## Sprint 2 Remaining — More SEO Pages (Jul 9, 2026)
- [x] Create /puppy-yoga-waterloo page (students, tech teams, founders angle)
- [x] Create /private-puppy-yoga-events page (private events SEO landing)
- [x] Wire both routes in App.tsx
- [x] Add to sitemap.xml
- [x] Add to Navbar More dropdown and Footer

## Sprint 3 — Membership + Loyalty Funnel (Jul 9, 2026)
- [x] Update Memberships.tsx: add "Best for" labels, savings explanation, cross-city note, rollover policy, early access / priority booking perks
- [x] Update Loyalty.tsx: simplify promise to "Attend 3 classes, get your 4th free", add cross-city FAQ, add "Ask us after class" CTA

## Sprint 4 — Corporate Sales Page (Jul 9, 2026)
- [x] Build /corporate-puppy-yoga dedicated page (hero, who it's for, why it works, packages, trust logos, FAQ, CTA)
- [x] Wire route in App.tsx
- [x] Add to Navbar More dropdown and Footer
- [x] Add to sitemap.xml

## Sprint 2/4 Cleanup
- [x] Fix Navbar "Oakville (Soon)" label → "Oakville"
- [x] Fix Footer "Oakville (Soon)" label → "Oakville"

## Sprint 2 Rebuild — City Pages (Plan-Exact, Jul 10 2026) [COMPLETE]
- [x] Read Reviews.tsx, OurValues.tsx, const.ts for inspiration assets
- [x] Rebuild LocationPage.tsx with all plan-required sections: Why try puppy yoga in [city]?, reviews/testimonials, complete structure
- [x] Rebuild /puppy-yoga-kitchener page (correct slug, all sections, Kitchener-specific copy)
- [x] Rebuild /puppy-yoga-hamilton page (correct slug, all sections, Hamilton-specific copy)
- [x] Rebuild /puppy-yoga-oakville page (correct slug, all sections, Oakville-specific copy)
- [x] Rebuild /puppy-yoga-waterloo page (correct slug, all sections, Waterloo-specific copy)
- [x] Rebuild /private-puppy-yoga-events page (correct slug, all sections)
- [x] Add trust logos section to /corporate-puppy-yoga Corporate.tsx
- [x] Update App.tsx routes: /puppy-yoga-kitchener, /puppy-yoga-hamilton, /puppy-yoga-oakville
- [x] Add redirect routes for old slugs (/kitchener → /puppy-yoga-kitchener, etc.)
- [x] Update Navbar moreLinks with correct slugs
- [x] Update Footer navGroups with correct slugs
- [x] Update sitemap.xml with correct slugs
- [x] Update LocationPage.tsx internal cross-links with correct slugs

## Real Photo Integration — Kitchener & Hamilton (Jul 11 2026)
- [x] Browse APY Google Drive 2026 folder for Kitchener and Hamilton session photos
- [x] Select 4 best photos per city (Kitchener: May 16th session; Hamilton: Apr 25th session)
- [x] Convert HEIC photos to JPEG and upload to webdev CDN
- [x] Add photos prop to LocationConfig interface in LocationPage.tsx
- [x] Add "From Our Classes" photo gallery section to LocationPage.tsx (featured large + 3 smaller)
- [x] Add Kitchener photos to Kitchener.tsx config
- [x] Add Hamilton photos to Hamilton.tsx config

## Color Audit — City Pages (Jul 12 2026)
- [x] Fix Quick Facts strip background: bg-[#3D1A2E] → bg-[#8B2252] (matches brand primary deep rose)
- [x] Fix "View All {city} Classes →" button: bg-[#D4708A] → bg-[#F2A0B8] text-[#1A0A12] (matches homepage hero/BookingBanner CTA pattern)
- [x] Fix "Book a Class in {city}" hero button hover state: hover:bg-[#D4708A] → hover:bg-[#F2A0B8]/90
- [x] Fix "Get a Private Event Quote" button hover state: hover:bg-[#D4708A] → hover:bg-[#F2A0B8]/90
- [x] Fix bottom CTA "Book a Class in {city}" hover state: hover:bg-[#D4708A] → hover:bg-[#F2A0B8]/90
- [x] Fix Coming Soon "Follow on Instagram" button: bg-[#D4708A] → bg-[#8B2252] (dark rose on light bg)
- [x] Fix Coming Soon "Book in KW or Hamilton" outline button: border-[#D4708A] → border-[#8B2252]

## Oakville Page Launch (Jul 12 2026)
- [x] Find Oakville session folder in Google Drive (50_Sat,June 6th_Oakville, folder ID 1inHGu-p5bFEHrFCecPK3GVE8zmuZGLZn)
- [x] Download 15 HEIC photos from Oakville June 6th session
- [x] Convert HEIC to JPEG and select best 9 photos
- [x] Upload 9 Oakville photos to webdev CDN
- [x] Update Oakville.tsx: add photos array, add lumaTag "oakville", expand FAQs to 6, update private events FAQ to reflect launched status

## Meta Conversions API Integration (Jul 12 2026)

- [x] Schema: add meta_conversion_events table to drizzle/schema.ts
- [x] Schema: run migration via webdev_execute_sql
- [x] Backend: direct Luma polling helper (server-to-server, not via /api/luma proxy)
- [x] Backend: Luma polling heartbeat job (every 10 min) — find new paid guests, insert pending rows
- [x] Backend: Meta CAPI sender heartbeat job (every 10 min, offset 5 min) — hash PII, POST to Meta
- [x] Security: fix /api/luma P0 proxy (restrict to allowlist or remove)
- [x] Frontend: InitiateCheckout pixel event on Luma button click
- [x] Tests: hashing correctness (em, ph, fn, ln)
- [x] Tests: no-hash fields assertion (fbc, fbp, ip, ua sent in plaintext)
- [x] Tests: poller idempotency (same guest → exactly one row)
- [x] Secrets: META_PIXEL_ID, META_CAPI_ACCESS_TOKEN, META_TEST_EVENT_CODE, META_CAPI_ENABLED

## Security Hardening (Branch: security/hardening — Jul 13 2026)

- [x] Phase 1: Lock down Luma API proxy — require staff auth, allowlist paths, rate limit, fail-safe on missing key
- [x] Phase 2: Protect applicant video/résumé/invoice/document routes — require staff/admin auth middleware
- [x] Phase 3: Harden public and chunked upload routes — rate limit before Multer, magic bytes, traversal protection
- [x] Phase 4: Staff session revocation — revokeStaff now demotes user role to 'user' so existing sessions fail immediately
- [x] Phase 5: Puppy schedule auth — replaced protectedProcedure with staffProcedure (admin + staff only)
- [x] Phase 6: Fix rate limiter wiring — corrected birthday.submitInquiry and partnership.submitInquiry paths
- [x] Phase 7: Invoice submission atomic — createInvoice returns MySQL insertId directly (no race condition)
- [x] Phase 8: Repair pnpm lockfile — removed package-lock.json, ran pnpm audit --fix, 0 known vulnerabilities
- [x] Phase 9: Fix structured data claims — updated ratingValue 4.6→4.9, price $35→$45, updated event dates
- [x] Phase 10: GitHub Actions CI workflow — .github/workflows/ci.yml with frozen install, tsc, tests, build, audit
- [x] All phases: 35/35 tests passing after all changes

## CAPI Hardening Patch (Claude audit — Jul 13 2026)

- [x] Remove /api/luma proxy (PII leak) — replaced with 410 tombstone, regression test added
- [x] Fix phone hashing to Meta spec — country code now included (14165551234 not 4165551234)
- [x] 7-day event window on Luma poller — prevents ingesting old history on first run
- [x] 7-day guard in capiSender — marks early-bird registrations as skipped instead of failing
- [x] Cron auth on scheduled job endpoints — x-manus-cron-task-uid + optional SCHEDULED_JOB_SECRET
- [x] SCHEDULED_JOB_SECRET set in production secrets
- [x] Heartbeat jobs registered: apy-luma-poll (every 10 min) + apy-meta-capi-send (offset 5 min)
- [x] 38/38 tests passing after all changes

## Security Audit Priorities 1–6 (Jul 13 2026)

- [x] Priority 6 quick wins: deleted SECURITY_AUDIT_NOTES.md from GitHub, fixed rating (4.9) / price ($55) / reviews (494) across index.html and seoRenderer.ts
- [x] Priority 1: Archived orphaned DROP TABLE migration files, fixed _journal.json snapshot chain collision, drizzle-kit generate now works cleanly
- [x] Priority 2: Rate limiting on all upload routes, magic-bytes file signature check, crypto.randomBytes IDs, duplicate completion prevention, chunk validation, upload session expiry
- [x] Priority 3: Video proxy restricted to approved CDN hostname only, invoice submit now accepts fileKey only (URL resolved server-side — prevents SSRF)
- [x] Priority 4: Meta CAPI token moved to Authorization header (not URL param), atomic row claiming (pending→processing→sent) prevents double-sends, 'processing' status added to DB enum
- [x] Priority 5: Staff JWT TTL reduced from 1 year to 7 days
- [x] 38/38 tests passing after all changes

## Weekend Scheduling Calendar (Breeder Tool — Jul 14 2026)

- [x] DB schema: added startTime, endTime, classType columns to existing puppySchedule table
- [x] Migration: ALTER TABLE applied to production DB (startTime, endTime, classType, dayOfWeek enum expanded to 7 days)
- [x] tRPC procedures: listByMonth, createSlot, updateSlot, deleteSlot (all staffProcedure)
- [x] Frontend: ScheduleCalendar page — month view, Sat/Sun highlighted, weekday private event slots
- [x] Add/edit modal: date, location dropdown (Kitchener/Hamilton/Oakville), time picker, breeder dropdown, notes
- [x] Location colour coding: Kitchener (pink), Hamilton (purple), Oakville (teal)
- [x] Wire into AdminNav More dropdown as "Schedule Calendar" at /admin/schedule-calendar
- [x] 38/38 tests passing after changes

## Move Schedule Calendar into Breeders Dashboard (Jul 14 2026)

- [x] Replace the old inline schedule tab in BreedersDashboard with the new ScheduleCalendarPanel component
- [x] BreedersDashboard tabs: Breeders | Schedule Calendar (removed old list-based schedule UI)
- [x] Removed /admin/schedule-calendar from AdminNav More dropdown (calendar lives inside /admin/breeders now)
- [x] /admin/schedule-calendar route kept in App.tsx as standalone fallback
- [x] 38/38 tests passing

## Career Portal Video Upload Bug Fixes (Jul 14 2026)

- [x] Bug 1+2: Replace in-memory job Map with S3-backed status.json; run assembly synchronously within /api/upload-video-complete request
- [x] Bug 4: Stream chunk assembly to avoid OOM — process chunks sequentially and stream directly to S3 instead of Buffer.concat
- [x] Bug 3: Increase frontend chunk size from 1MB to 5MB (500MB / 5MB = 100 chunks, well under MAX_CHUNKS=200)
- [x] Bug 5: Relax magic-byte check in uploadRoute.ts to accept iPhone HEVC MOV files (ftyp at any offset up to 32 bytes)
- [x] Add server timeout extension for /api/upload-video-complete to handle large video assembly within Cloud Run 180s limit

## Breeder Calendar — Weekend-Focus Layout (Jul 15 2026)

- [x] Redesign calendar grid: Sat/Sun columns wider + brighter background, Mon–Fri columns narrower + muted
- [x] Weekend day headers (Sat/Sun) styled with APY pink accent, weekday headers subdued
- [x] Weekend cells get full slot chips; weekday cells show compact slot indicators
- [x] Keep all 7 days visible so weekday private events are still accessible

## Breeder Calendar Enhancements (Jul 15 2026)

- [x] Notify Breeder button on each slot chip — fires confirmation email with date, time, location pre-filled
- [x] tRPC procedure: notifyBreeder(slotId) — sends email via Gmail SMTP using existing email helper
- [x] Repeat Weekly toggle in Add Slot modal — creates slots for every occurrence of that weekday in the selected month
- [x] tRPC procedure: createRecurringSlots(payload, repeatWeekly) — bulk insert for recurring slots
- [x] Slot conflict detection — detect same-location same-day duplicates, highlight cell/chip in red with warning badge
- [x] Conflict detection runs client-side from slotsByDate map (no extra query needed)

## Breeder Calendar — Polish (Jul 15 2026)
- [x] Weekend-only toggle: switch at top of calendar that collapses Mon–Fri columns entirely, expands back when toggled off
- [x] Breeder first name on weekend slot chips: show below breed so you can see who's coming without opening edit modal
- [x] Today's weekend highlight: if today is Sat or Sun, give that cell a stronger pink ring/border

## Admin Direct Login (Jul 17, 2026)
- [x] Add direct admin username/password login (admin / afropuppyyoga) — bypass Manus OAuth for admin access, issue JWT session
- [x] Move Staff Portal link/button to top of homepage (above the fold / near navbar)

## Birthday Page Consolidation (Jul 18, 2026)
- [x] Remove standalone Birthday page (/birthday) and Birthday dashboard (/admin/birthday)
- [x] Redirect /birthday links site-wide to /private-events/quote
- [x] Remove Birthday nav links from Navbar, Footer, AdminNav, StaffPortal
- [x] Update BirthdayBanner homepage section to link to /private-events/quote
- [x] Update seoRenderer.ts to remove birthday nav links and redirect canonical

## Twilio Class Cancellation Calling Feature
- [x] Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER as secrets
- [x] Install twilio npm package
- [x] Create server/routers/cancellation.ts with cancelClass procedure
- [x] Add callLogs table to schema (eventId, guestName, phone, status, calledAt)
- [x] Add Cancel Class UI to admin portal with event selector and call log table
- [x] Test end-to-end with verified number

## SMS + Call Cancellation (Both)
- [x] Update cancellation router to send SMS alongside phone call for each guest
- [x] Add smsStatus and smsSid fields to callLogs schema
- [x] Update CancellationDashboard UI to show SMS status column in call log

## Staff Portal + Luma Fix
- [x] Add Cancel Class tile to staff portal page
- [x] Fix Luma listEvents to correctly return upcoming classes from the calendar

## Twilio Webhook + Email Fallback
- [ ] Add POST /api/twilio/call-status webhook endpoint to update callLogs.status from Twilio callbacks
- [ ] Add POST /api/twilio/sms-status webhook endpoint to update callLogs.smsStatus from Twilio callbacks
- [ ] Configure Twilio number to point statusCallback to the deployed webhook URLs
- [ ] Add email fallback in cancelClass mutation: send Gmail cancellation email to guests with no phone number
- [ ] Update CancellationDashboard to show email status in results and log

## Triple Notification on Cancellation
- [x] Update cancellation router: every attendee always gets email + SMS + call (not conditional)
- [x] Update callLogs schema to track emailStatus separately
- [x] Update UI to show email status column in log
