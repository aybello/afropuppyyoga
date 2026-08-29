
## Current Staff Access Investigation
- [x] Measure the reported APY page-load delay using page, API, and database timing evidence
- [x] Complete the public AfroPuppyYoga homepage loading audit across hero media, fonts, bundle, and public data requests
- [x] Defer the measured 9.4-second live Luma calendar embed until the visitor reaches the class section, without caching Luma data
- [x] Measure homepage font and JavaScript bundle contributions beyond the Luma embed
- [x] Review and reduce duplicated or competing public homepage asset loads when they materially affect first render
- [x] Stop mounting every lazy public homepage section on initial render so their JavaScript and media wait until the visitor approaches each section
- [x] Document the 1.8–3.6 second idle API first-byte delay as an external Autoscale limitation, isolated from the static public homepage first screen
- [x] Identify and remove the APY HQ expired-session retry path that could hold a visible spinner
- [x] Diagnose the observed Employee Directory loading state as an expired/redirected browser session rather than a 19-row database-query bottleneck
- [x] Directly verify the live same-origin `staffAvailability.listEmployees` route response after the APY HQ session-handling changes
- [x] Route expired APY HQ sessions to passwordless Staff Access instead of Manus login and prevent auth failures from retrying behind a visible spinner
- [x] Give the Employee Directory an explicit failed-data state instead of an indefinite loading view
- [x] Return a verified passwordless APY HQ session to its original protected page after re-entry
- [x] Measure a successful representative APY API route and database query plan to separate startup delay from application data latency
- [x] Review and safely synchronize newly available APY updates with the validated main branch
- [x] Integrate the employee-directory and private-event HST updates without duplicating APY HQ staff editing or reintroducing the unreliable hero-image source
- [x] Apply the confirmed employee-directory migration and private-event HST-at-checkout update after data-integrity validation
- [x] Backfill existing active and archived APY HQ team profiles into the employee directory and preserve Operations Manager coverage when removing a team member
- [x] Add a compatible Employee Directory route alias and verify every APY HQ navigation entry reaches the directory without a 404 page
- [x] Browser-verify the Employee Directory by following the actual APY HQ navigation entry rather than only by direct URL
- [x] Verify the `/admin/employee-directory` compatibility path loads the backfilled Employee Directory without a 404 response
- [x] Verify the registered Employee Directory route loads 19 backfilled records with active and inactive employment history
- [x] Verify the existing Private Event Inquiries workflow loads after the HST calculation update without creating or sending anything
- [x] Synchronize the validated APY HQ individual staff messaging update to the connected GitHub main branch
- [x] Remove any residual merge-conflict markers from the synchronized staff access files and revalidate the build
- [x] Add a safe one-at-a-time messaging action for an individual assigned class staff member within APY HQ staffing context
- [x] Limit individual class messages to the current assigned event recipients and retain email, SMS suppression, and delivery history safeguards
- [x] Report individual class-message delivery accurately instead of showing success when all channels fail or are suppressed
- [x] Add focused route-level regression coverage for individual message recipients, resend history, SMS suppression, and failed delivery states
- [x] Add route-level tests for individual message suppression, failed/not-configured delivery reporting, and successful-delivery status
- [x] Verify the individual message result maps to success versus warning/error client feedback without claiming failed delivery was sent
- [x] Exercise the notifyIndividualEventStaff mutation itself across recipient, resend, suppression, unavailable, failed, and successful-delivery paths
- [x] Add direct client feedback mapping coverage for individual schedule delivery results
- [x] Add unified owner-controlled editing for APY HQ staff profile details, role, location assignment, and availability through the connected leave workflow
- [x] Confirm active/inactive team-profile controls follow the APY owner-and-Operations-Manager access model and remain unavailable to other roles
- [x] Verify inactive APY HQ profiles are shown separately from active staffing and are excluded from weekend coverage
- [x] Prevent an edit from leaving an active Puppy Monitor location without an Operations Manager
- [x] Add a clear Staff Access link to the existing Team & Availability editor so profile editing is discoverable from APY HQ navigation
- [x] Verify Staff Access now links directly to the connected Team & Availability editing workflow
- [x] Verify the loaded Team & Availability board remains connected to weekend coverage and class staffing after adding profile-editing support
- [x] Verify an existing team member now exposes an Edit team details action alongside their leave and removal controls
- [x] Verify the connected weekend coverage panel remains available alongside the new team profile controls
- [x] Create and validate a polished AfroPuppyYoga funding pitch deck from the uploaded source deck and current business evidence
- [x] Review the newly available Codex update before any integration or deployment decision; retain the stronger current owner-session fallback and staff return-path behavior
- [x] Diagnose and restore reliable owner and staff access to the APY HQ staff portal
- [x] Allow the configured APY owner to use secure phone verification for owner-level APY HQ access without Manus sign-in
- [x] Confirm the legacy live `/staff` portal route renders blank while `/staff-access` loads the intended APY HQ access screen
- [x] Confirm the current `/staff` command centre renders locally, isolating the reported failure to the live deployment path
- [x] Verify the live `/staff` route renders the APY HQ command-centre access state after its initial bundle load, without requiring a redirect
- [x] Retain the owner-account OAuth route only as a backup; the owner approved and verified phone-first APY HQ access instead
- [x] Verify the owner-account action reaches the configured AfroPuppyYoga identity-provider sign-in page without an application routing failure
- [x] End-to-end verify a phone OTP session reaches `/staff` with the intended APY HQ access level
- [x] Confirm delivery of the owner-approved one-time code and complete the passwordless APY HQ session test
- [x] Confirm the corrected owner recipient receives the second approved verification code
- [x] Verify the corrected owner-phone request reaches APY HQ code entry without a client-side error
- [x] Verify the published passwordless APY HQ phone-access form loads before submitting the owner-approved test number
- [x] Diagnose and restore live delivery of the APY HQ owner verification SMS before sending another code
- [x] Update the configured owner phone used by passwordless APY HQ access to the owner-confirmed mobile number
- [x] Diagnose and correct the rejected owner verification code before retesting passwordless APY HQ access
- [x] Request and verify a fresh, unused owner code after resolving the consumed-code mismatch
- [x] Resolve the owner session identity from the existing admin record when the production environment omits the owner identifier
- [x] Confirm the fresh verification form contains the owner-approved mobile number before dispatching the final code
- [x] Confirm the corrected live owner-session form contains the owner-approved mobile number before requesting the final session code
- [x] Confirm the latest corrected owner verification redirects to the authenticated APY HQ command centre
- [x] Fall back to a dedicated verified-owner-phone session identity when owner metadata is unavailable in production
- [x] Verify the newly published owner-session access form accepts the owner-approved number without a client-side error
- [x] Verify the final published owner-session request reaches code entry without the earlier production configuration error
- [x] Reconcile the live staff verification endpoint with the published owner-session source before requesting another code
- [x] Verify the live API revision through a non-sensitive health marker before another passwordless owner-code attempt
- [x] Verify the synchronized-production owner verification form accepts the owner-approved number before its test code is sent
- [x] Retain the owner OAuth callback route as an optional backup; owner access is now verified through the chosen phone-first flow
- [x] Verify non-owner APY HQ phone-session identity and staff role boundaries remain protected after the owner-phone changes
- [x] Verify email-invite staff access remains wired to the existing APY HQ identity and role boundaries after the owner-phone changes
- [x] Add direct regression coverage proving email invitations remain limited to active manually managed APY HQ team members

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
- [x] Add POST /api/twilio/call-status webhook endpoint to update callLogs.status from Twilio callbacks
- [x] Add POST /api/twilio/sms-status webhook endpoint to update callLogs.smsStatus from Twilio callbacks
- [x] Configure Twilio number to point statusCallback to the deployed webhook URLs
- [x] Add email fallback in cancelClass mutation: send Gmail cancellation email to guests with no phone number
- [x] Update CancellationDashboard to show email status in results and log

