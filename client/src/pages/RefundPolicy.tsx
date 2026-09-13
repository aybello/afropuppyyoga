import { useEffect } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import { useSeoMeta } from "@/hooks/useSeoMeta";
import {
  CANCELLATION_CLASS_CREDIT_NOTICE,
  CUSTOMER_CHANGE_CLASS_CREDIT_NOTICE,
  FINAL_SALE_REFUND_NOTICE,
} from "@shared/refundPolicy";

const sections = [
  ["Final-sale tickets", FINAL_SALE_REFUND_NOTICE],
  ["When AfroPuppyYoga cancels a class", `${CANCELLATION_CLASS_CREDIT_NOTICE} The code gives 100% off a future AfroPuppyYoga class booked through our calendar. Class-credit codes do not expire and may be transferred to another person.`],
  ["If you need to change your own booking", `${CUSTOMER_CHANGE_CLASS_CREDIT_NOTICE} Where a class credit is available, it is issued as a code for a future class rather than as a refund. Credits are not issued for late cancellations or no-shows, except where APY approves a documented emergency.`],
  ["Transfers and questions", "Tickets and class-credit codes may be transferred to another person. Please contact APY before the class begins if you need help with a transfer, booking change, or credit code."],
];

export default function RefundPolicy() {
  useSeoMeta({
    title: "Refund Policy | AfroPuppyYoga",
    description: "AfroPuppyYoga ticket final-sale and class-credit policy.",
    canonical: "https://afropuppyyoga.ca/refund-policy",
  });
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="min-h-screen bg-[#FEFAF4] text-[#1A0A12]">
      <Navbar />
      <main className="pt-28 pb-20">
        <div className="container max-w-4xl">
          <p className="font-body text-xs uppercase tracking-[0.18em] text-[#8B2252] font-bold">AfroPuppyYoga</p>
          <h1 className="font-display text-4xl md:text-5xl mt-3">Refund Policy</h1>
          <p className="font-body text-sm text-[#6B4C3B] mt-4 max-w-2xl">Last updated September 13, 2026. This policy applies to AfroPuppyYoga class tickets and class-credit codes.</p>
          <div className="mt-10 space-y-5">
            {sections.map(([title, text]) => (
              <section key={title} className="bg-white border border-[#F0DCE5] rounded-2xl p-6 md:p-8">
                <h2 className="font-display text-2xl">{title}</h2>
                <p className="font-body text-[#5C4031] leading-relaxed mt-3">{text}</p>
              </section>
            ))}
          </div>
          <p className="font-body text-[#6B4C3B] mt-8">Questions about a booking or class credit? Contact <a className="text-[#8B2252] underline underline-offset-4" href="mailto:afropuppyyoga@gmail.com">afropuppyyoga@gmail.com</a>.</p>
        </div>
      </main>
      <Footer />
      <ScrollToTop />
    </div>
  );
}
