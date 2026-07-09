import LocationPage, { type LocationConfig } from "@/components/LocationPage";

const config: LocationConfig = {
  slug: "oakville",
  city: "Oakville",
  pageTitle: "Puppy Yoga Oakville | AfroPuppyYoga — Coming Soon to Oakville, Ontario",
  metaDescription:
    "AfroPuppyYoga is coming to Oakville, Ontario! Ontario's #1 puppy yoga studio — guided yoga, Afrobeats music, and adorable puppies. Follow us to be first to know when we launch.",
  heroHeadline: "Puppy Yoga Coming to Oakville",
  heroSubline:
    "AfroPuppyYoga is expanding to Oakville. Be the first in your community to experience Ontario's #1 puppy yoga studio.",
  heroBg:
    "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/og_image_apy.jpg",
  venueName: "Venue TBA",
  venueAddress: "Oakville, ON",
  venueArea: "Halton Region",
  aboutParagraph:
    "Oakville is next on the AfroPuppyYoga map. We're bringing our signature blend of guided yoga, Afrobeats music, and ethically sourced puppies to the Halton Region. We're currently finalising our venue partner — follow us on Instagram to be the first to know when Oakville sessions go live. In the meantime, join us in Kitchener or Hamilton.",
  scheduleDescription: "Launching soon — follow for updates",
  comingSoon: true,
  faqs: [
    {
      question: "When will Oakville sessions start?",
      answer:
        "We're actively working on securing a venue in Oakville. Follow @afropuppyyoga on Instagram for the official launch announcement — subscribers will get early access to book.",
    },
    {
      question: "Can I book a private event in Oakville now?",
      answer:
        "Private events in Oakville may be possible before public sessions launch. Fill out our Private Event Quote form and mention Oakville — we'll reach out to discuss options.",
    },
    {
      question: "Where can I do puppy yoga near Oakville right now?",
      answer:
        "Our Hamilton location is the closest active studio to Oakville. You can also join us in Kitchener-Waterloo. Both locations have regular sessions — check the Luma calendar to book.",
    },
    {
      question: "What is AfroPuppyYoga?",
      answer:
        "AfroPuppyYoga is Ontario's #1 puppy yoga studio. We combine beginner-friendly yoga, an Afrobeats soundtrack, and adorable puppies from our ethical breeder network into a 60-minute experience unlike anything else in Ontario.",
    },
  ],
  schemaAddress: {
    streetAddress: "",
    addressLocality: "Oakville",
    addressRegion: "ON",
    postalCode: "L6H",
  },
  lat: 43.4675,
  lng: -79.6877,
};

export default function OakvillePage() {
  return <LocationPage config={config} />;
}
