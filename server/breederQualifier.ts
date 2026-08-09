import Anthropic from "@anthropic-ai/sdk";
import { ENV } from "./_core/env";

export interface QualificationResult {
  score: number;
  reasons: string[];
  warnings: string[];
  extractedBreed: string | null;
  extractedCount: number | null;
  extractedCity: string | null;
}

const APY_LOCATIONS = [
  { name: "Kitchener", lat: 43.4516, lng: -80.4925 },
  { name: "Hamilton", lat: 43.2557, lng: -79.8711 },
  { name: "Oakville", lat: 43.4675, lng: -79.6877 },
];

const PREFERRED_BREEDS = [
  "golden retriever", "labrador", "bernese mountain dog", "german shepherd",
  "poodle", "doodle", "goldendoodle", "labradoodle", "cavalier", "beagle",
  "boxer", "bulldog", "french bulldog", "corgi", "husky", "shih tzu",
  "yorkshire terrier", "pomeranian", "maltese", "bichon", "samoyed",
  "border collie", "aussie", "australian shepherd", "cane corso", "great dane",
  "doberman", "rottweiler", "mini pinscher", "miniature pinscher",
];

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export async function qualifyBreederLead(params: {
  breed: string;
  title: string;
  description: string;
  city: string;
  province: string;
  puppyCount: number | null;
  price: number | null;
}): Promise<QualificationResult> {
  const reasons: string[] = [];
  const warnings: string[] = [];
  let score = 50;

  // Breed score
  const breedLower = params.breed.toLowerCase();
  const titleLower = params.title.toLowerCase();
  const descLower = params.description.toLowerCase();
  const isPreferred = PREFERRED_BREEDS.some(b => breedLower.includes(b) || titleLower.includes(b));
  if (isPreferred) { score += 20; reasons.push("Preferred breed for APY classes"); }
  else { score -= 10; warnings.push("Breed not on APY preferred list — verify suitability"); }

  // Puppy count
  if (params.puppyCount !== null) {
    if (params.puppyCount >= 8) { score += 15; reasons.push(`Large litter (${params.puppyCount} puppies) — great for classes`); }
    else if (params.puppyCount >= 5) { score += 8; reasons.push(`Good litter size (${params.puppyCount} puppies)`); }
    else if (params.puppyCount <= 2) { score -= 10; warnings.push("Small litter — may not have enough puppies for a class"); }
  }

  // Location proximity
  const cityLower = params.city.toLowerCase();
  const nearbyLocation = APY_LOCATIONS.find(l => cityLower.includes(l.name.toLowerCase()) || l.name.toLowerCase().includes(cityLower));
  if (nearbyLocation) { score += 15; reasons.push(`Located in ${nearbyLocation.name} — same city as APY studio`); }
  else if (params.province === "ON" || params.province === "Ontario") { score += 5; reasons.push("Located in Ontario — within driving range"); }
  else { score -= 15; warnings.push("Outside Ontario — transport may be challenging"); }

  // Description quality signals
  if (descLower.includes("vaccin")) { score += 5; reasons.push("Mentions vaccinations"); }
  if (descLower.includes("dewormed") || descLower.includes("de-wormed")) { score += 5; reasons.push("Mentions deworming"); }
  if (descLower.includes("vet") || descLower.includes("health check")) { score += 3; reasons.push("Mentions vet/health checks"); }
  if (descLower.includes("socialized") || descLower.includes("socializ")) { score += 5; reasons.push("Mentions socialization — good for classes"); }
  if (descLower.includes("family") || descLower.includes("home raised")) { score += 3; reasons.push("Home/family raised"); }
  if (descLower.includes("scam") || descLower.includes("wire transfer") || descLower.includes("western union")) {
    score -= 30; warnings.push("Possible scam indicators in listing");
  }

  // Price reasonableness
  if (params.price !== null) {
    const priceDollars = params.price / 100;
    if (priceDollars > 5000) { score -= 5; warnings.push("High listing price — negotiate compensation carefully"); }
    else if (priceDollars < 200) { warnings.push("Very low price — verify legitimacy"); }
  }

  score = Math.max(0, Math.min(100, score));

  // Use Claude for AI extraction of structured data
  let extractedBreed: string | null = null;
  let extractedCount: number | null = null;
  let extractedCity: string | null = null;

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 256,
      messages: [{
        role: "user",
        content: `Extract from this puppy listing. Return JSON only: {"breed": "...", "count": number_or_null, "city": "...", "age_weeks": number_or_null}

Title: ${params.title}
Description: ${params.description.slice(0, 500)}`
      }]
    });
    const text = (response.content[0] as any).text ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      extractedBreed = parsed.breed ?? null;
      extractedCount = parsed.count ?? null;
      extractedCity = parsed.city ?? null;
    }
  } catch {
    // AI extraction is best-effort
  }

  return { score, reasons, warnings, extractedBreed, extractedCount, extractedCity };
}
