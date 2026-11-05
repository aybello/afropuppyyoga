import LocationPage, { type LocationConfig } from "@/components/LocationPage";
import { PUBLIC_LOCATION_LIST } from "@shared/publicLocations";
import { PRIVATE_EVENT_PACKAGE_BANDS, privateEventBandLabel, PRIVATE_EVENT_PRICE_NOTE, PRIVATE_EVENT_TRAVEL_NOTE, PRIVATE_EVENT_CUSTOM_NOTE } from "@shared/privateEventPricing";
import { PRIVATE_EVENT_EXPERIENCES, PRIVATE_EVENT_SCHEDULES, PRIVATE_EVENT_FORMAT_PRICE_NOTE, PRIVATE_EVENT_CUSTOM_SCOPE_NOTE } from "@shared/privateEventExperience";

const config: LocationConfig = {
  slug: "private-puppy-yoga-events",
  city: "Private Events",
  pageTitle: "Private Puppy Yoga Events Ontario | AfroPuppyYoga",
  metaDescription:
    `Standard 60-minute studio puppy yoga for up to 20 guests from $${PRIVATE_EVENT_PACKAGE_BANDS.classic.min.toLocaleString("en-CA")} + HST. Puppy lounge and other formats: custom quotes across Ontario.`,
  heroHeadline: "Private Puppy Yoga Events",
  heroSubline:
    "Birthdays, bachelorettes, corporate wellness days, and more — choose guided puppy yoga or a supervised Puppy Play & Wellness Lounge without yoga, then plan the schedule and venue with us.",
  heroBg:
    "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/apy_hero_bg-aDMPriKGFaJ3ZgQKWVBv5n.webp",
  venueName: "Your Venue or Ours",
  venueAddress: "Across Ontario · Venue and date subject to availability",
  venueArea: "Kitchener · Hamilton · Oakville · Toronto · Guelph",
  aboutParagraph:
    `Celebrate, connect or unwind with a private puppy experience across Ontario. Choose Private Puppy Yoga for guided movement and puppy play, or Puppy Play & Wellness Lounge for supervised interaction without a yoga class. Groups from 6 to 50+ can be discussed, subject to venue, capacity and availability. Standard 60-minute studio puppy yoga for up to 20 guests starts at $${PRIVATE_EVENT_PACKAGE_BANDS.classic.min.toLocaleString("en-CA")} + HST; other formats receive a full custom quote.`,
  scheduleDescription:
    "One session, multiple group sessions or drop-in rotations — timing confirmed in your quote",
  comingSoon: false,
  whyReasons: [
    {
      icon: "🎂",
      title: "Birthdays & Bachelorettes",
      desc: "Make it unforgettable. Puppy yoga is the most talked-about birthday and bachelorette activity in Ontario — your guests will be raving about it for months.",
    },
    {
      icon: "💼",
      title: "Corporate Wellness Days",
      desc: "Employee appreciation, team-building, and stress relief in one session. HR teams across Ontario choose APY for events their teams actually look forward to.",
    },
    {
      icon: "🎓",
      title: "Student Group Events",
      desc: "Student clubs, orientation events, and stress-relief sessions. APY is the go-to group activity for universities and colleges across Ontario.",
    },
    {
      icon: "📍",
      title: "Your Venue or Ours",
      desc: "We come to you, or you come to us. APY serves Kitchener, Hamilton, Oakville, Toronto, Guelph, and surrounding areas across Ontario. Venue and date availability are confirmed with your quote.",
    },
  ],
  reviews: [
    {
      name: "Priya M.",
      avatar: "PM",
      text: "Brought my whole friend group for a birthday celebration and everyone LOVED it. The staff were so welcoming and the puppies were pure joy. 10/10 would recommend!",
      date: "3 months ago",
    },
    {
      name: "Cameron T.",
      avatar: "CT",
      text: "Absolutely incredible experience! The Afro-beat music, the puppies, the yoga — everything was perfectly curated. I've never felt so relaxed and happy at the same time.",
      date: "2 months ago",
    },
    {
      name: "Aisha B.",
      avatar: "AB",
      text: "As someone who does yoga regularly, this was such a refreshing twist. The cultural element with the music and the warmth of the instructors made it feel truly special.",
      date: "5 months ago",
    },
  ],
  faqs: [
    {
      question: "What types of private events do you host?",
      answer:
        "We host birthdays, bachelorettes, baby showers, girls' days, corporate wellness days, team-building events, student group events, brand activations, and more. Tell us about your plans and we'll confirm the scope and availability.",
    },
    {
      question: "Can we choose puppy yoga or puppy play without yoga?",
      answer:
        `${PRIVATE_EVENT_EXPERIENCES.puppy_yoga.name}: ${PRIVATE_EVENT_EXPERIENCES.puppy_yoga.description} ${PRIVATE_EVENT_EXPERIENCES.puppy_lounge.name}: ${PRIVATE_EVENT_EXPERIENCES.puppy_lounge.description} Choose your experience first, then your schedule and venue.`,
    },
    {
      question: "Can we book multiple sessions or drop-in rotations?",
      answer:
        `Schedule choices are separate from your experience: ${Object.values(PRIVATE_EVENT_SCHEDULES).join("; ")}. Timing, group capacity, setup, room resets and puppy rest are confirmed in your event scope. ${PRIVATE_EVENT_FORMAT_PRICE_NOTE} ${PRIVATE_EVENT_CUSTOM_SCOPE_NOTE}`,
    },
    {
      question: "How many people can attend a private event?",
      answer:
        `We accommodate groups from 6 to 50+ guests depending on the venue and availability. Advertised bands are only for standard 60-minute studio puppy yoga for up to 20 guests. Groups of 21 or more require a custom quote. ${PRIVATE_EVENT_CUSTOM_NOTE}`,
    },
    {
      question: "Where can you host private events?",
      answer:
        `We arrange event venues in ${PUBLIC_LOCATION_LIST}, Toronto and surrounding areas, subject to availability. We can come to your venue or discuss partner space. ${PRIVATE_EVENT_TRAVEL_NOTE}`,
    },
    {
      question: "What is included in a private event?",
      answer:
        "Standard studio puppy yoga includes guided yoga and puppy play, a certified yoga instructor and event host, mats and props, cleanup, and a curated Afrobeats playlist. Signature adds professional photography and an enhanced setup. Luxury is customized to the agreed scope. Puppy Play & Wellness Lounge has supervised puppy interaction, not a guided yoga class; its inclusions are confirmed in a custom quote. Refreshments, merchandise, and other options depend on the selected package and confirmed quote.",
    },
    {
      question: "How much does a private puppy yoga event cost?",
      answer:
        `Standard studio puppy yoga starts at $${PRIVATE_EVENT_PACKAGE_BANDS.classic.min.toLocaleString("en-CA")} + HST. Classic: ${privateEventBandLabel("classic")}; Signature: ${privateEventBandLabel("signature")}; Luxury: ${privateEventBandLabel("luxury")}. ${PRIVATE_EVENT_FORMAT_PRICE_NOTE} ${PRIVATE_EVENT_PRICE_NOTE} Nonstandard durations and help choosing an experience or package also receive a custom quote.`,
    },
    {
      question: "How do I book a private event?",
      answer:
        "Visit our Private Event Quote page to choose your experience, schedule and venue, or ask us to help choose. Submit your event details and we'll follow up within 24–48 hours to confirm availability, final scope and pricing before booking.",
    },
  ],
  schemaAddress: {
    streetAddress: "329 King Street East",
    addressLocality: "Kitchener",
    addressRegion: "ON",
    postalCode: "N2G 2L3",
  },
  lat: 43.4516,
  lng: -80.4925,
};

export default function PrivatePuppyYogaEventsPage() {
  return (
    <div className="bg-[#FEFAF4] text-[#34221D]">
      <LocationPage config={config} />
    </div>
  );
}
