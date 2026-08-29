/* ============================================================
   Home Page — AfroPuppyYoga
   Design: Warm Afro-Wellness Editorial
   Sections: Hero → Experience → LumaCalendar → Memberships → About → Our Story → Private Events →
   Gallery → InstagramFeed → Reviews → Gift Cards → EthicalStandards → FAQ → Contact
   ============================================================ */
import { lazy, Suspense } from "react";
import Navbar from "@/components/Navbar";
import SummerSaleBanner from "@/components/SummerSaleBanner";
import Hero from "@/components/sections/Hero";
import Experience from "@/components/sections/Experience";
import RewardsStrip from "@/components/RewardsStrip";
import ScrollToTop from "@/components/ScrollToTop";
import ChatbotWidget from "@/components/ChatbotWidget";
import DeferredSection from "@/components/DeferredSection";
import { useScrollDepthTracking, useTimeOnPageTracking } from "@/hooks/useAnalytics";
import { useSeoMeta } from "@/hooks/useSeoMeta";
import { useEffect } from "react";

// Lazy-load below-the-fold sections — they load as the user scrolls, not on initial paint
const LumaCalendar = lazy(() => import("@/components/sections/LumaCalendar"));
const Memberships = lazy(() => import("@/components/sections/Memberships"));
const About = lazy(() => import("@/components/sections/About"));
const OurStory = lazy(() => import("@/components/sections/OurStory"));
const PrivateEvents = lazy(() => import("@/components/sections/PrivateEvents"));
const Gallery = lazy(() => import("@/components/sections/Gallery"));
const InstagramFeed = lazy(() => import("@/components/sections/InstagramFeed"));
const Reviews = lazy(() => import("@/components/sections/Reviews"));
const OurValues = lazy(() => import("@/components/sections/OurValues"));
const LoyaltyProgram = lazy(() => import("@/components/sections/LoyaltyProgram"));
const GiftCards = lazy(() => import("@/components/sections/GiftCards"));
const EthicalStandards = lazy(() => import("@/components/sections/EthicalStandards"));
const FAQ = lazy(() => import("@/components/sections/FAQ"));
const Contact = lazy(() => import("@/components/sections/Contact"));
const Footer = lazy(() => import("@/components/Footer"));

// Lightweight placeholder shown while a section loads
function SectionFallback() {
  return <div className="w-full py-16 bg-[#FEFAF4]" aria-hidden="true" />;
}

export default function Home() {
  useScrollDepthTracking();
  useTimeOnPageTracking();
  useSeoMeta({
    title: "AfroPuppyYoga — Puppy Yoga in Kitchener, Hamilton & Oakville",
    description: "Guided 60-min puppy yoga in Kitchener-Waterloo, Hamilton & Oakville. Afro-beat music, ethical puppies, 494+ five-star reviews. Book your class today.",
    canonical: "https://afropuppyyoga.ca/",
  });
  return (
    <div className="min-h-screen bg-[#FEFAF4]">
      <Navbar />
      <main>
        {/* Above the fold — loaded immediately */}
        <Hero />
        <RewardsStrip />
        <Experience />

        {/* Below the fold — lazy loaded */}
        <DeferredSection minHeight="34rem"><Suspense fallback={<SectionFallback />}><LumaCalendar /></Suspense></DeferredSection>
        <DeferredSection><Suspense fallback={<SectionFallback />}><Memberships /></Suspense></DeferredSection>
        <DeferredSection><Suspense fallback={<SectionFallback />}><About /></Suspense></DeferredSection>
        <DeferredSection><Suspense fallback={<SectionFallback />}><OurStory /></Suspense></DeferredSection>
        <DeferredSection><Suspense fallback={<SectionFallback />}><PrivateEvents /></Suspense></DeferredSection>
        <DeferredSection minHeight="42rem"><Suspense fallback={<SectionFallback />}><Gallery /></Suspense></DeferredSection>
        <DeferredSection minHeight="40rem"><Suspense fallback={<SectionFallback />}><InstagramFeed /></Suspense></DeferredSection>
        <DeferredSection><Suspense fallback={<SectionFallback />}><Reviews /></Suspense></DeferredSection>
        <DeferredSection><Suspense fallback={<SectionFallback />}><OurValues /></Suspense></DeferredSection>
        <DeferredSection><Suspense fallback={<SectionFallback />}><LoyaltyProgram /></Suspense></DeferredSection>
        <DeferredSection><Suspense fallback={<SectionFallback />}><GiftCards /></Suspense></DeferredSection>
        <DeferredSection><Suspense fallback={<SectionFallback />}><EthicalStandards /></Suspense></DeferredSection>
        <DeferredSection><Suspense fallback={<SectionFallback />}><FAQ /></Suspense></DeferredSection>
        <DeferredSection><Suspense fallback={<SectionFallback />}><Contact /></Suspense></DeferredSection>
      </main>
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
      <ScrollToTop />
      <ChatbotWidget />
    </div>
  );
}
