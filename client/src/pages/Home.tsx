/* ============================================================
   Home Page — AfroPuppyYoga
   Design: Warm Afro-Wellness Editorial
   Sections: Hero → Experience → LumaCalendar → Memberships → About → Our Story → Private Events →
   Gallery → InstagramFeed → Reviews → Gift Cards → EthicalStandards → FAQ → Contact
   ============================================================ */
import Navbar from "@/components/Navbar";
import Hero from "@/components/sections/Hero";
import Experience from "@/components/sections/Experience";
import About from "@/components/sections/About";
import OurStory from "@/components/sections/OurStory";
import LumaCalendar from "@/components/sections/LumaCalendar";
import PrivateEvents from "@/components/sections/PrivateEvents";
import Gallery from "@/components/sections/Gallery";
import InstagramFeed from "@/components/sections/InstagramFeed";
import Reviews from "@/components/sections/Reviews";
import GiftCards from "@/components/sections/GiftCards";
import Memberships from "@/components/sections/Memberships";
import FAQ from "@/components/sections/FAQ";
import EthicalStandards from "@/components/sections/EthicalStandards";
import Contact from "@/components/sections/Contact";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import { useScrollDepthTracking, useTimeOnPageTracking } from "@/hooks/useAnalytics";
import { useEffect } from "react";

export default function Home() {
  useScrollDepthTracking();
  useTimeOnPageTracking();
  useEffect(() => {
    document.title = "AfroPuppyYoga | Puppy Yoga Studio in Canada";
  }, []);
  return (
    <div className="min-h-screen bg-[#FEFAF4]">
      <Navbar />
      <main>
        <Hero />
        <Experience />
        <LumaCalendar />
        <Memberships />
        <About />
        <OurStory />
        <PrivateEvents />
        <Gallery />
        <InstagramFeed />
        <Reviews />
        <GiftCards />
        <EthicalStandards />
        <FAQ />
        <Contact />
      </main>
      <Footer />
      <ScrollToTop />
    </div>
  );
}
