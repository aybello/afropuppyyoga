import LocationPage, { type LocationConfig } from "@/components/LocationPage";
import { OAKVILLE_SEO_TITLE, OAKVILLE_SEO_COPY, LOCATION_SOCIAL_IMAGE } from "@shared/prioritySeo";

const config: LocationConfig = {
  slug: "puppy-yoga-oakville",
  city: "Oakville",
  pageTitle: OAKVILLE_SEO_TITLE,
  metaDescription: OAKVILLE_SEO_COPY,
  socialImage: LOCATION_SOCIAL_IMAGE,
  heroHeadline: "Puppy Yoga in Oakville",
  heroSubline:
    "Premium wellness meets puppy joy. AfroPuppyYoga brings guided yoga, Afrobeats, and adorable puppies to Oakville — the perfect lifestyle experience for Halton Region.",
  heroBg:
    "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/apy_hero_bg-aDMPriKGFaJ3ZgQKWVBv5n.webp",
  venueName: "1670 North Service Rd E",
  venueAddress: "1670 North Service Rd E, Oakville, ON",
  venueArea: "Oakville · Halton Region",
  aboutParagraph:
    "AfroPuppyYoga has arrived in Oakville — bringing our signature blend of guided yoga, Afrobeats music, and ethically sourced puppies to the Halton Region. Located at 1670 North Service Rd E, our Oakville sessions combine 40 minutes of guided yoga with 20 minutes of puppy play. Whether you're a yoga veteran or a complete beginner, all you need is a love of puppies and a willingness to smile.",
  scheduleDescription: "Regular sessions — check calendar for dates",
  lumaTag: "oakville",
  comingSoon: false,
  photos: [
    { src: "/manus-storage/apy_oakville_01_53c61421.jpg", alt: "Guests holding puppies at AfroPuppyYoga Oakville" },
    { src: "/manus-storage/apy_oakville_02_5e215788.jpg", alt: "Group puppy yoga class at AfroPuppyYoga Oakville" },
    { src: "/manus-storage/apy_portrait_two_goldens_oct13_44cd44f3.jpg", alt: "Smiling AfroPuppyYoga guest holding two Golden Retriever puppies" },
    { src: "/manus-storage/apy_oakville_04_9dae40cb.jpg", alt: "Guests cuddling puppies at AfroPuppyYoga Oakville" },
    { src: "/manus-storage/apy_oakville_05_c8c23baf.jpg", alt: "Guest holding a puppy at AfroPuppyYoga Oakville" },
    { src: "/manus-storage/apy_oakville_06_9d9681f7.jpg", alt: "Oakville puppy yoga guests and puppies" },
    { src: "/manus-storage/apy_oakville_07_8aaf0e91.jpg", alt: "Guests smiling with puppies at AfroPuppyYoga Oakville" },
    { src: "/manus-storage/apy_oakville_08_e580c39b.jpg", alt: "Guests sharing a puppy yoga class in Oakville" },
    { src: "/manus-storage/apy_oakville_09_8bd7bc37.jpg", alt: "Guests holding puppies at an Oakville puppy yoga class" },
  ],
  whyReasons: [
    {
      icon: "✨",
      title: "Premium Wellness Experience",
      desc: "Enjoy a welcoming Oakville session with guided movement, Afrobeats and time with puppies.",
    },
    {
      icon: "🎉",
      title: "Private Events & Corporate",
      desc: "Oakville is ideal for private events, corporate wellness days, and brand activations. Our team handles everything so you can focus on enjoying the experience.",
    },
    {
      icon: "👜",
      title: "Lifestyle Experience",
      desc: "More than a yoga class — it's a full sensory experience. Afrobeats, puppies, and wellness in one of Ontario's most beautiful communities.",
    },
    {
      icon: "🤝",
      title: "Corporate & Team Events",
      desc: "HR teams and wellness committees love APY Oakville for employee appreciation events, team-building sessions, and client entertainment.",
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
      question: "Where exactly is the Oakville class held?",
      answer:
        "Our Oakville sessions are held at 1670 North Service Rd E, Oakville, ON. It's easily accessible from the QEW and has parking available nearby.",
    },
    {
      question: "Can I book a private event in Oakville?",
      answer:
        "Yes! Private events in Oakville are available. Fill out our Private Event Quote form and mention Oakville — we'll reach out to discuss options.",
    },
    {
      question: "Is parking available at the Oakville location?",
      answer:
        "Yes — parking is available near 1670 North Service Rd E. We recommend arriving 10 minutes early to get settled before class begins.",
    },
    {
      question: "What is AfroPuppyYoga?",
      answer:
        "AfroPuppyYoga combines 40 minutes of beginner-friendly yoga and 20 minutes of puppy playtime, with an Afrobeats soundtrack and ethically sourced puppies — an experience unlike anything else in Ontario.",
    },
    {
      question: "Do I need yoga experience to attend?",
      answer:
        "Not at all! Our sessions are beginner-friendly and designed for all fitness levels. The focus is on fun, connection, and puppies — not perfecting your downward dog.",
    },
    {
      question: "What should I bring to the Oakville session?",
      answer:
        "Bring a yoga mat, comfortable clothes, and a big smile. Water bottles are welcome. We provide all the puppy cuddles.",
    },
  ],
  schemaAddress: {
    streetAddress: "1670 North Service Rd E",
    addressLocality: "Oakville",
    addressRegion: "ON",
    postalCode: "L6H 7N9",
  },
  lat: 43.4675,
  lng: -79.6877,
};

export default function OakvillePage() {
  return <LocationPage config={config} />;
}