## Triple Notification on Cancellation
- [x] Update cancellation router: every attendee always gets email + SMS + call (not conditional)
- [x] Update callLogs schema to track emailStatus separately
- [x] Update UI to show email status column in log

## Cancellation Email/SMS Enhancements
- [x] Auto-generate rebooking code from cancelled class date (MONTHDDAY format e.g. JULY21)
- [x] Pull next upcoming Luma event for same location or fallback to generic rebooking message
- [x] Include rebooking code in email body
- [x] Include rebooking code in SMS

## Operations Specialist Oakville Listing (Jul 21, 2026)
- [x] Add Operations Specialist (Oakville) job listing to Careers page in exact same format as existing listings ($19/hr, Part-Time, Now Hiring badge, ⚙️ emoji)

## Private Events Quote Page Hero Image Fix (Jul 21, 2026)
- [x] Replace broken hero circle image (apy-quote-hero_e5bfb507.png no longer on CDN) with ham_oak_IMG_3209_d7f2d0c0.jpg (confirmed live)
- [x] Switch from img tag to CSS background-image div to prevent alt text bleed-through in the circle

## Test SMS Feature (Jul 23, 2026)
- [x] Add sendTestSms tRPC procedure to cancellation router (staff-only, sends a test SMS to any number)
- [x] Add Test SMS card to CancellationDashboard UI with phone input and send button

