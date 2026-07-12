import LocationPage, { type LocationConfig } from "@/components/LocationPage";

const config: LocationConfig = {
  slug: "puppy-yoga-oakville",
  city: "Oakville",
  pageTitle: "Puppy Yoga Oakville | AfroPuppyYoga",
  metaDescription:
    "AfroPuppyYoga is now in Oakville, Ontario! Ontario's #1 puppy yoga studio — guided yoga, Afrobeats music, and adorable puppies at 1670 North Service Rd E. Book your spot today.",
  heroHeadline: "Puppy Yoga in Oakville",
  heroSubline:
    "Premium wellness meets puppy joy. AfroPuppyYoga brings guided yoga, Afrobeats, and adorable puppies to Oakville — the perfect lifestyle experience for Halton Region.",
  heroBg:
    "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/apy_hero_bg-aDMPriKGFaJ3ZgQKWVBv5n.webp",
  venueName: "1670 North Service Rd E",
  venueAddress: "1670 North Service Rd E, Oakville, ON",
  venueArea: "Oakville · Halton Region",
  aboutParagraph:
    "AfroPuppyYoga has arrived in Oakville — bringing our signature blend of guided yoga, Afrobeats music, and ethically sourced puppies to the Halton Region. Located at 1670 North Service Rd E, our Oakville sessions deliver the same unforgettable 60-minute experience (40 min guided yoga + 20 min puppy playtime) that has made APY Ontario's #1 puppy yoga studio. Whether you're a yoga veteran or a complete beginner, all you need is a love of puppies and a willingness to smile.",
  scheduleDescription: "Regular sessions — check calendar for dates",
  lumaTag: "oakville",
  comingSoon: false,
  photos: [
    { src: "/manus-storage/IMG_9559_22a49091.jpg", alt: "Large group of guests holding white puppies at AfroPuppyYoga Oakville — June 6th session" },
    { src: "/manus-storage/IMG_9493_1a1dc0c8.jpg", alt: "Full seated class with puppies at AfroPuppyYoga Oakville showing community turnout" },
    { src: "/manus-storage/IMG_0417_54fe55cb.jpg", alt: "Group portrait of AfroPuppyYoga Oakville attendees each holding a white puppy" },
    { src: "/manus-storage/IMG_9626_a8888e2b.jpg", alt: "Guest smiling while holding a white puppy at AfroPuppyYoga Oakville" },
    { src: "/manus-storage/IMG_9509_25571ba7.jpg", alt: "Three guests with puppies at AfroPuppyYoga Oakville — candid playtime moment" },
    { src: "/manus-storage/IMG_9510_a228a3ed.jpg", alt: "Three guests smiling with white puppies at AfroPuppyYoga Oakville" },
    { src: "/manus-storage/IMG_9504_2b32bdbe.jpg", alt: "Two guests holding a white puppy at AfroPuppyYoga Oakville" },
    { src: "/manus-storage/IMG_9507_16f088a8.jpg", alt: "Guest holding a white puppy at AfroPuppyYoga Oakville studio" },
    { src: "/manus-storage/IMG_9514_7f1062b9.jpg", alt: "Guest cradling a white puppy at AfroPuppyYoga Oakville" },
  ],
  whyReasons: [
    {
      icon: "✨",
      title: "Premium Wellness Experience",
      desc: "Oakville deserves the best. APY's Oakville sessions deliver the same premium, curated experience that has made us Ontario's #1 puppy yoga studio.",
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
        "AfroPuppyYoga is Ontario's #1 puppy yoga studio. We combine 40 minutes of beginner-friendly yoga and 20 minutes of puppy playtime, with an Afrobeats soundtrack and ethically sourced puppies — an experience unlike anything else in Ontario.",
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
