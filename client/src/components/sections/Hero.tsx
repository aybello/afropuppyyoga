/* Homepage hero — approved ivory editorial layout with authentic APY photography. */
import { BOOK_URL } from "@/const";
import { useState } from "react";
import { ChevronDownIcon } from "@/components/PublicIcons";
import { trackCTAClick } from "@/hooks/useAnalytics";
import LocalDogsImpact from "@/components/sections/LocalDogsImpact";
import { handleHomeSectionClick, homeSectionHref, scrollToHomeSection } from "@/components/homeSectionNavigation";
import { FIVE_STAR_REVIEW_COUNT } from "@shared/reviewMetrics";

// Existing managed source photographs, not generated concept artwork.
const HERO_PHOTO = "/manus-storage/apy_portrait_chow_cuddle_nov01_52f30f49.jpg";
const HERO_FALLBACK_PHOTO = "/manus-storage/apy_portrait_golden_cuddle_oct19_d7e4953e.jpg";

// Partner logos remain in their original colors and at their approved display sizes.
const trustedBy = [
  { name: "LiftOff", src: "/manus-storage/LiftOff_Logo_Building_Legacy_banner_5f5d7710.png", height: 88 },
  { name: "Wilfrid Laurier University", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/laurier_logo_61911be5.webp", height: 30 },
  { name: "University of Waterloo", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/waterloo_fixed_a91debfb.png", height: 36 },
  { name: "McMaster University", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/mcmaster_dedf4891.png", height: 38 },
  { name: "University of Guelph", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/guelph_fixed_39bf0fba.png", height: 36 },
  { name: "Brock University", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/brock_university_a69cc38d.png", height: 52 },
  { name: "Scribenote", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/scribenote_dark_6221d6bf.png", height: 26 },
  { name: "F45 Training", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/f45_fixed_f11e0ba3.png", height: 34 },
  { name: "9Round Kickboxing", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/9round_composite_ce7b2856.png", height: 56 },
  { name: "The Fit Club Waterloo", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/fitclub_waterloo_bf128bd7.webp", height: 32 },
  { name: "Home2 Suites by Hilton", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/home2suites_wiki_457f2f4b.png", height: 38 },
  { name: "Kitchener Lady Rangers", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/lady_rangers_logo_787e1b41.jpg", height: 64 },
  { name: "Curated KW", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/curatedkw_logo_34f34c0f.webp", height: 64 },
  { name: "MMSA Lang Guelph", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/mmsa_lang_logo_46c62a49.webp", height: 64 },
  { name: "Artemis Canada", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/artemis_canada_logo_b5401a15.jpg", height: 36 },
  { name: "Club Pilates Guelph", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/club-pilates-correct-logo_9a9b4700.png", height: 64 },
  { name: "Girl Guides of Canada", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/girl-guides-canada-logo_307ab2f6.png", height: 100 },
  { name: "Solstice Pilates", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/solstice-pilates-ca-logo_388e4cec.webp", height: 60 },
  { name: "Vivia Riu Medspa", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/vivia-riu-medspa-logo_6c9b4b43.png", height: 80 },
  { name: "Fluffy Glaze", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/fluffy_glaze_logo_34eaac35.png", height: 56 },
  { name: "Manulife", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/manulife_logo_cropped_ecd0a51b.png", height: 40 },
  { name: "Soul Seat", src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/soul_seat_logo_cca03879.png", height: 52 },
  { name: "Brock Solutions", src: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663446228701/dwXWkrdWFpxsxxJF.png", height: 72 },
];

export default function Hero() {
  const [heroImage, setHeroImage] = useState(HERO_PHOTO);
  const [heroImageFailed, setHeroImageFailed] = useState(false);
  const [logosPaused, setLogosPaused] = useState(false);

  const scrollToExperience = () => {
    scrollToHomeSection("#experience");
  };

  return (
    <section id="home" className="relative bg-[#FEFAF4] text-[#34221D] pt-28 sm:pt-32 lg:pt-36">
      <div className="container grid items-center gap-8 pb-10 lg:grid-cols-[1.08fr_1fr] lg:gap-x-14 lg:gap-y-4 lg:pb-14">
        <div className="min-w-0 lg:col-start-1 lg:row-start-1 lg:self-end">
          <p className="font-body text-xs sm:text-sm font-semibold tracking-[0.16em] uppercase text-[#B83F67] mb-5">
            Ontario's #1 Puppy Yoga Studio
          </p>
          <h1 className="font-display font-medium text-[clamp(2.75rem,5.2vw,5.25rem)] leading-[1.08] tracking-[-0.035em] mb-6 [text-wrap:balance]">
            Where Wellness<br />
            Meets <span className="italic text-[#B83F67]">Puppy Love</span>
          </h1>
          <p className="font-body text-[#66514A] text-base sm:text-lg leading-relaxed max-w-xl mb-8 [text-wrap:pretty]">
            Guided yoga, Afro-beat rhythms, and adorable puppies — all in one unforgettable session. Serving Hamilton, Kitchener & Oakville.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={BOOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full sm:w-auto items-center justify-center gap-3 min-h-12 px-7 py-3.5 bg-[#F29CB8] text-[#34221D] font-body font-semibold text-base rounded-full hover:bg-[#FDE9EF] transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#B83F67]"
              onClick={() => trackCTAClick("Book a Class — Hero")}
            >
              Book a Class <span aria-hidden="true">→</span>
            </a>
            <a
              href={homeSectionHref("#memberships")}
              onClick={(e) => { trackCTAClick("Memberships — Hero"); handleHomeSectionClick(e, "#memberships"); }}
              className="inline-flex flex-1 sm:flex-none items-center justify-center min-h-12 px-5 py-3 font-body font-semibold text-sm sm:text-base rounded-full border border-[#EBCDD5] hover:bg-[#FDE9EF] transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#B83F67]"
            >
              Memberships
            </a>
            <a
              href={homeSectionHref("#private-events")}
              onClick={(e) => { trackCTAClick("Private Events — Hero"); handleHomeSectionClick(e, "#private-events"); }}
              className="inline-flex flex-1 sm:flex-none items-center justify-center min-h-12 px-5 py-3 font-body font-semibold text-sm sm:text-base rounded-full border border-[#EBCDD5] hover:bg-[#FDE9EF] transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#B83F67]"
            >
              Private Events
            </a>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3 font-body text-sm">
            <span aria-hidden="true" className="text-[#B83F67] text-xl tracking-[0.08em]">★★★★★</span>
            <span>{FIVE_STAR_REVIEW_COUNT} five-star reviews</span>
          </div>
          <p className="font-body text-[#66514A] text-sm leading-relaxed mt-4 max-w-lg">
            Trusted by universities, brands, and wellness communities across Ontario.
          </p>
        </div>

        <div className="relative w-full max-w-xl mx-auto overflow-hidden rounded-t-[50%] bg-[#FDE9EF] aspect-[3/4] lg:aspect-[4/5] lg:col-start-2 lg:row-start-1 lg:row-span-2">
          {!heroImageFailed && (
            <img
              src={heroImage}
              alt={heroImage === HERO_PHOTO ? "Smiling guest cuddling a fluffy Chow puppy at AfroPuppyYoga" : "Smiling guest holding a Golden Retriever puppy at AfroPuppyYoga"}
              width={1500}
              height={2000}
              loading="eager"
              decoding="async"
              fetchPriority="high"
              onLoad={() => document.documentElement.classList.remove("home-pending")}
              onError={() => {
                if (heroImage === HERO_PHOTO) {
                  setHeroImage(HERO_FALLBACK_PHOTO);
                } else {
                  document.documentElement.classList.remove("home-pending");
                  setHeroImageFailed(true);
                }
              }}
              className="w-full h-full object-cover object-center"
            />
          )}
        </div>
        <div className="min-w-0 lg:col-start-1 lg:row-start-2 lg:self-start">
          <LocalDogsImpact />
        </div>
      </div>

      <div className="bg-[#FDE9EF] border-y border-[#EBCDD5]">
        <div className="container flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-8 py-4">
          <p className="font-body text-xs font-semibold uppercase tracking-[0.14em] text-[#B83F67]">Find a Class Near You</p>
          <div className="flex flex-wrap justify-center gap-x-5 sm:gap-x-8">
            {[
              { city: "Kitchener", href: "/puppy-yoga-kitchener" },
              { city: "Hamilton", href: "/puppy-yoga-hamilton" },
              { city: "Oakville", href: "/puppy-yoga-oakville" },
            ].map((location) => (
              <a key={location.city} href={location.href} className="inline-flex items-center gap-2 min-h-11 font-body text-sm hover:text-[#B83F67] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#B83F67]">
                {location.city}<span aria-hidden="true">→</span>
              </a>
            ))}
          </div>
          <button onClick={scrollToExperience} className="hidden lg:inline-flex items-center justify-center min-h-11 min-w-11 text-[#66514A] hover:text-[#B83F67] rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#B83F67]" aria-label="Scroll down">
            <ChevronDownIcon size={24} aria-hidden />
          </button>
        </div>
      </div>

      <div className="border-b border-[#EBCDD5] bg-[#FEFAF4] py-5">
        <div className="container flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="shrink-0 flex items-center gap-3 sm:flex-col sm:items-start sm:pr-5 sm:border-r sm:border-[#EBCDD5]">
            <span className="font-body text-xs font-semibold tracking-[0.14em] uppercase text-[#66514A]">Trusted By</span>
            <button type="button" aria-label={logosPaused ? "Resume partner logos" : "Pause partner logos"} aria-pressed={logosPaused} onClick={() => setLogosPaused(!logosPaused)} className="min-h-8 px-2 rounded font-body text-xs text-[#66514A] hover:text-[#B83F67] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B83F67] motion-reduce:hidden">
              {logosPaused ? "Resume" : "Pause"}
            </button>
          </div>
          <div className="apy-trust-window flex-1 min-w-0 pb-2" role="region" aria-label="Trusted APY partners" tabIndex={0}>
            <div className="apy-trust-track" style={logosPaused ? { animationPlayState: "paused" } : undefined}>
              {[0, 1].map((copy) => (
                <div key={copy} className="apy-trust-set" aria-hidden={copy === 1 ? true : undefined}>
                  {trustedBy.map((org) => (
                    <div key={org.name} className="flex h-[100px] w-[180px] items-center justify-center shrink-0">
                      <img src={org.src} alt={copy === 0 ? org.name : ""} loading="eager" decoding="async" style={{ height: org.height }} className="w-auto max-w-[180px] object-contain" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
