
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
- [ ] Add GMAIL_APP_PASSWORD secret (email notifications)
- [ ] Add LUMA_API_KEY secret (Luma calendar proxy)
