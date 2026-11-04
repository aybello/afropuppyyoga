import { useEffect } from "react";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import { useSeoMeta } from "@/hooks/useSeoMeta";

export default function QuickBooksDisconnect() {
  useSeoMeta({
    title: "Disconnect QuickBooks | AfroPuppyYoga",
    description:
      "How the APY owner can revoke the read-only QuickBooks Online connection used for internal reporting.",
    canonical: "https://afropuppyyoga.ca/quickbooks-disconnect",
  });
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  return (
    <div className="min-h-screen bg-[#FEFAF4] text-[#34221D]">
      <Navbar />
      <main className="pt-28 md:pt-32 pb-20 md:pb-24">
        <div className="container max-w-3xl">
          <p className="font-body text-xs uppercase tracking-[0.18em] text-brand-link font-semibold">
            AfroPuppyYoga
          </p>
          <h1 className="font-display text-[clamp(2.5rem,5vw,3.75rem)] font-medium leading-[1.12] tracking-[-0.025em] mt-4">
            Disconnect QuickBooks Online
          </h1>
          <div className="mt-8 bg-white border border-[#E8D8D0] rounded-2xl p-6 md:p-8 space-y-4">
            <p className="font-body text-base text-[#71574F] leading-7">
              The APY QuickBooks Online connection is an internal,
              owner-controlled reporting integration. It is read-only and does
              not create payments, change transactions, or reconcile accounts.
            </p>
            <p className="font-body text-base text-[#71574F] leading-7">
              To revoke APY’s access, the APY owner can sign in to APY HQ, open{" "}
              <strong>More → QuickBooks</strong>, and choose{" "}
              <strong>Disconnect</strong>. This revokes APY’s QuickBooks access
              and stops future daily imports. Existing records previously
              imported into APY HQ and any already-exported Google Sheet remain
              under the owner’s control.
            </p>
            <p className="font-body text-base text-[#71574F] leading-7">
              If you need assistance, contact{" "}
              <a
                className="text-brand-link underline"
                href="mailto:afropuppyyoga@gmail.com"
              >
                afropuppyyoga@gmail.com
              </a>
              .
            </p>
            <Link
              href="/staff-access"
              className="inline-flex items-center rounded-full bg-primary px-6 py-3 min-h-12 font-body text-sm font-semibold text-[#34221D] hover:bg-primary-hover transition-colors motion-reduce:transition-none"
            >
              Open APY HQ access
            </Link>
          </div>
        </div>
      </main>
      <Footer />
      <ScrollToTop />
    </div>
  );
}