## Test Call Feature (Jul 23, 2026)
- [x] Add sendTestCall tRPC procedure to cancellation router (staff-only, makes a real Twilio voice call to any number)
- [x] Add Test Call card to CancellationDashboard UI alongside the Test SMS card

## SMS Broadcast Tool (Jul 23, 2026)
- [x] Remove Test Call card from CancellationDashboard
- [x] Remove Test SMS card from CancellationDashboard
- [x] Create server/routers/smsBroadcast.ts with sendSingle, sendBulk procedures (staffProcedure)
- [x] Add smsBroadcast router to main router in server/routers.ts
- [x] Create client/src/pages/SmsBroadcast.tsx — single send, manual multi-number textarea, CSV upload + preview, send all with progress
- [x] Register /admin/sms-broadcast route in App.tsx
- [x] Add SMS Broadcast link to AdminNav
- [x] Add SMS Broadcast tile to StaffPortal

## Cancellation Loop Parallelization
- [x] Fix sequential guest notification loop in cancellation router — parallelize with Promise.allSettled
- [x] Fix fetchLumaGuests to only include guests with approval_status === 'approved' (exclude invited/declined)

## Cancellation Preview Feature
- [x] Add previewCancellation tRPC procedure that returns the list of approved guests before sending
- [x] Update CancellationDashboard UI with a preview/confirmation step showing recipient count and names

## Quote-to-Booking Generator (Private Events Extension)
- [x] Research Luma API create-event endpoint and test it
- [x] Add new statuses to privateEventInquiries: "quote_sent" and "booked"
- [x] Add columns for finalPrice, hstAmount, pricingType (plus_hst/all_in), lumaEventUrl, sessions, puppyBreed
- [x] Create backend procedure: generateLumaBookingLink (creates private paid Luma event via API)
- [x] Create backend procedure: sendQuoteEmail (drafts and sends email with Luma link via Gmail)
- [x] Extend Private Events Dashboard detail dialog with "Generate Booking Link" panel
- [x] Add pricing calculator with HST logic and owner-approval flag
- [x] Auto-update status to "quote_sent" after email sent, "booked" when payment received
- [x] Improve Luma event page: personalized descriptions by event type, branded cover image, tint color, org-name-only title

