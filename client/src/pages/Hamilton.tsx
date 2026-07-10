import LocationPage, { type LocationConfig } from "@/components/LocationPage";

const config: LocationConfig = {
  slug: "puppy-yoga-hamilton",
  city: "Hamilton",
  pageTitle: "Puppy Yoga Hamilton | AfroPuppyYoga",
  metaDescription:
    "Experience puppy yoga in Hamilton at Colibri Studio with AfroPuppyYoga. Guided yoga, Afrobeats music, and adorable puppies in the heart of Hamilton, Ontario. Book your spot now.",
  heroHeadline: "Puppy Yoga in Hamilton",
  heroSubline:
    "Your Sunday wellness ritual just got a whole lot cuter. Guided yoga, Afrobeats, and adorable puppies at Colibri Studio in Hamilton.",
  heroBg:
    "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/apy_hero_bg-aDMPriKGFaJ3ZgQKWVBv5n.webp",
  venueName: "Colibri Studio",
  venueAddress: "Hamilton, ON",
  venueArea: "Hamilton, Ontario",
  aboutParagraph:
    "AfroPuppyYoga brings its signature experience to Hamilton at Colibri Studio — a beautiful, welcoming space that sets the perfect tone for a Sunday wellness session. Each class blends beginner-friendly yoga with a live Afrobeats soundtrack and ethically sourced puppies, creating an atmosphere that's warm, joyful, and unlike anything else in the city. Hamilton is a city that values community and self-care, and APY fits right in.",
  scheduleDescription: "Regular sessions — check calendar for dates",
  lumaTag: "hamilton",
  comingSoon: false,
  whyReasons: [
    {
      icon: "🌿",
      title: "Sunday Wellness Ritual",
      desc: "Hamilton's APY sessions are the perfect way to reset before the week begins — yoga, puppies, and good vibes to carry you through.",
    },
    {
      icon: "💑",
      title: "Unique Date Idea",
      desc: "Tired of the same dinner-and-movie routine? Puppy yoga in Hamilton is the most talked-about date idea in the city right now.",
    },
    {
      icon: "🧘",
      title: "Self-Care for Everyone",
      desc: "No yoga experience needed. APY Hamilton sessions are designed to be accessible, fun, and deeply relaxing for all fitness levels.",
    },
    {
      icon: "👯",
      title: "Friend Group Activity",
      desc: "Bring your crew for a girls' day, birthday celebration, or just a spontaneous weekend activity that everyone will be talking about.",
    },
  ],
  reviews: [
    {
      name: "Jessica L.",
      avatar: "JL",
      text: "I was nervous as a yoga beginner but the instructor made it so accessible and fun. The puppies kept interrupting my poses in the best way possible. Laughed the whole time!",
      date: "3 months ago",
    },
    {
      name: "Marcus R.",
      avatar: "MR",
      text: "Took my partner here for our anniversary. The vibe was immaculate — Afro beats, cute puppies, good energy. We're already planning our next visit.",
      date: "4 months ago",
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
      question: "Where is the Hamilton class held?",
      answer:
        "Hamilton sessions are hosted at Colibri Studio in downtown Hamilton. The full address is included in your booking confirmation after you register on Luma.",
    },
    {
      question: "Is parking available near Colibri Studio?",
      answer:
        "Yes, there is street parking and nearby municipal lots in the area. We recommend arriving 10–15 minutes early to find a spot and get settled before class begins.",
    },
    {
      question: "Do I need yoga experience to attend?",
      answer:
        "Not at all! AfroPuppyYoga sessions are designed to be beginner-friendly. Our instructors guide you through the flow at a comfortable pace, and honestly — the puppies make everything better regardless of your skill level.",
    },
    {
      question: "Are the puppies ethically sourced?",
      answer:
        "Yes. Every puppy comes from our vetted Breeder Network — local breeders who meet our strict ethical standards. Puppy health, socialization, and welfare are always our first priority.",
    },
    {
      question: "What is the cancellation policy?",
      answer:
        "We use a credit-first refund policy. If you can't make it, your ticket converts to APY credit for a future session. Cash refunds are only available if AfroPuppyYoga cancels the event.",
    },
    {
      question: "Can I book a private event in Hamilton?",
      answer:
        "Yes! Private events — corporate wellness days, birthday parties, bachelorette parties, and team experiences — are available in Hamilton. Fill out our Private Event Quote form to get started.",
    },
  ],
  schemaAddress: {
    streetAddress: "",
    addressLocality: "Hamilton",
    addressRegion: "ON",
    postalCode: "L8N",
  },
  lat: 43.2557,
  lng: -79.8711,
};

export default function HamiltonPage() {
  return <LocationPage config={config} />;
}
