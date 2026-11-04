import LocationPage, { type LocationConfig } from "@/components/LocationPage";
import { PUBLIC_LOCATION_LIST } from "@shared/publicLocations";
import { PRIVATE_EVENT_PACKAGE_BANDS, privateEventBandLabel, PRIVATE_EVENT_PRICE_NOTE, PRIVATE_EVENT_TRAVEL_NOTE, PRIVATE_EVENT_CUSTOM_NOTE } from "@shared/privateEventPricing";

const config: LocationConfig = {
  slug: "private-puppy-yoga-events",
  city: "Private Events",
  pageTitle: "Private Puppy Yoga Events Ontario | AfroPuppyYoga",
  metaDescription:
    `Private puppy yoga from $${PRIVATE_EVENT_PACKAGE_BANDS.classic.min.toLocaleString("en-CA")} + HST for birthdays, bachelorettes and teams across Ontario. Request your event quote.`,
  heroHeadline: "Private Puppy Yoga Events",
  heroSubline:
    "Birthdays, bachelorettes, corporate wellness days, and more — AfroPuppyYoga brings the puppies, the yoga, and the Afrobeats to your private event across Ontario.",
  heroBg:
    "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/apy_hero_bg-aDMPriKGFaJ3ZgQKWVBv5n.webp",
  venueName: "Your Venue or Ours",
  venueAddress: "Available across Ontario",
  venueArea: "Kitchener · Hamilton · Oakville · Toronto · Guelph",
  aboutParagraph:
    `AfroPuppyYoga's private events are Ontario's most unique group wellness experience. Whether you're celebrating a birthday, planning a bachelorette, rewarding your team, or activating your brand — we bring the certified yoga instructor, the ethically sourced puppies, and the Afrobeats playlist. We serve Kitchener, Hamilton, Oakville, Toronto, Guelph, and surrounding areas. Groups from 6 to 50+ welcome, with custom quotes for groups above 20. Starting at $${PRIVATE_EVENT_PACKAGE_BANDS.classic.min.toLocaleString("en-CA")} + HST.`,
  scheduleDescription:
    "Available across Ontario — contact us to check your date",
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
      question: "How many people can attend a private event?",
      answer:
        `We accommodate groups from 6 to 50+ guests depending on the venue and availability. Advertised package bands are for standard events of up to 20 guests. Groups of 21 or more require a custom quote. ${PRIVATE_EVENT_CUSTOM_NOTE}`,
    },
    {
      question: "Where can you host private events?",
      answer:
        `We arrange event venues in ${PUBLIC_LOCATION_LIST}, Toronto and surrounding areas, subject to availability. We can come to your venue or discuss partner space. ${PRIVATE_EVENT_TRAVEL_NOTE}`,
    },
    {
      question: "What is included in a private event?",
      answer:
        "The core studio experience includes a guided yoga session with puppies, a certified yoga instructor and event host, mats and props, cleanup, and a curated Afrobeats playlist. Signature adds professional photography and an enhanced setup. Luxury is customized to the agreed scope. Refreshments, merchandise, and other options are not included by default and are confirmed in your quote.",
    },
    {
      question: "How much does a private puppy yoga event cost?",
      answer:
        `Private events start at $${PRIVATE_EVENT_PACKAGE_BANDS.classic.min.toLocaleString("en-CA")} + HST. Classic: ${privateEventBandLabel("classic")}; Signature: ${privateEventBandLabel("signature")}; Luxury: ${privateEventBandLabel("luxury")}. ${PRIVATE_EVENT_PRICE_NOTE} Use our quote tool for an indicative range and to submit your inquiry.`,
    },
    {
      question: "How do I book a private event?",
      answer:
        "Click 'Get an Instant Quote' above or visit our Private Event Quote page. Fill in your event details and we'll follow up within 24–48 hours to confirm availability, final scope, and pricing before booking.",
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
