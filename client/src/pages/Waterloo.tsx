import LocationPage, { type LocationConfig } from "@/components/LocationPage";

const config: LocationConfig = {
  slug: "puppy-yoga-waterloo",
  city: "Waterloo",
  pageTitle: "Puppy Yoga Waterloo | AfroPuppyYoga",
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
  whyReasons: [
    {
      icon: "🎓",
      title: "Perfect for Students",
      desc: "UW, Laurier, and Conestoga students love APY for stress relief during midterms and finals. It's the most fun you'll have off campus.",
    },
    {
      icon: "💻",
      title: "Tech Teams & Founders",
      desc: "Waterloo's tech community uses APY for team wellness days, employee appreciation events, and startup culture moments that actually stick.",
    },
    {
      icon: "🌊",
      title: "Wellness Pop-Ups & Group Events",
      desc: "From student clubs to brand activations, APY is the go-to wellness pop-up for Waterloo Region groups who want something genuinely different.",
    },
    {
      icon: "📍",
      title: "Minutes from Waterloo",
      desc: "Our studio at TenC Dance Studio (329 King St E, Kitchener) is a short drive or bus ride from anywhere in Waterloo — easy to get to, impossible to forget.",
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
