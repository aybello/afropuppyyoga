/* ============================================================
   Ethics Page — Full Puppy Welfare & Ethical Standards
   Linked from the EthicalStandards summary section on homepage
   ============================================================ */
import { Heart, Shield, Users, Leaf } from "lucide-react";
import { useEffect } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import { useSeoMeta } from "@/hooks/useSeoMeta";

const pillars = [
  {
    icon: Shield,
    number: "01",
    title: "Ethical Partnerships & Sourcing",
    points: [
      {
        label: "Vetted Breeders and Rescues",
        text: "We partner strictly with responsible, ethical breeders and registered local rescue organizations. We do not, and will never, work with puppy mills or high-volume commercial breeding facilities.",
      },
      {
        label: "Age and Health Requirements",
        text: "No puppy under the age of six weeks is permitted to participate. All puppies must have received veterinary clearance and age-appropriate vaccinations prior to attending any event.",
      },
      {
        label: "Safe Transportation",
        text: "Puppies are transported to and from our venues in safe, climate-controlled environments, ensuring their journey is as stress-free as the class itself.",
      },
    ],
  },
  {
    icon: Heart,
    number: "02",
    title: "A Puppy-Centered Class Environment",
    points: [
      {
        label: "Strict Hygiene Protocols",
        text: "All floors, yoga mats, and shared surfaces are thoroughly sanitized with pet-safe products before and after every session. Participants remove shoes and sanitize hands before entering the puppy zone.",
      },
      {
        label: "The Right to Rest",
        text: 'Our classes are structured to ensure playtime is capped. We provide designated "Calm Zones" with water and comfortable bedding. If a puppy retreats to a Calm Zone, they are strictly off-limits to participants.',
      },
      {
        label: "Autonomy and Choice",
        text: "Puppies are never forced to interact. They are free to roam, play, observe, or sleep at their own pace. The flow of the class is dictated by their comfort levels, not the other way around.",
      },
    ],
  },
  {
    icon: Users,
    number: "03",
    title: "Participant Guidelines & Supervision",
    points: [
      {
        label: "Dedicated Puppy Monitors",
        text: 'Every class is staffed with dedicated "Puppy Monitors" whose sole responsibility is to observe the puppies — monitoring behavior, energy levels, and signs of fatigue, intervening immediately if a puppy needs a break.',
      },
      {
        label: "Gentle Handling Rules",
        text: "Participants are instructed on proper handling techniques before class. Rules include petting only below the shoulder, avoiding sudden movements or loud noises, and never waking a sleeping puppy.",
      },
      {
        label: "No Unsupervised Lifting",
        text: "To prevent accidental drops or stress, participants are not permitted to pick up or carry puppies while standing. All interactions must occur while seated safely on the yoga mat.",
      },
    ],
  },
  {
    icon: Leaf,
    number: "04",
    title: "The Benefits of Responsible Socialization",
    points: [
      {
        label: "Critical Socialization Window",
        text: "The critical socialization window for puppies occurs between 3 and 14 weeks of age. Positive exposure to new sights, sounds, and people during this period is vital for healthy development.",
      },
      {
        label: "Confidence Building",
        text: "Our controlled, supervised environments allow puppies to experience gentle handling and diverse human interactions without becoming overwhelmed, helping them develop into well-adjusted, happy adult dogs.",
      },
      {
        label: "Mutual Benefit",
        text: "When conducted under these strict ethical standards, puppy yoga offers significant benefits not just for human participants, but for the puppies themselves — a true win-win experience.",
      },
    ],
  },
];

