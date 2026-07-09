import LocationPage, { type LocationConfig } from "@/components/LocationPage";

const config: LocationConfig = {
  slug: "puppy-yoga-waterloo",
  city: "Waterloo",
  pageTitle: "Puppy Yoga Waterloo | AfroPuppyYoga — Waterloo-Region, Ontario",
  metaDescription:
    "Puppy yoga in Waterloo, Ontario. AfroPuppyYoga brings guided yoga, Afrobeats music, and adorable puppies to the Waterloo Region. Perfect for students, tech teams, and wellness seekers. Book now.",
  heroHeadline: "Puppy Yoga in Waterloo",
  heroSubline:
    "Ontario's #1 puppy yoga studio is right next door. Join students, founders, and wellness lovers from Waterloo for a 60-minute session unlike anything else.",
  heroBg:
    "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/og_image_apy.jpg",
  venueName: "TenC Dance Studio",
  venueAddress: "329 King Street East, Kitchener, ON",
  venueArea: "Kitchener-Waterloo Region",
  aboutParagraph:
    "Waterloo is part of the Kitchener-Waterloo Region — and AfroPuppyYoga's flagship studio at TenC Dance Studio (329 King St E, Kitchener) is just minutes away. Whether you're a student at Waterloo or Laurier, a founder at a local tech startup, or simply looking for a genuinely different wellness experience, APY is your spot. Our 60-minute sessions blend beginner-friendly yoga, an Afrobeats soundtrack, and ethically sourced puppies into something you'll want to come back for every week.",
  scheduleDescription: "Regular sessions in Kitchener — minutes from Waterloo",
  comingSoon: false,
  faqs: [
    {
      question: "Is AfroPuppyYoga in Waterloo itself?",
      answer:
        "Our studio is at TenC Dance Studio, 329 King Street East in Kitchener — just a short drive or bus ride from Waterloo. The Kitchener-Waterloo Region is our home base and we serve the entire region.",
    },
    {
      question: "Is this good for university students?",
      answer:
        "Absolutely. We regularly host students from the University of Waterloo, Wilfrid Laurier, and Conestoga College. It's a great stress-relief activity during midterms or finals, and a fun way to meet people outside your program.",
    },
    {
      question: "Do you offer group bookings for student clubs or tech teams?",
      answer:
        "Yes — we offer private group sessions for student clubs, startup teams, and corporate wellness days. Fill out our Private Event Quote form and we'll put together a custom package.",
    },
    {
      question: "Do I need yoga experience?",
      answer:
        "Not at all. Our sessions are designed to be beginner-friendly. The instructor guides you through every pose, and the puppies make sure nobody takes themselves too seriously.",
    },
    {
      question: "How do I book a spot?",
      answer:
        "All public sessions are booked through Luma. Click 'Book a Class in Waterloo' above to see upcoming dates and reserve your mat.",
    },
    {
      question: "Can I bring a friend?",
      answer:
        "Yes — and we encourage it! Puppy yoga is even better with friends. Each person needs to book their own ticket through Luma.",
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

export default function WaterlooPage() {
  return <LocationPage config={config} />;
}
