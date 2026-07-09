import LocationPage, { type LocationConfig } from "@/components/LocationPage";

const config: LocationConfig = {
  slug: "hamilton",
  city: "Hamilton",
  pageTitle: "Puppy Yoga Hamilton | AfroPuppyYoga — Ontario's #1 Puppy Yoga Studio",
  metaDescription:
    "Experience puppy yoga in Hamilton at Colibri Studio with AfroPuppyYoga. Guided yoga, Afrobeats music, and adorable puppies in the heart of Hamilton, Ontario. Book your spot now.",
  heroHeadline: "Puppy Yoga in Hamilton",
  heroSubline:
    "AfroPuppyYoga has arrived in Hamilton — guided yoga with Afrobeats energy and the cutest puppies, hosted at Colibri Studio.",
  heroBg:
    "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/og_image_apy.jpg",
  venueName: "Colibri Studio",
  venueAddress: "Hamilton, ON",
  venueArea: "Downtown Hamilton",
  aboutParagraph:
    "AfroPuppyYoga's Hamilton location brings the full experience to the Steel City. Hosted at Colibri Studio in downtown Hamilton, each session combines a beginner-friendly yoga flow, an Afrobeats soundtrack, and a carefully curated group of puppies from our trusted local breeder network. Hamilton's vibrant wellness community has embraced APY with open arms — and we're here to stay.",
  scheduleDescription: "Regular sessions — check calendar for dates",
  lumaTag: "hamilton",
  comingSoon: false,
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
