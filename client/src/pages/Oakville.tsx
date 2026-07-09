import LocationPage, { type LocationConfig } from "@/components/LocationPage";

const config: LocationConfig = {
  slug: "oakville",
  city: "Oakville",
  pageTitle: "Puppy Yoga Oakville | AfroPuppyYoga — Oakville, Ontario",
  metaDescription:
    "AfroPuppyYoga is now in Oakville, Ontario! Ontario's #1 puppy yoga studio — guided yoga, Afrobeats music, and adorable puppies at 1670 North Service Rd E. Book your spot today.",
  heroHeadline: "Puppy Yoga in Oakville",
  heroSubline:
    "Guided yoga, Afrobeats rhythms, and the most adorable puppies — right here in Oakville at 1670 North Service Rd E.",
  heroBg:
    "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/og_image_apy.jpg",
  venueName: "1670 North Service Rd E",
  venueAddress: "1670 North Service Rd E, Oakville, ON",
  venueArea: "Oakville · Halton Region",
  aboutParagraph:
    "AfroPuppyYoga has arrived in Oakville — bringing our signature blend of guided yoga, Afrobeats music, and ethically sourced puppies to the Halton Region. Located at 1670 North Service Rd E, our Oakville sessions deliver the same unforgettable 60-minute experience that has made APY Ontario's #1 puppy yoga studio. Whether you're a yoga veteran or a complete beginner, all you need is a love of puppies and a willingness to smile.",
  scheduleDescription: "Regular sessions — check calendar for dates",
  comingSoon: false,
  faqs: [
    {
      question: "Where exactly is the Oakville class held?",
      answer:
        "Our Oakville sessions are held at 1670 North Service Rd E, Oakville, ON. It's easily accessible from the QEW and has parking available nearby.",
    },
    {
      question: "Can I book a private event in Oakville now?",
      answer:
        "Private events in Oakville may be possible before public sessions launch. Fill out our Private Event Quote form and mention Oakville — we'll reach out to discuss options.",
    },
    {
      question: "Is parking available at the Oakville location?",
      answer:
        "Yes — parking is available near 1670 North Service Rd E. We recommend arriving 10 minutes early to get settled before class begins.",
    },
    {
      question: "What is AfroPuppyYoga?",
      answer:
        "AfroPuppyYoga is Ontario's #1 puppy yoga studio. We combine beginner-friendly yoga, an Afrobeats soundtrack, and adorable puppies from our ethical breeder network into a 60-minute experience unlike anything else in Ontario.",
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
