import { useEffect } from "react";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import { useSeoMeta } from "@/hooks/useSeoMeta";

export default function QuickBooksDisconnect() {
  useSeoMeta({ title: "Disconnect QuickBooks | AfroPuppyYoga", description: "How the APY owner can revoke the read-only QuickBooks Online connection used for internal reporting.", canonical: "https://afropuppyyoga.ca/quickbooks-disconnect" });
  useEffect(() => { window.scrollTo(0, 0); }, []);
  return <div className="min-h-screen bg-[#FEFAF4] text-[#1A0A12]"><Navbar /><main className="pt-28 pb-20"><div className="container max-w-3xl"><p className="font-body text-xs uppercase tracking-[0.18em] text-[#8B2252] font-bold">AfroPuppyYoga</p><h1 className="font-display text-4xl md:text-5xl mt-3">Disconnect QuickBooks Online</h1><div className="mt-8 bg-white border border-[#F0DCE5] rounded-2xl p-6 md:p-8 space-y-4"><p className="font-body text-[#5C4031] leading-relaxed">The APY QuickBooks Online connection is an internal, owner-controlled reporting integration. It is read-only and does not create payments, change transactions, or reconcile accounts.</p><p className="font-body text-[#5C4031] leading-relaxed">To revoke APY’s access, the APY owner can sign in to APY HQ, open <strong>More → QuickBooks</strong>, and choose <strong>Disconnect</strong>. This revokes APY’s QuickBooks access and stops future daily imports. Existing records previously imported into APY HQ and any already-exported Google Sheet remain under the owner’s control.</p><p className="font-body text-[#5C4031] leading-relaxed">If you need assistance, contact <a className="text-[#8B2252] underline" href="mailto:afropuppyyoga@gmail.com">afropuppyyoga@gmail.com</a>.</p><Link href="/staff-access" className="inline-flex items-center rounded-full bg-[#1F6B52] px-5 py-2.5 font-body text-sm font-semibold text-white hover:bg-[#15503D]">Open APY HQ access</Link></div></div></main><Footer /><ScrollToTop /></div>;
}