## Luma Event Page Improvements (Aug 3, 2026)
- [x] Update event title to 'Private PuppyYoga Experience'
- [x] Set Cranberry color (#9B2335) as default tint (note: Luma API ignores tint_color — must be set manually in Luma dashboard)
- [x] Auto-remove default 'Standard' free ticket after event creation (POST /events/ticket-types/delete)
- [x] Add location selector: APY studios (Kitchener, Cambridge, Toronto, Guelph, Hamilton, London) or custom client address
- [x] Support custom client addresses for on-site events (pass-through to Luma geo_address_json)

## Delete Luma Event + Payment Webhook (Aug 3, 2026)
- [x] Add deleteLumaEvent tRPC procedure (calls Luma DELETE API, clears lumaEventUrl/lumaEventId from inquiry)
- [x] Add "Delete Luma Event" button to Private Events Dashboard (with confirmation dialog)
- [x] Add /api/luma/webhook POST endpoint to receive Luma payment notifications
- [x] Auto-update inquiry status from "quote_sent" to "booked" when payment webhook fires
- [x] Send confirmation email to owner when a private event is booked/paid

## Quick Booking Link Generator (Standalone — Aug 4, 2026)
- [x] Add generateQuickBookingLink tRPC procedure (creates Luma event without an inquiry)
- [x] Add "Quick Booking Link" tab to Private Events Dashboard with standalone form
- [x] Support multi-session events (e.g., 2 sessions with break in between)
- [x] Include all fields: client name, org, event type, date, sessions, times, location, price, HST, breed, notes

## Quick Booking Link Form UI Redesign (Aug 4, 2026)
- [x] Redesign form with card-based layout (6 distinct cards: Client Info, Event Details, Schedule, Location, Pricing, Notes)
- [x] Add section header icons with branded pink icon containers
- [x] Replace dropdown location selector with radio-button style location cards
- [x] Add gradient header banner with Zap icon
- [x] Improve success state with better spacing and helper text
- [x] Add $ prefix to price input, subtle bg transitions on focus
- [x] Add numbered session badges with gradient circles
- [x] Add "30-min puppy rest break" helper text for multi-session events
- [x] Add URL param support (?tab=quick-link) for direct linking to the tab
- [x] Larger CTA button with shadow and active:scale micro-interaction

## Quick Booking Link Bug Fix + Layout Compaction (Aug 4, 2026)
- [x] Fix generate link button not working (Luma API changed: field must be `place_id` not `google_maps_place_id`)
- [x] Compact the form layout (merged 6 cards into 3 sections: Client+Event, Schedule+Location, Pricing+Notes+CTA)

## Luma Event Theme Defaults (Aug 4, 2026)
- [x] Set default Luma event theme to: Color=Cranberry, Pattern=Hypnotic, Font=Default, Display=Light

## Copy Email Template Button (Aug 4, 2026)
- [x] Add "Copy Email" button to the Quick Booking Link success state that generates a confirmation email from form data (client name, date, time, guest count, location, luma link) and copies to clipboard

## Email Template Update (Aug 4, 2026)
- [x] Update email template to match new format: location as address block, puppy breed in bullet, "Venue, setup and cleanup", shorter closing, no future-confirmation disclaimer

## Send via Gmail + Template Variants (Aug 4, 2026)
- [x] Add "Send via Gmail" button that opens a pre-filled Gmail compose window (mailto: or Gmail URL) with subject and body
- [x] Add event-type-specific template variants (Birthday, Bachelorette, Corporate, Team Building) with different intro wording

## Client Email Field (Aug 4, 2026)
- [x] Add optional client email field to Quick Booking Link form so Gmail compose auto-fills the "To" field

## Inquiry Send Quote Email Update (Aug 4, 2026)
- [x] Update the Inquiries tab "Send Quote Email" to use the same email template with event-type variants, Gmail compose, and client email auto-fill

## Onboarding Email Bug Fix (Aug 4, 2026)
- [x] Fix OnboardingEmailModal not rendering in main ApplicationsDashboard (modal was only in sub-component, not in main render tree when triggered from table row button)

## Soft-Delete for Applications (Aug 4, 2026)
- [x] Add deletedAt column to jobApplications schema (nullable timestamp)
- [x] Run migration for deletedAt column
- [x] Update deleteApplication mutation to set deletedAt instead of hard delete
- [x] Filter out soft-deleted records from careers.list query
- [x] Add listArchived procedure to return only soft-deleted applications
- [x] Add restoreApplication procedure to clear deletedAt
- [x] Add permanentlyDelete procedure (admin-only) for true deletion
- [x] Add "Archived" tab to ApplicationsDashboard showing soft-deleted records
- [x] Add "Restore" button on archived records
- [x] Update delete confirmation dialog to say "Archive" instead of "Delete"

## Onboarding Modal Dropdowns (Aug 4, 2026)
- [x] Replace Orientation Date free-text with dropdown showing upcoming dates (next 2-4 weeks)
- [x] Replace Orientation Time free-text with dropdown based on location (Kitchener: 9am, Hamilton: 10am)

## Breeder Availability Outreach (Aug 6, 2026)
- [x] Query all 58 active breeders from DB with contact info
- [x] Send availability emails (29 sent) to breeders with email for Aug 15-16, 22-23, 29-30
- [x] Send availability SMS (43 sent) to breeders with phone via Twilio
- [x] Greet by first name when known, fall back to "Hi" for unknown names

## SMS Inbox + Reply Forwarding (Aug 6, 2026)
- [x] Add inboundSms table to schema (fromPhone, toPhone, body, twilioSid, breederId, breederName, isRead)
- [x] Run migration for inboundSms table
- [x] Add POST /api/twilio/sms-inbound webhook endpoint (stores reply, matches breeder by phone, forwards to owner)
- [x] Configure Twilio SmsUrl webhook on +12898153524 to point to https://afropuppyyoga.ca/api/twilio/sms-inbound
- [x] Store owner phone +12897881885 as OWNER_PHONE_NUMBER secret for forwarding
- [x] Add inboundSmsRouter (list, unreadCount, markRead, markAllRead procedures)
- [x] Build /admin/sms-inbox page (SMS Inbox with All/Unread tabs, mark read on click, Mark All Read button)
- [x] Add SMS Inbox to AdminNav More dropdown
- [x] Register /admin/sms-inbox route in App.tsx

## Breeder Confirmation SMS (Aug 7, 2026)
- [x] Read existing sendConfirmation flow (email-only, toEmail required)
- [x] Make toEmail optional, add toPhone to sendConfirmation input
- [x] Send SMS via Twilio when phone on file (condensed event blocks per message)
- [x] Send email when email on file (both channels used when both available)
- [x] Return emailSent/smsSent/emailError/smsError from procedure
- [x] Update handleSend in BreedersDashboard to pass phone alongside email
- [x] Replace alert with toast showing which channels were used
- [x] Update info box to show both email and phone recipients
- [x] Rename "Send Email" button to "Send Confirmation"
- [x] Add toast import to BreedersDashboard

## Post-Class Google Review SMS (Aug 7, 2026)
- [x] Add reviewTextLogs table to schema (lumaEventId, lumaGuestId, guestName, phone, status, etc.)
- [x] Run migration to create reviewTextLogs table
- [x] Build reviewTextSender.ts — fetches events ending 1.5-2.5h ago, fetches guests, sends review SMS
- [x] Dedup check — skip guests already texted for same event
- [x] Register /api/scheduled/review-text endpoint in server index.ts
- [x] Add reviewTextsRouter with list, stats, triggerNow procedures
- [x] Build ReviewTexts admin page with stats cards, send log table, Run Now button
- [x] Add Review Texts to AdminNav More dropdown
- [x] Register /admin/review-texts route in App.tsx
- [x] Register heartbeat cron job (requires deploy first — see below)
- [x] Register heartbeat cron job — task_uid: YfCxi6NHG4eJ7EPcXq5n7X, runs every 30 min
- [x] Register heartbeat cron job (requires deploy first — see below)
- [x] Register heartbeat cron job (requires deploy first — see below)
- [x] Register heartbeat cron job (requires deploy first — see below)
- [x] Register heartbeat cron job (requires deploy first — see below)
- [x] Register heartbeat cron job (requires deploy first — see below)
- [x] Register heartbeat cron job (requires deploy first — see below)
- [x] Register heartbeat cron job (requires deploy first — see below)
- [x] Register heartbeat cron job (requires deploy first — see below)
- [x] Register heartbeat cron job (requires deploy first — see below)

## Breeder Lead Detail Page Fix (Aug 10, 2026)
- [x] Fix BreederLeadDetail page showing blank/nothing when clicking an imported lead
- [x] Root cause: breederLeadActivities DB table had column name mismatch (type vs activityType) and type mismatch (timestamp vs bigint)
- [x] Renamed DB column `type` → `activityType` to match Drizzle schema
- [x] Changed DB column `createdAt` from timestamp to bigint to match Drizzle schema
- [x] Dropped unused `metadata` column from breederLeadActivities
- [x] Added proper error handling to BreederLeadDetail.tsx (auth check, error state display)

## Remove 18+ Age Confirmation from Signing Portal (Aug 10, 2026)
- [x] Remove isAdult state variable from SignDocuments.tsx
- [x] Remove age confirmation checkbox from the signing form
- [x] Remove age validation check from handleSubmit
- [x] Remove !isAdult from submit button disabled condition

## Kijiji Contact Info Extraction (Aug 10, 2026)
- [x] Add extractContactInfo function to kijijiScraper.ts (regex for phone, email, Instagram)
- [x] Add contactInfo field to KijijiListing interface
- [x] Extract contact info from all listing descriptions during search and import
- [x] Save phone/email to breederLeads DB on import
- [x] Append Instagram handle to listing description on import
- [x] Show contact info badges (phone, email, IG) in Kijiji search results UI
- [x] Log extracted contact info in activity timeline on import

## Staff Availability & Org Chart (Aug 11, 2026)
- [x] Add staffAvailability table to drizzle schema (staffId, startDate, endDate, leaveType, notes, createdAt)
- [x] Add tRPC procedures: getOrgChart, setAvailability, getAvailability, deleteAvailability
- [x] Build /admin/staff-availability page with visual org chart tree (CEO → roles → staff)
- [x] Show availability status badges on each staff node (available/vacation/leave)
- [x] Add click-to-mark-leave modal with date range picker and leave type selector
- [x] Add Staff Availability card to APY HQ tool grid
- [x] Add route /admin/staff-availability to App.tsx

## New Private-Event Inquiry (Aug 11, 2026)
- [x] Review the new inquiry details and prepare the appropriate quote or booking next step
- [x] Build a self-serve inquiry-to-quote workflow with tailored response drafting, Luma payment-link generation, and a final owner preview before sending
- [x] Test the payment-offer drafting logic using Taylor Stanbury’s corporate wellness inquiry without creating or emailing a live offer before the final date and time are approved

## Private-Event Phone Validation (Aug 11, 2026)
- [x] Require a complete valid Canadian phone number on the private-event inquiry form and revalidate it on the server

## APY HQ Navigation (Aug 12, 2026)
- [x] Restore the People category and Staff Availability entry in the APY HQ tool grid

## Direct Team Management (Aug 12, 2026)
- [x] Let APY HQ admins add a team member directly with role and studio location, including Operations Managers for Kitchener, Hamilton, and Oakville

## Org Chart Refinement (Aug 12, 2026)
- [x] Redesign the org chart into a wider, location-first layout with Operations Manager before Yoga Instructor
- [x] Show six Puppy Monitor slots for each studio location
- [x] Add central BDR and Social Media Specialist positions to the APY-wide team
- [x] Allow admins to remove team members safely from the org chart

## Weekend Leadership Coverage (Aug 13, 2026)
- [x] Track Saturday and Sunday availability for each Operations Manager and Yoga Instructor by studio
- [x] Surface away/uncovered weekend leadership shifts and allow coverage assignments

## Unified Class Staffing Calendar (Aug 13, 2026)
- [x] Connect the Puppy Schedule/Breeder Calendar to weekend leadership coverage for each scheduled class
- [x] Require and assign two available Puppy Monitors for every class day
- [x] Flag any class that lacks Operations Manager, Yoga Instructor, or two Puppy Monitor assignments

## Latest-Version Visibility (Aug 13, 2026)
- [x] Investigate why the latest staffing changes are not visible in GitHub or on the deployed site and restore the correct version

## Unified Weekend Staffing Board (Aug 13, 2026)
- [x] Add scheduled breeder/class rows and two-Puppy-Monitor assignments to the Weekend Leadership board
- [x] Make the Weekend Leadership board the one place to manage all Saturday/Sunday staffing coverage

## Offer-Letter Notice Requirement (Aug 19, 2026)
- [x] Add a consistent two-week written-notice clause to every future APY offer-letter type

## Taya Dual-Role Offers (Aug 19, 2026)
- [x] Verify Taya’s applicant records and current signing status
- [x] Add a role-specific remote BDR offer-letter template with 7% inbound and 10% outbound commission terms
- [x] Prepare Taya Viera’s Yoga Instructor and BDR offers for final approval before sending
- [x] Send separate Yoga Instructor and BDR signing offers to Taya Viera after final owner approval
- [x] Review and approve the independent-contractor BDR commission terms before adding them to Taya’s offer

## Prospective Contractor Set-Off Terms (Aug 19, 2026)
- [x] Add a prospective independent-contractor clause covering two-week notice, direct documented replacement costs, written notice, and a limited set-off authorization

## APY Agreement Standardization (Aug 19, 2026)
- [x] Add a two-week written-notice expectation to every future APY offer letter and agreement template
- [x] Update future independent-contractor terms so APY determines and offsets reasonable documented direct replacement costs

## APY Agreement Standardization (Aug 19, 2026)
- [x] Add a two-week written-notice expectation to every future APY offer letter and agreement template
- [x] Limit direct-cost recovery and set-off language to independent-contractor templates only

## Operations Specialist Offer (Aug 19, 2026)
- [x] Create a dedicated $20/hour Operations Specialist offer-letter type with APY class-operations responsibilities and signing support

## Kitchener Operations Specialist Opening (Aug 19, 2026)
- [x] Publish an Operations Specialist — Kitchener position on the public careers page and route applications to the existing hiring workflow

## Oakville Operations Specialist Alignment (Aug 19, 2026)
- [x] Align the Oakville Operations Specialist listing with the Kitchener role and update compensation to $20/hour

## Job Application Reliability Audit (Aug 19, 2026)
- [x] Audit and harden the public application flow, submission validation, storage, and admin review experience for higher applicant volume
- [x] Increase reliable job-application video upload capacity with resumable chunked uploads and clear recovery states

## Manual Puppy Monitor Team Membership (Aug 19, 2026)
- [x] Keep Puppy Monitor job applicants out of the APY HQ team and availability board until an Operations Manager manually adds them after onboarding

## APY HQ Team Contact Methods (Aug 19, 2026)
- [x] Allow team members to be added with either a valid email address or a phone number, while requiring at least one contact method

## Available Project Updates (Aug 19, 2026)
- [x] Review newly available project updates and assess whether any are safe to apply to the deployed application

## Approved Update Integration (Aug 21, 2026)
- [x] Integrate PR #2 cancellation refresh and repository cleanup into the deployed codebase
- [x] Integrate the Stripe production-startup safeguard without replacing current APY features

## Production Deployment Repair (Aug 20, 2026)
- [x] Prevent Stripe from crashing server startup when production Stripe credentials are not configured
- [x] Correct Revenue Dashboard TypeScript errors and verify deployment health

## Cancellation Notification Delivery (Aug 21, 2026)
- [x] Diagnose and fix cancellation SMS and call notifications that remain queued instead of reaching guests

## Hiring Interview Statuses (Aug 21, 2026)
- [x] Separate Interview Request Sent from Interview Scheduled so only confirmed date-and-time bookings appear as scheduled

## Available Project Updates (Aug 21, 2026)
- [x] Review newly available project updates and assess whether any are safe to integrate into the deployed application
- [x] Inspect the newly announced update and compare it with the current deployed code before integration

## Breeder-Scheduled Luma Events (Aug 25, 2026)
- [x] Enable group registration for Luma events created from a breeder-scheduled class
- [x] Remove the unnecessary Standard Free ticket from created Luma class events
- [x] Apply cranberry tint, hypnotic pattern, and light appearance to created Luma class events

## Luma Class Creation Preview (Aug 25, 2026)
- [x] Add an admin preview card showing the Luma event settings before a breeder-scheduled class is finalized

## Mobile Homepage Hero Image Reliability (Aug 26, 2026)
- [x] Ensure the mobile homepage hero image loads reliably and provides a graceful fallback instead of exposing an incomplete blank state

## Available Project Update Review (Aug 27, 2026)
- [x] Inspect the newly available project update and assess whether it is safe to integrate into the deployed application

## Approved PR #4 Integration (Aug 27, 2026)
- [x] Merge and publish the APY admin workflow and Luma attendance reliability improvements from pull request #4

## Available Project Updates (Aug 27, 2026)
- [x] Inspect newly available project updates and assess whether they are safe to integrate into the deployed application

## Approved Staff Training & Schedule Notifications (Aug 27, 2026)
- [x] Merge, migrate, validate, and publish the staff training and guarded event-notification workflow from pull request #5
- [x] Correct the APY Training Centre route so it is reachable from the admin portal

## Free Luma Cancellation Rebooking Codes (Aug 27, 2026)
- [x] Create a 100% free calendar-level Luma code when cancelling a class so guests can rebook into any eligible APY class

## APY Training Centre Improvement (Aug 27, 2026)
- [x] Improve the Training Centre’s role-based lesson flow, progress guidance, completion experience, and visual hierarchy for staff onboarding

## APY HQ Training Administration (Aug 28, 2026)
- [x] Replace the vague Admin Training Review state with a clear training-management view for completion status, staff follow-up, and lesson oversight

## APY HQ Role-Based Permissions (Aug 28, 2026)
- [x] Define and enforce separate APY HQ access for Owner/Admin, Operations Manager, Yoga Instructor, and Puppy Monitor roles
- [x] Allow staff identity matching and access invitations through either their APY HQ email or phone number
- [x] Give Operations Managers full operational APY HQ access while restricting only Invoice Dashboard and Revenue Dashboard

## Staff Access Command Centre Placement (Aug 28, 2026)
- [x] Move Staff Access from hidden secondary navigation into the primary APY HQ Command Centre

## APY HQ Command Centre Operational Audit (Aug 28, 2026)
- [x] Audit all APY HQ tools, workflows, access paths, and integration dependencies from an owner and Operations Manager perspective
- [x] Deliver a prioritized, practical Command Centre improvement roadmap for operating AfroPuppyYoga

## GitHub Repository Synchronization (Aug 28, 2026)
- [x] Verify the reconnected aybello GitHub authorization and synchronize the latest published project changes to the repository

## Available Project Update Review (Aug 28, 2026)
- [x] Inspect the newly available project update and assess whether it is safe to integrate into the deployed codebase

## Approved P0 Security & Operational Integrity Update (Aug 28, 2026)
- [x] Merge, migrate, validate, and publish the approved P0 security and operational-integrity update from pull request #6

## Remaining Pull Request Review (Aug 28, 2026)
- [x] Review the remaining dependent pull requests in sequence and recommend the next safe integration

## Approved Run APY Dashboard (Aug 28, 2026)
- [x] Restrict the Run APY dashboard to Owner and Operations Manager roles, then merge, validate, and publish pull request #7
- [x] Rebase the Run APY dashboard on current APY HQ authorization and resolve its TypeScript issues before merging
- [x] Resolve the Run APY dashboard loading state before publishing the operations command centre

## Remaining APY HQ Update Stack (Aug 28, 2026)
- [x] Review, correct as needed, merge, validate, and publish PR #8 class lifecycle
- [x] Review, correct as needed, merge, validate, and publish PR #9 private-event and hiring workflows
- [x] Preserve manual APY HQ team membership when integrating PR #9 hiring workflow changes
- [x] Preserve Operations Manager access to routine private-event Luma controls while retaining owner approval for exceptions
- [x] Align PR #9 private-event client controls with APY HQ owner-versus-operations access visibility
- [x] Diagnose and resolve the private-event inquiry list loading state observed after PR #9 integration
- [x] Confirm the new private-event audit timeline resolves for existing legacy inquiries without creating or sending anything
- [x] Review, correct as needed, merge, validate, and publish PR #10 breeder workflow
- [x] Use APY's approved Warmly sign-off in the PR #10 breeder confirmation email and plain-text message
- [x] Keep breeder logistics times separate from public Luma class slots in PR #10 and enforce APY's three regular-class start times
- [x] Correct PR #10's TiDB migration order before adding its breeder confirmation idempotency key
- [x] Verify the breeder database loads its existing records and management controls after the PR #10 migration
- [x] Verify Run APY remains fully available after the breeder workflow migration and preserves its normal operational actions
- [x] Reconcile Run APY's breeder follow-up query with the deployed legacy table so due actions appear without relying on compatibility fallback
- [x] Review, correct as needed, merge, validate, and publish PR #11 applicant upload resiliency
- [x] Verify the applicant form renders the resilient 500MB video and resume upload controls without submitting media or an application
- [x] Make the PR #8 schedule lifecycle migration compatible with TiDB column/index ordering before applying it
- [x] Verify and resolve the Run APY loading state while validating PR #8 lifecycle changes
- [x] Keep Run APY available until PR #10 creates the breeder follow-up table it will later consume
- [x] Confirm Run APY uses the explicit owner-and-Operations-Manager guard and cannot broaden team-member access
- [x] Diagnose the remaining Run APY client loading state after the backend missing-table repair
- [x] Complete a fresh owner-browser verification after the Run APY query recovery reloads
- [x] Inspect the actual TiDB/Drizzle wrapped error shape before finalizing the narrowly scoped Run APY fallback
- [x] Treat only the verified pre-PR #10 breeder follow-up column mismatch as an empty Run APY feed
- [x] Verify Schedule Calendar and Puppy Class Schedule load, with the class editor showing the APY HQ and Luma synchronization state

## Staff Directory and Private-Event Pricing Fixes (Aug 29, 2026)
- [x] Make employee removal remove the person from APY HQ while preserving the employee record and clearing active staffing and access
- [x] Create a database-backed Employee Directory with active and inactive staff records
- [x] Correct Luma private-event booking prices so HST is charged only once

## Homepage Hero Loading Transition (Aug 29, 2026)
- [x] Remove the visible purple blur/placeholder that appears before the homepage hero image loads
