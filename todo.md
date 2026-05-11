
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
- [ ] Add jobApplications table to drizzle schema
- [ ] Add tRPC procedure: submitApplication (upload video to S3, save to DB, send email notification)
- [ ] Build /careers page with 4 job listings (Puppy Monitor KW, Puppy Monitor Hamilton, Yoga Instructor KW, Yoga Instructor BDR)
- [ ] Application modal with questions: name, email, phone, why APY, relevant experience, video upload
- [ ] Send email notification to afropuppyyogaofficial@gmail.com on new application
- [ ] Add Careers link to navbar and footer

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
- [ ] Add deleteApplication tRPC procedure to careers router (hard delete from DB + S3 cleanup)
- [ ] Add delete button (trash icon) to each application row in ApplicationsDashboard
- [ ] Add confirmation dialog before deleting to prevent accidental deletions

## Interview Invite Email Update
- [ ] Update interview invite email template to use Google Calendar booking link instead of fixed date/time
- [ ] Simplify interview invite modal: booking link field (pre-filled) + optional notes only
- [ ] Update careers router: replace date/time/format fields with bookingLink field

## Magic Link Staff Login
- [ ] Add staffInvites table to schema (id, email, name, token, expiresAt, usedAt, createdAt)
- [ ] Add staff session support (staffSession cookie separate from Manus OAuth)
- [ ] Build inviteStaff procedure (owner sends magic link email to staff)
- [ ] Build verifyMagicLink procedure (validates token, creates staff session)
- [ ] Build listStaff and revokeStaff procedures
- [ ] Build /admin/staff-management page (invite, list active staff, revoke access)
- [ ] Build /staff-login page (landing page for magic link token verification)
- [ ] Gate all admin routes to allow staff sessions in addition to Manus owner
- [ ] Test end-to-end magic link flow

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
