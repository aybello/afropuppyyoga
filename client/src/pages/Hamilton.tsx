import LocationPage, { type LocationConfig } from "@/components/LocationPage";

const config: LocationConfig = {
  slug: "puppy-yoga-hamilton",
  city: "Hamilton",
  pageTitle: "Puppy Yoga Hamilton | AfroPuppyYoga",
  metaDescription:
    "Puppy yoga in Hamilton at Colibri Studio, 2751 Barton Street East. Enjoy guided movement, Afrobeats and puppy cuddles with AfroPuppyYoga. Book your class.",
  heroHeadline: "Puppy Yoga in Hamilton",
  heroSubline:
    "Guided yoga, Afrobeats and adorable puppies at our main Hamilton studio, Colibri Studio, 2751 Barton Street East. Check your event listing for any collaboration venue.",
  heroBg:
    "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/apy_hero_bg-aDMPriKGFaJ3ZgQKWVBv5n.webp",
  venueName: "Colibri Studio (Main Studio)",
  venueAddress: "2751 Barton Street East, Hamilton, ON L8E 2J8",
  venueArea: "Your selected Luma event confirms whether it is at our main studio or a collaboration location.",
  venues: [
    { name: "Colibri Studio (Main Studio)", address: "2751 Barton Street East, Hamilton, ON L8E 2J8" },
    { name: "Something New (Collaboration Location)", address: "416 Concession Street, Hamilton, ON L9A 1B9" },
  ],
  aboutParagraph:
    "Our main Hamilton studio is Colibri Studio at 2751 Barton Street East. Join us for beginner-friendly yoga, Afrobeats and puppy cuddles. We also hold selected collaboration events at Something New, 416 Concession Street. Check your chosen event's venue and date on Luma before planning your visit.",
  scheduleDescription: "Check the calendar for dates and each event's venue",
  lumaTag: "hamilton",
  comingSoon: false,
  photos: [
    { src: "/manus-storage/apy_hamilton_01_7eb2d831.jpg", alt: "Group puppy yoga class at AfroPuppyYoga Hamilton" },
    { src: "/manus-storage/apy_hamilton_02_9988ec38.jpg", alt: "Guests enjoying puppy yoga at AfroPuppyYoga Hamilton" },
    { src: "/manus-storage/apy_portrait_golden_cuddle_oct19_d7e4953e.jpg", alt: "Smiling AfroPuppyYoga guest holding a Golden Retriever puppy" },
    { src: "/manus-storage/apy_hamilton_04_e6d3a3ec.jpg", alt: "Guest cuddling a puppy at AfroPuppyYoga Hamilton" },
    { src: "/manus-storage/apy_hamilton_05_49dbd964.jpg", alt: "Guest sharing a puppy yoga class with a puppy in Hamilton" },
    { src: "/manus-storage/apy_hamilton_06_2f7917c8.jpg", alt: "Guest holding a puppy at AfroPuppyYoga Hamilton" },
    { src: "/manus-storage/apy_hamilton_07_69b39dc5.jpg", alt: "Guest smiling with a puppy at AfroPuppyYoga Hamilton" },
    { src: "/manus-storage/apy_hamilton_08_f829b0cf.jpg", alt: "Guests relaxing with puppies at AfroPuppyYoga Hamilton" },
    { src: "/manus-storage/apy_hamilton_09_0509434b.jpg", alt: "Guests holding puppies at a Hamilton puppy yoga class" },
  ],
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
        "Our main studio is Colibri Studio, 2751 Barton Street East, Hamilton, ON L8E 2J8. Something New, 416 Concession Street, Hamilton, ON L9A 1B9, is a collaboration location for selected events only. Check the venue on your selected Luma event before booking.",
    },
    {
      question: "Is parking available near Colibri Studio?",
      answer:
        "Colibri Studio has on-site parking. It is upstairs from Frank's Glass and Mirror, with the entrance on the right. If your class is at Something New, check that event's arrival details instead.",
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
        "All AfroPuppyYoga tickets are final sale and refunds are not issued. If AfroPuppyYoga cancels a class, you receive a full class credit code for a future session instead.",
    },
    {
      question: "Can I book a private event in Hamilton?",
      answer:
        "Yes! Private events — corporate wellness days, birthday parties, bachelorette parties, and team experiences — are available in Hamilton. Fill out our Private Event Quote form to get started.",
    },
  ],
  schemaAddress: {
    streetAddress: "2751 Barton Street East",
    addressLocality: "Hamilton",
    addressRegion: "ON",
    postalCode: "L8E 2J8",
  },
  lat: 43.2255,
  lng: -79.7747,
};

export default function HamiltonPage() {
  return <LocationPage config={config} />;
}
