/**
 * EthicalStandards Section
 * Design: Romantic Afro-Wellness — warm cream/blush palette, Fraunces serif headings,
 * Plus Jakarta Sans body, asymmetric layout with icon cards for each pillar.
 */

import { Heart, Shield, Users, Leaf } from "lucide-react";

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
        text: "Our classes are structured to ensure playtime is capped. We provide designated \"Calm Zones\" with water and comfortable bedding. If a puppy retreats to a Calm Zone, they are strictly off-limits to participants.",
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
        text: "Every class is staffed with dedicated \"Puppy Monitors\" whose sole responsibility is to observe the puppies — monitoring behavior, energy levels, and signs of fatigue, intervening immediately if a puppy needs a break.",
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

export default function EthicalStandards() {
  return (
    <section id="ethical-standards" className="py-24 md:py-32 bg-[#FDF6F0]">
      <div className="max-w-6xl mx-auto px-6 md:px-10">

        {/* Header */}
        <div className="max-w-2xl mb-16 md:mb-24">
          <p className="font-body text-xs tracking-[0.2em] uppercase text-[#C97B9A] mb-4">
            Our Commitment
          </p>
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-[#1A0A12] leading-tight mb-6">
            Puppy Welfare &{" "}
            <em className="text-[#E8A0B8] not-italic font-light">
              Ethical Standards
            </em>
          </h2>
          <p className="font-body text-base md:text-lg text-[#1A0A12]/70 leading-relaxed">
            The joy and connection we foster in our classes begin with one
            fundamental principle: <strong>the wellbeing of our puppies comes
            first.</strong> Puppies are not props — they are developing animals
            in a critical stage of growth. Every decision we make is guided by
            the standards below.
          </p>
        </div>

        {/* Pillars grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10">
          {pillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div
                key={pillar.number}
                className="bg-white rounded-2xl p-8 md:p-10 shadow-sm border border-[#F2D9E4]/60 hover:shadow-md transition-shadow duration-300"
              >
                {/* Pillar header */}
                <div className="flex items-start gap-4 mb-6">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[#F9EDF3] flex items-center justify-center">
                    <Icon size={22} className="text-[#C97B9A]" />
                  </div>
                  <div>
                    <span className="font-body text-xs tracking-[0.18em] uppercase text-[#C97B9A]/70 block mb-1">
                      {pillar.number}
                    </span>
                    <h3 className="font-display text-xl md:text-2xl font-bold text-[#1A0A12] leading-snug">
                      {pillar.title}
                    </h3>
                  </div>
                </div>

                {/* Points */}
                <ul className="space-y-4">
                  {pillar.points.map((point) => (
                    <li key={point.label} className="flex gap-3">
                      <span className="mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-[#E8A0B8]" />
                      <p className="font-body text-sm text-[#1A0A12]/75 leading-relaxed">
                        <strong className="text-[#1A0A12] font-semibold">
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

        {/* Footer callout */}
        <div className="mt-16 md:mt-20 text-center bg-[#F9EDF3] rounded-2xl px-8 py-10 border border-[#F2D9E4]/80">
          <p className="font-display text-xl md:text-2xl font-semibold text-[#1A0A12] mb-3">
            Transparency is our promise.
          </p>
          <p className="font-body text-sm md:text-base text-[#1A0A12]/65 max-w-xl mx-auto">
            If you have any questions about our practices, our partners, or how
            we care for our puppies, please don't hesitate to reach out to our
            team.
          </p>
          <a
            href="#contact"
            className="inline-block mt-6 px-7 py-3 rounded-full bg-[#C97B9A] text-white font-body text-sm font-semibold hover:bg-[#b56a88] transition-colors duration-200"
          >
            Get in Touch
          </a>
        </div>
      </div>
    </section>
  );
}
