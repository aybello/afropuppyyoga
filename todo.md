
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
- [ ] Restyle InvoiceSubmit.tsx to match APY brand (warm cream bg, APY fonts, hot pink accents, Navbar/Footer)
- [ ] Restyle InvoiceDashboard.tsx to match APY brand (same palette, consistent typography)
- [ ] Add admin dashboard link to the invoice submission page (owner-only, visible when logged in)

## Careers Page
- [ ] Build /careers page with APY brand design
- [ ] Add open positions section (yoga instructor, operations specialist, photographer/videographer, puppy handler)
- [ ] Add application form or link to apply
- [ ] Add careers link to Navbar
