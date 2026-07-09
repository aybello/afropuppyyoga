import LocationPage, { type LocationConfig } from "@/components/LocationPage";

const config: LocationConfig = {
  slug: "kitchener",
  city: "Kitchener",
  pageTitle: "Puppy Yoga Kitchener | AfroPuppyYoga — Ontario's #1 Puppy Yoga Studio",
  metaDescription:
    "Join AfroPuppyYoga in Kitchener-Waterloo for guided yoga with adorable puppies and Afrobeats music at TenC Dance Studio. Ontario's #1 puppy yoga experience. Book your spot today.",
  heroHeadline: "Puppy Yoga in Kitchener",
  heroSubline:
    "Guided yoga, Afrobeats rhythms, and the most adorable puppies — right here in Kitchener-Waterloo at TenC Dance Studio.",
  heroBg:
    "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/og_image_apy.jpg",
  venueName: "TenC Dance Studio",
  venueAddress: "Kitchener, ON",
  venueArea: "Kitchener-Waterloo Region",
  aboutParagraph:
    "AfroPuppyYoga's Kitchener location is our flagship studio, hosted at TenC Dance Studio in the heart of the Kitchener-Waterloo region. Every session blends beginner-friendly yoga, a live Afrobeats soundtrack, and ethically sourced puppies from local breeders — creating an experience that's equal parts wellness, culture, and pure joy. Whether you're a seasoned yogi or stepping onto the mat for the first time, Kitchener is where the AfroPuppyYoga story began.",
  scheduleDescription: "Weekly sessions — check calendar for dates",
  lumaTag: "kitchener",
  comingSoon: false,
  faqs: [
    {
      question: "Where exactly is the Kitchener class held?",
      answer:
        "Classes are hosted at TenC Dance Studio in Kitchener. The exact address is shared in your booking confirmation email after you register on Luma.",
    },
    {
      question: "Do I need to bring my own yoga mat?",
      answer:
        "Yes, please bring your own mat. We recommend a mat with good grip since puppies will be climbing on you! A water bottle and comfortable clothes are also recommended.",
    },
    {
      question: "Are the puppies safe and ethically sourced?",
      answer:
        "Absolutely. All puppies come from vetted local breeders who are part of our Breeder Network. They are healthy, vaccinated, and well-socialized. Puppy welfare is our top priority — sessions are designed to be low-stress for the animals.",
    },
    {
      question: "What is the refund policy for Kitchener classes?",
      answer:
        "We operate a credit-first refund policy. If you can no longer attend, your ticket value is converted to APY credit for a future session. Cash refunds are only issued if AfroPuppyYoga cancels the class.",
    },
    {
      question: "Can I book a private event at the Kitchener location?",
      answer:
        "Yes! Private events — including corporate wellness sessions, birthday parties, and team events — are available in Kitchener. Use our Private Event Quote form to get a custom estimate.",
    },
    {
      question: "How many people are in each Kitchener session?",
      answer:
        "Sessions are kept intentionally small — a maximum of 20 guests — so every participant gets quality puppy time and a personal experience.",
    },
  ],
  schemaAddress: {
    streetAddress: "",
    addressLocality: "Kitchener",
    addressRegion: "ON",
    postalCode: "N2G",
  },
  lat: 43.4516,
  lng: -80.4925,
};

export default function KitchenerPage() {
  return <LocationPage config={config} />;
}
