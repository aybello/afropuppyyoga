import LocationPage, { type LocationConfig } from "@/components/LocationPage";

const config: LocationConfig = {
  slug: "private-puppy-yoga-events",
  city: "Private Events",
  pageTitle: "Private Puppy Yoga Events Ontario | AfroPuppyYoga",
  metaDescription:
    "Book a private puppy yoga event in Ontario with AfroPuppyYoga. Perfect for birthdays, bachelorettes, team building, and corporate wellness. Available in Kitchener, Hamilton, Oakville & more. Get an instant quote.",
  heroHeadline: "Private Puppy Yoga Events",
  heroSubline:
    "Birthdays, bachelorettes, corporate wellness days, and more — AfroPuppyYoga brings the puppies, the yoga, and the Afrobeats to your private event across Ontario.",
  heroBg:
    "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/og_image_apy.jpg",
  venueName: "Your Venue or Ours",
  venueAddress: "Available across Ontario",
  venueArea: "Kitchener · Hamilton · Oakville · Toronto · Guelph · Waterloo",
  aboutParagraph:
    "AfroPuppyYoga's private events are Ontario's most unique group wellness experience. Whether you're celebrating a birthday, planning a bachelorette, rewarding your team, or activating your brand — we bring the certified yoga instructor, the ethically sourced puppies, the Afrobeats playlist, and everything else you need. We serve Kitchener, Hamilton, Oakville, Toronto, Guelph, Waterloo, and surrounding areas. Groups from 6 to 50+ welcome. Starting at $1,200.",
  scheduleDescription: "Available across Ontario — contact us to check your date",
  comingSoon: false,
  faqs: [
    {
      question: "What types of private events do you host?",
      answer:
        "We host birthdays, bachelorettes, baby showers, girls' days, corporate wellness days, team-building events, student group events, brand activations, and more. If it involves a group of people who want to have fun, we can make it work.",
    },
    {
      question: "How many people can attend a private event?",
      answer:
        "We accommodate groups from 6 to 50+ guests depending on the venue. Our Classic package starts at 6–15 guests, Signature at 10–25, and Luxury/Corporate at 20–50+.",
    },
    {
      question: "Where can you host private events?",
      answer:
        "We operate across Ontario including Kitchener, Hamilton, Oakville, Toronto, Guelph, Waterloo, and surrounding areas. We can come to your venue or arrange space at one of our partner studios.",
    },
    {
      question: "What is included in a private event?",
      answer:
        "Every private event includes a 45–60 minute guided yoga session with puppies, a certified yoga instructor and event host, all mats and props, cleanup, a custom Afrobeats playlist, and an Afro-inspired ambiance. Add-ons like photography, refreshments, and merchandise are available.",
    },
    {
      question: "How much does a private puppy yoga event cost?",
      answer:
        "Private events start at $1,200 for our Classic package. Pricing depends on group size, location, package type, and any add-ons. Use our instant quote tool to get an estimate in seconds.",
    },
    {
      question: "How do I book a private event?",
      answer:
        "Click 'Get an Instant Quote' above or visit our Private Event Quote page. Fill in your event details and we'll follow up within 24–48 hours to confirm availability and finalize your booking.",
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
  return <LocationPage config={config} />;
}
