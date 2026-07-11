import LocationPage, { type LocationConfig } from "@/components/LocationPage";

const config: LocationConfig = {
  slug: "puppy-yoga-kitchener",
  city: "Kitchener",
  pageTitle: "Puppy Yoga Kitchener | AfroPuppyYoga",
  metaDescription:
    "Join AfroPuppyYoga in Kitchener-Waterloo for guided yoga with adorable puppies and Afrobeats music at TenC Dance Studio. Ontario's #1 puppy yoga experience. Book your spot today.",
  heroHeadline: "Puppy Yoga in Kitchener",
  heroSubline:
    "Guided yoga, Afrobeats rhythms, and the most adorable puppies — right here in Kitchener-Waterloo at TenC Dance Studio.",
  heroBg:
    "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/apy_hero_bg-aDMPriKGFaJ3ZgQKWVBv5n.webp",
  venueName: "TenC Dance Studio",
  venueAddress: "329 King St E, Kitchener, ON",
  venueArea: "Kitchener-Waterloo Region",
  aboutParagraph:
    "AfroPuppyYoga's Kitchener location is our flagship studio, hosted at TenC Dance Studio in the heart of the Kitchener-Waterloo region. Every session blends beginner-friendly yoga, a live Afrobeats soundtrack, and ethically sourced puppies from local breeders — creating an experience that's equal parts wellness, culture, and pure joy. Whether you're a seasoned yogi or stepping onto the mat for the first time, Kitchener is where the AfroPuppyYoga story began.",
  scheduleDescription: "Weekly sessions — check calendar for dates",
  lumaTag: "kitchener",
  comingSoon: false,
  photos: [
    { src: "/manus-storage/kitchener_1_2a351bee.jpg", alt: "Woman smiling while holding a Rottweiler puppy at AfroPuppyYoga Kitchener" },
    { src: "/manus-storage/kitchener_2_4e59e53b.jpg", alt: "Two women laughing together with puppies at AfroPuppyYoga Kitchener" },
    { src: "/manus-storage/kitchener_3_71fbfcea.jpg", alt: "Three guests each holding Rottweiler puppies at AfroPuppyYoga Kitchener" },
    { src: "/manus-storage/kitchener_4_b07bc256.jpg", alt: "Couple smiling with a puppy at AfroPuppyYoga Kitchener" },
  ],
  whyReasons: [
    {
      icon: "🏠",
      title: "Our Flagship Location",
      desc: "Kitchener is where AfroPuppyYoga was born. The energy here is unmatched — it's the original home of the experience that started it all.",
    },
    {
      icon: "📍",
      title: "Central KW Location",
      desc: "TenC Dance Studio is easy to get to from anywhere in Kitchener-Waterloo — close to transit, parking, and the downtown core.",
    },
    {
      icon: "💑",
      title: "Perfect Date Idea",
      desc: "Looking for something different? Puppy yoga in Kitchener is one of the most memorable and talked-about date ideas in the region.",
    },
    {
      icon: "👯",
      title: "Girls' Day & Friend Groups",
      desc: "Whether it's a birthday, a girls' day, or just a weekend activity with friends, Kitchener sessions are designed for groups who want to have fun.",
    },
  ],
  reviews: [
    {
      name: "Sheila Soares",
      avatar: "SS",
      text: "So fun and well run! Highly recommend this experience. The puppies were adorable and the yoga instructor was amazing. Will definitely be back!",
      date: "1 month ago",
    },
    {
      name: "Cameron T.",
      avatar: "CT",
      text: "Absolutely incredible experience! The Afro-beat music, the puppies, the yoga — everything was perfectly curated. I've never felt so relaxed and happy at the same time.",
      date: "2 months ago",
    },
    {
      name: "Priya M.",
      avatar: "PM",
      text: "Brought my whole friend group for a birthday celebration and everyone LOVED it. The staff were so welcoming and the puppies were pure joy. 10/10 would recommend!",
      date: "3 months ago",
    },
  ],
  faqs: [
    {
      question: "Where exactly is the Kitchener class held?",
      answer:
        "Classes are hosted at TenC Dance Studio, 329 King St E, Kitchener. The exact address is also shared in your booking confirmation email after you register on Luma.",
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
    streetAddress: "329 King St E",
    addressLocality: "Kitchener",
    addressRegion: "ON",
    postalCode: "N2G 2L3",
  },
  lat: 43.4516,
  lng: -80.4925,
};

export default function KitchenerPage() {
  return <LocationPage config={config} />;
}