export default function Ethics() {
  useSeoMeta({
    title: "Puppy Welfare & Ethical Standards | AfroPuppyYoga",
    description:
      "Learn how AfroPuppyYoga ensures the safety, comfort, and wellbeing of every puppy in our classes. Our 4 ethical pillars cover sourcing, environment, supervision, and socialization.",
    canonical: "https://afropuppyyoga.ca/ethics",
  });
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-[#FEFAF4]">
      <Navbar />

      {/* Hero */}
      <section className="pt-28 md:pt-32 pb-16 bg-[#FEFAF4] border-b border-[#E8D8D0]">
        <div className="container max-w-4xl">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-0.5 bg-primary" />
              <span className="text-brand-link font-body text-xs font-semibold tracking-widest uppercase">
                Our Commitment
              </span>
            </div>
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-medium text-[#34221D] leading-tight mb-6">
              Puppy Welfare &{" "}
              <span className="italic text-brand-link">Ethical Standards</span>
            </h1>
            <p className="font-body text-base md:text-lg text-[#34221D]/80 leading-relaxed max-w-2xl">
              The joy and connection we foster in our classes begin with one
              fundamental principle:{" "}
              <strong className="text-[#34221D]">
                the wellbeing of our puppies comes first.
              </strong>{" "}
              Puppies are not props — they are developing animals in a critical
              stage of growth. Every decision we make is guided by the four
              standards below.
            </p>
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section className="py-16 md:py-24">
        <div className="container max-w-5xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10">
            {pillars.map((pillar, i) => {
              const Icon = pillar.icon;
              return (
                <div
                  key={pillar.number}
                  className="bg-white rounded-2xl p-8 md:p-10 shadow-sm border border-[#E8D8D0]/60 hover:shadow-sm transition-shadow duration-300"
                >
                  <div className="flex items-start gap-4 mb-6">
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[#FDE9EF] flex items-center justify-center">
                      <Icon size={22} className="text-brand-link" />
                    </div>
                    <div>
                      <span className="font-body text-xs tracking-[0.18em] uppercase text-brand-link block mb-1">
                        {pillar.number}
                      </span>
                      <h2 className="font-display text-xl md:text-2xl font-medium text-[#34221D] leading-snug">
                        {pillar.title}
                      </h2>
                    </div>
                  </div>
                  <ul className="space-y-4">
                    {pillar.points.map(point => (
                      <li key={point.label} className="flex gap-3">
                        <span className="mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-primary" />
                        <p className="font-body text-base text-[#34221D]/80 leading-relaxed">
                          <strong className="text-[#34221D] font-semibold">
                            {point.label}:
                          </strong>{" "}
                          {point.text}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          {/* FAQ Section */}
          <div className="mt-20">
            <h2 className="font-display text-3xl md:text-4xl font-medium text-[#34221D] mb-8 text-center">
              Common Questions About{" "}
              <span className="italic text-brand-link">Puppy Welfare</span>
            </h2>
            <div className="space-y-5 max-w-3xl mx-auto">
              {[
                {
                  q: "How old are the puppies at your classes?",
                  a: "All puppies must be at least six weeks old and have received veterinary clearance and age-appropriate vaccinations before attending any AfroPuppyYoga event. We do not permit puppies younger than six weeks under any circumstances.",
                },
                {
                  q: "Are the puppies tired or stressed after a class?",
                  a: "Puppy welfare is our top priority. Classes are structured with built-in rest periods. Designated Calm Zones with water and comfortable bedding are always available. If a puppy retreats to a Calm Zone, they are strictly off-limits to participants. Our Puppy Monitors watch for signs of fatigue and remove any puppy that needs a break.",
                },
                {
                  q: "Do you work with puppy mills or commercial breeders?",
                  a: "Absolutely not. We partner exclusively with responsible, ethical breeders and registered local rescue organizations. Every breeder we work with is vetted against our standards. We will never work with puppy mills or high-volume commercial breeding facilities.",
                },
                {
                  q: "Can participants pick up the puppies?",
                  a: "Participants are not permitted to pick up or carry puppies while standing. All interactions must occur while seated safely on the yoga mat to prevent accidental drops or stress. Puppy Monitors enforce this rule throughout every class.",
                },
                {
                  q: "What breeds of puppies come to your classes?",
                  a: "The breed varies by class and depends on our breeder partners' available litters. Common breeds include Golden Retrievers, Labrador Retrievers, Doodles, and other friendly, sociable breeds. The specific breed is typically announced on our Luma booking page before each class.",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="bg-white border border-[#E8D8D0]/60 rounded-2xl p-6 shadow-sm"
                >
                  <h3 className="font-display font-medium text-base md:text-lg text-[#34221D] mb-2">
                    {item.q}
                  </h3>
                  <p className="font-body text-base text-[#34221D]/80 leading-relaxed">
                    {item.a}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Transparency callout */}
          <div className="mt-16 text-center bg-[#FDE9EF] rounded-2xl px-8 py-10 border border-[#E8D8D0]/80">
            <p className="font-display text-xl md:text-2xl font-semibold text-[#34221D] mb-3">
              Transparency is our promise.
            </p>
            <p className="font-body text-base md:text-base text-[#34221D]/80 max-w-xl mx-auto mb-6">
              If you have any questions about our practices, our partners, or
              how we care for our puppies, please don't hesitate to reach out.
              We are always happy to share more about how we work.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="/#contact"
                className="inline-flex min-h-11 items-center justify-center px-7 py-3 rounded-full bg-primary text-[#34221D] font-body text-base font-semibold hover:bg-primary-hover transition-colors duration-200"
              >
                Get in Touch
              </a>
              <a
                href="/"
                className="inline-flex min-h-11 items-center justify-center px-7 py-3 rounded-full border-2 border-[#F29CB8] text-brand-link font-body text-base font-semibold hover:bg-[#FDE9EF] transition-colors duration-200"
              >
                Book a Class
              </a>
            </div>
            <p className="font-body text-xs text-[#34221D]/80 mt-8">
              Want to become a breeder partner?{" "}
              <a
                href="/partnerships"
                className="text-brand-link underline hover:no-underline"
              >
                Learn about our Breeder Partnership program.
              </a>
            </p>
          </div>
        </div>
      </section>

      <Footer />
      <ScrollToTop />
    </div>
  );
}
