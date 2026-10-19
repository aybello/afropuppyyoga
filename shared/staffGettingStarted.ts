import { normalizeApyRole } from "./apyPermissions";

/** A short orientation, not a contract or a change to anyone's agreed role or terms. */
export function getRoleWelcome(role: string): { summary: string; expectations: string[] } {
  switch (normalizeApyRole(role)) {
    case "operations manager":
      return {
        summary: "Welcome to APY. Help the team deliver calm, well-coordinated events as Operations Manager.",
        expectations: [
          "Coordinate event readiness, team communication and guest flow.",
          "Support instructors and Puppy Monitors within your existing responsibilities.",
          "Keep operational issues and safety concerns clear in team handovers.",
        ],
      };
    case "operations specialist":
      return {
        summary: "Welcome to APY. As an Operations Specialist, you help each event run smoothly on site.",
        expectations: [
          "Support venue setup, guest check-in, class transitions and close-down.",
          "Coordinate with instructors, Puppy Monitors and breeder contacts on event logistics.",
          "Record operational concerns and escalate issues to APY leadership.",
        ],
      };
    case "yoga instructor":
      return {
        summary: "Welcome to APY. Bring clear, welcoming yoga instruction to the room.",
        expectations: [
          "Lead the yoga session using the existing class-flow and safety guidance.",
          "Keep movement calm and puppy-safe, with clear instructions for guests.",
          "Coordinate with Operations and Puppy Monitors while keeping your focus on teaching.",
        ],
      };
    case "movement instructor":
      return {
        summary: "Welcome to APY. Help guests enjoy gentle, inclusive guided movement.",
        expectations: [
          "Lead simple warm-ups, stretches and low-impact movement rather than yoga instruction or dance choreography.",
          "Offer comfortable options and keep movement slow and controlled around puppies.",
          "Coordinate the session with Operations and direct puppy-care concerns to Puppy Monitors.",
        ],
      };
    case "puppy monitor":
      return {
        summary: "Welcome to APY. Help puppies stay comfortable and guests interact with them safely.",
        expectations: [
          "Watch puppy wellbeing and support calm handling, rest and rotation.",
          "Keep the puppy area clean and stocked, and help with room resets.",
          "Share puppy-care and safety concerns with Operations and the breeder.",
        ],
      };
    case "social media intern":
    case "social media specialist":
      return {
        summary: "Welcome to APY's social media team. Help tell the APY story and build a welcoming online community.",
        expectations: [
          "Create and edit content in APY's brand voice through the existing approval workflow.",
          "Support community engagement and share useful content-performance insights.",
          "Handle account access, guest information and unpublished materials with care.",
        ],
      };
    default:
      return {
        summary: "Welcome to APY. This page brings together your existing documents, relevant training and invoice help.",
        expectations: [
          "Refer to your own signed documents for your agreed role and terms.",
          "Use the training relevant to your role as a reference.",
          "Ask APY if anything about your responsibilities is unclear.",
        ],
      };
  }
}

export const INVOICE_GUIDE_STEPS: { title: string; description: string }[] = [
  {
    title: "Prepare your invoice",
    description: "Include your name, contact email, invoice number and date, services, dates worked, location where relevant and total. Use your agreed rate or shift fee and actual hours or shifts. Include tax only if applicable under your actual obligations; this guide is not tax advice. Payment contact details are enough: never include passwords, sign-in codes or card details.",
  },
  {
    title: "Save a PDF",
    description: "The form accepts PDF only, up to 16MB. Choose a non-empty PDF and check that the details and totals are correct before uploading.",
  },
  {
    title: "Add your details and submit",
    description: "Choose Submit Invoice in APY HQ or open /submit-invoice; no login is needed. Enter your full name and email address, choose your invoice PDF, then select Submit Invoice.",
  },
  {
    title: "Wait for Invoice received",
    description: 'Wait for the "Invoice received" confirmation. It means your invoice was submitted for review, not approval or payment. Do not resubmit the same invoice after success; Submit another invoice is for a different invoice.',
  },
  {
    title: "Ask about corrections",
    description: "If a submitted invoice needs a correction or you are unsure whether it was received, contact afropuppyyoga@gmail.com with the invoice details rather than sending a duplicate.",
  },
];

export const INVOICE_EXAMPLE = `FICTIONAL EXAMPLE: NOT FOR SUBMISSION
Name: Alex Example
Email: Example@example.com
Bill to: AfroPuppyYoga
Invoice number: FICTIONAL-EXAMPLE
Invoice date: [Fictional date]
Service date: [Fictional service date]
Service: Example services (fictional)
Calculation: 2 hours x CA$25/hour = CA$50
Subtotal: CA$50
Illustrative total before any applicable tax: CA$50
Payment details: [Fictional placeholder only]

CA$25 is a fictional example, not an actual role rate or a promise of compensation. Use your own agreed rate or shift fee. Include tax only if applicable under your actual obligations; this is not tax advice. Never submit this example.`;

export const INVOICE_TEMPLATE = `INVOICE
Name: [Your full name]
Email: [Your email address]
Bill to: AfroPuppyYoga
Invoice number: [Your invoice reference]
Invoice date: [Date]
Service date(s): [Date(s) worked]
Services: [Description of services]
Hours or shifts: [Quantity, as agreed]
Agreed rate or shift fee: [Your agreed amount and currency]
Line amount(s): [Quantity x agreed rate, or agreed shift fee]
Subtotal: [Amount and currency]
Tax: [Include only if applicable under your actual obligations; otherwise omit]
Total: [Amount and currency]
Payment contact: [Your payment contact email if needed, never passwords or sign-in codes]

Use your agreed rate or shift fee. This template is not tax advice. Replace the placeholders with your actual details and save as a PDF before submitting.`;
