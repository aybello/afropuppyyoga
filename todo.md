
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
- [ ] Fix video upload: replace base64-in-body with presigned S3 upload URL flow
- [ ] Add interview invite email with date/time modal in Applications Dashboard
- [ ] Add offer letter email button in Applications Dashboard
- [ ] Add rejection letter email button in Applications Dashboard
- [ ] Update application status enum: add interview_scheduled, accepted
- [ ] Wire automated emails via nodemailer/Gmail SMTP for all three pipeline stages
