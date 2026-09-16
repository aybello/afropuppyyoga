import { useEffect } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import { useSeoMeta } from "@/hooks/useSeoMeta";

const sections = [
  ["Using AfroPuppyYoga services", "AfroPuppyYoga provides puppy-yoga classes, private-event information, and related services. Bookings, waivers, availability, and event details may have additional terms shown when you book or communicate with APY."],
  ["APY HQ", "APY HQ is for authorized APY team members and the APY owner. Users must keep their access credentials private, use only the features appropriate to their role, and report suspected unauthorized access promptly."],
  ["Optional QuickBooks integration", "The owner-controlled QuickBooks Online integration is for internal management reporting. It is read-only and does not create payments, change transactions, or reconcile accounts. Reports and optional AI summaries are management tools, not accounting, tax, legal, or financial advice. The APY owner remains responsible for reviewing records and using qualified professionals where needed."],
  ["Acceptable use", "You may not interfere with the website or APY HQ, attempt unauthorized access, misuse content or data, or use the services in a way that violates applicable law or another person’s rights."],
  ["Changes and contact", "We may update these terms when services or applicable requirements change. For questions, contact afropuppyyoga@gmail.com."],
];

export default function Terms() {
  useSeoMeta({ title: "Terms of Use | AfroPuppyYoga", description: "Terms for AfroPuppyYoga’s public website, APY HQ, and optional owner-controlled QuickBooks integration.", canonical: "https://afropuppyyoga.ca/terms" });
  useEffect(() => { window.scrollTo(0, 0); }, []);
  return <div className="min-h-screen bg-[#FEFAF4] text-[#1A0A12]"><Navbar /><main className="pt-28 pb-20"><div className="container max-w-4xl"><p className="font-body text-xs uppercase tracking-[0.18em] text-[#8B2252] font-bold">AfroPuppyYoga</p><h1 className="font-display text-4xl md:text-5xl mt-3">Terms of Use</h1><p className="font-body text-sm text-[#6B4C3B] mt-4 max-w-2xl">Last updated September 7, 2026. These terms describe appropriate use of the AfroPuppyYoga website, APY HQ, and optional business integrations.</p><div className="mt-10 space-y-5">{sections.map(([title, text]) => <section key={title} className="bg-white border border-[#F0DCE5] rounded-2xl p-6 md:p-8"><h2 className="font-display text-2xl">{title}</h2><p className="font-body text-[#5C4031] leading-relaxed mt-3">{text}</p></section>)}</div></div></main><Footer /><ScrollToTop /></div>;
}
