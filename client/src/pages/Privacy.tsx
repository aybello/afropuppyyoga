import { useEffect } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import { useSeoMeta } from "@/hooks/useSeoMeta";

const sections = [
  ["Information we handle", "AfroPuppyYoga handles the details needed to provide classes, private events, customer support, staff operations, and business administration. This can include contact details, booking details, communications, and information submitted through our website or APY HQ."],
  ["How we use information", "We use information to respond to requests, provide booked services, manage staffing and operations, improve the customer experience, protect our systems, and meet reasonable business recordkeeping needs."],
  ["QuickBooks Online and financial analysis", "QuickBooks Online is optional and owner-controlled. When the APY owner connects it, APY requests read-only accounting access to import transaction facts for internal management reporting. APY does not create payments, edit QuickBooks transactions, or reconcile accounts. The owner can disconnect the integration from APY HQ, which revokes APY’s QuickBooks access and stops future imports."],
  ["Google Sheets and AI analysis", "The APY owner may export imported QuickBooks transaction data to a private Google Sheet under the owner-selected Google account. APY’s optional AI analysis uses an aggregate summary rather than account numbers or individual transaction descriptions, and requires the owner to approve each analysis request in APY HQ."],
  ["Sharing and service providers", "We use carefully selected service providers to operate the website, bookings, communications, storage, and approved integrations. We do not sell personal information. We only share information when needed to provide a requested service, operate APY, meet legal obligations, or protect our rights and safety."],
  ["Security and retention", "We apply reasonable technical and organizational safeguards. No system can guarantee absolute security. We retain information only for as long as reasonably needed for the purposes described here, operational records, and applicable obligations."],
  ["Your questions", "For questions about this notice or a request about your information, contact AfroPuppyYoga at afropuppyyoga@gmail.com. We may need to verify identity before acting on a request."],
];

export default function Privacy() {
  useSeoMeta({ title: "Privacy Notice | AfroPuppyYoga", description: "How AfroPuppyYoga handles booking, operational, and optional QuickBooks integration information.", canonical: "https://afropuppyyoga.ca/privacy" });
  useEffect(() => { window.scrollTo(0, 0); }, []);
  return <div className="min-h-screen bg-[#FEFAF4] text-[#1A0A12]"><Navbar /><main className="pt-28 pb-20"><div className="container max-w-4xl"><p className="font-body text-xs uppercase tracking-[0.18em] text-[#8B2252] font-bold">AfroPuppyYoga</p><h1 className="font-display text-4xl md:text-5xl mt-3">Privacy Notice</h1><p className="font-body text-sm text-[#6B4C3B] mt-4 max-w-2xl">Last updated September 7, 2026. This notice explains how AfroPuppyYoga handles information in its public website, APY HQ, and owner-controlled business integrations.</p><div className="mt-10 space-y-5">{sections.map(([title, text]) => <section key={title} className="bg-white border border-[#F0DCE5] rounded-2xl p-6 md:p-8"><h2 className="font-display text-2xl">{title}</h2><p className="font-body text-[#5C4031] leading-relaxed mt-3">{text}</p></section>)}</div></div></main><Footer /><ScrollToTop /></div>;
}
