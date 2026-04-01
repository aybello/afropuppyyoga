/* ============================================================
   Home Page — AfroPuppyYoga
   Design: Warm Afro-Wellness Editorial
   Sections: Hero → Experience → About → Private Events →
             Gallery → Reviews → Gift Cards → FAQ → Contact
   ============================================================ */
import Navbar from "@/components/Navbar";
import Hero from "@/components/sections/Hero";
import Experience from "@/components/sections/Experience";
import About from "@/components/sections/About";
import BookingBanner from "@/components/sections/BookingBanner";
import PrivateEvents from "@/components/sections/PrivateEvents";
import Gallery from "@/components/sections/Gallery";
import Reviews from "@/components/sections/Reviews";
import GiftCards from "@/components/sections/GiftCards";
import FAQ from "@/components/sections/FAQ";
import Contact from "@/components/sections/Contact";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#FEFAF4]">
      <Navbar />
      <main>
        <Hero />
        <Experience />
        <BookingBanner />
        <About />
        <PrivateEvents />
        <Gallery />
        <Reviews />
        <GiftCards />
        <FAQ />
        <Contact />
      </main>
      <Footer />
      <ScrollToTop />
    </div>
  );
}
