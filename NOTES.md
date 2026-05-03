# AfroPuppyYoga — Session Notes & Built Features

> **IMPORTANT FOR AI AGENTS:** Read this file AND `BUSINESS_CONTEXT.md` at the start of every session. Update this file at the end of every session with what was done and what's pending.

---

## How to Orient Quickly

1. Read `BUSINESS_CONTEXT.md` for brand, pricing, policies, and business context
2. Read `todo.md` for task history
3. Check `client/src/App.tsx` for all routes/pages
4. Check `drizzle/schema.ts` for all database tables
5. Check `server/routers/` for all backend features

---

## All Built Features & Pages

### Public Pages
| URL | File | Description |
|-----|------|-------------|
| `/` | `pages/Home.tsx` | Full homepage — Hero, Experience, LumaCalendar, Memberships, About, OurStory, PrivateEvents, Gallery, InstagramFeed, Reviews, GiftCards, EthicalStandards, FAQ, Contact |
| `/careers` | `pages/Careers.tsx` | Job listings — Yoga Instructor (KW), Puppy Monitor (KW), Puppy Monitor (Hamilton) |

### Staff / Internal Tools
| URL | File | Description |
|-----|------|-------------|
| `/predictor` | `pages/FillRatePredictor.tsx` | APY Fill Rate Predictor — AI-powered class demand forecasting using 61 sessions of Luma data (Jul 2025–Apr 2026) |
| `/breeder-calculator` | `pages/BreederCalculator.tsx` | Breeder revenue calculator |
| `/submit-invoice` | `pages/InvoiceSubmit.tsx` | Staff invoice submission portal — PDF upload, AI extraction |
| `/admin/invoices` | `pages/InvoiceDashboard.tsx` | Owner invoice dashboard — view all invoices, status management |
| `/admin/applications` | `pages/ApplicationsDashboard.tsx` | Owner job applications dashboard — view applicants, status management |
| `/staff` | `pages/StaffPortal.tsx` | Staff Portal hub — central page linking to all internal tools |

### Navigation to Admin
- Footer has a discreet "Staff Portal" link (20% opacity) → goes to `/staff` (the hub page)
- `/staff` hub page lists all 5 internal tools with descriptions and links
- Admin pages (`/admin/invoices`, `/admin/applications`) share a top nav bar (`AdminNav.tsx`) with tabs between the two pages and a "Back to Site" button

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `users` | Auth — Manus OAuth users |
| `invoices` | Staff invoice submissions with AI-extracted data |
| `jobApplications` | Career page applications with video uploads |

---

## Key Components

| Component | Purpose |
|-----------|---------|
| `Navbar.tsx` | Main site navigation — handles hash links on sub-pages by navigating to `/#section` |
| `AdminNav.tsx` | Shared admin navigation bar |
| `ChatbotWidget.tsx` | Floating chatbot powered by `chatbot-knowledge.ts` |
| `ScrollToTop.tsx` | Scroll-to-top button — uses pure CSS (framer-motion removed for performance) |
| `Footer.tsx` | Site footer with Staff Portal link |

---

## Server Routers

| Router | File | Key Procedures |
|--------|------|----------------|
| Auth | `_core/systemRouter.ts` | login, logout, me |
| Invoices | `routers/invoices.ts` | submitInvoice, getInvoices, updateStatus, extractData |
| Careers | `routers/careers.ts` | submitApplication, getApplications, updateApplicationStatus |
| Predictor | `routers/predictor.ts` | getPrediction, getHistoricalData |

---

## Performance Optimizations Applied

- All pages use `React.lazy()` + `Suspense` for code splitting
- `framer-motion` removed from `ScrollToTop.tsx` (replaced with CSS transitions)
- Vite manual chunk splitting: framer-motion, streamdown, React core, tRPC, Radix UI in separate chunks
- Careers page is single-column (not grid) to avoid height-matching issues

---

## Known Issues / Pending Items

- **⚠️ REMIND USER EVERY SESSION: Gmail app password for email notifications** — User wants auto-email to afropuppyyogaofficial@gmail.com when job applications come in. Needs 16-char app password: myaccount.google.com → Security → App passwords → create for "APY Website". Once provided, add as secret `GMAIL_APP_PASSWORD` and update `server/routers/careers.ts` to send via Nodemailer.
- **TypeScript errors (14 errors)** — Pre-existing TS config issue with `lib.esnext.d.ts` not found. These are non-breaking (dev server and build work fine) but should be resolved by upgrading TypeScript or fixing `tsconfig.json`.
- **Gift card Stripe flow** — "Buy a Gift Card" button on homepage goes nowhere. Needs Stripe integration.
- **Dedicated `/cancellation-policy` page** — Not yet built. Would be useful for linking in Luma event descriptions and confirmation emails.
- **Instagram feed** — Currently shows placeholder cards. Could be wired to real @afropuppyyoga posts.
- **LinkedIn auto-posting** — Discussed but not built. Risk of account restriction with browser automation.

---

## Session Log

### Session: May 2, 2026
**Changes made:**
- Fixed Careers page syntax error (corrupted JOB_LISTINGS object)
- Fixed navbar navigation from sub-pages (hash links now use `/#section` format)
- Changed Careers hero from dark to warm plum `#3D1A2E`
- Removed "Afro-Wellness Roots" from Careers values strip
- Added "Paid Volunteer" badge to both Puppy Monitor listings
- Built `/admin/applications` dashboard with status management
- Processed Eyerus Workalem invoice ($436.56, due Apr 14, 2026)
- Changed job listings from 2-column grid to single column
- Reordered: Yoga Instructor first, then KW PM, then Hamilton PM
- Built shared `AdminNav.tsx` component for admin pages
- Added "Staff Portal" link in footer
- Built `/staff` Staff Portal hub page with all 5 internal tools
- Updated footer Staff Portal link to point to `/staff`
- Added BDR (Business Development Representative) role to Careers page with Commission-Based badge
- Batch uploaded 9 invoice PDFs from Gmail to invoice dashboard
- Added delete button (hard delete) to invoice dashboard rows
- Fixed `LOGO_URL is not defined` error in InvoiceDashboard after header refactor
- Fixed job card expand state (lifted to parent, tracked per job ID)
- Added cancellation/refund policy to FAQ (short version, credit-first framing)
- Updated chatbot knowledge with full cancellation policy
- Replaced favicon.ico and apple-touch-icon.png with APY logo
- Performance: lazy loading, removed framer-motion from ScrollToTop, Vite chunk splitting
- Created `BUSINESS_CONTEXT.md` and `NOTES.md` (this file)

**Pending from this session:**
- Gmail app password needed for email notifications on applications
- Publish site to push all changes live to afropuppyyoga.ca
