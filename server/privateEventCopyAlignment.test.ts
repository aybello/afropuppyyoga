import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getPublicSeoSnapshot } from "./seoRenderer";

const routes = ["/corporate-puppy-yoga", "/private-puppy-yoga-events", "/private-events/quote"];
const inclusionSentence = "Refreshment, merchandise, and other option inclusions depend on the selected package or confirmed quote.";

function schemas(html: string) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map(match => JSON.parse(match[1]));
}

describe("private event crawler copy alignment", () => {
  it.each(routes)("%s has package-dependent inclusions in visible FAQ and structured FAQ", route => {
    const html = getPublicSeoSnapshot(route)!;
    const visible = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, " ");
    expect(visible).toMatch(/<dd>[^<]*inclusions depend on the selected package or confirmed quote\.<\/dd>/);
    expect(visible).toContain(inclusionSentence);
    expect(visible).not.toMatch(/refreshments?[^.]*not included by default/i);
    const faq = schemas(html).find(schema => schema["@type"] === "FAQPage");
    const answer = faq.mainEntity.find((question: { name: string }) => /what is included/i.test(question.name));
    expect(answer.acceptedAnswer.text).toContain(inclusionSentence);
    expect(answer.acceptedAnswer.text).not.toMatch(/refreshments?[^.]*not included by default/i);
  });

  it("does not imply that all quote-page refreshments are quoted only on request", () => {
    const html = getPublicSeoSnapshot("/private-events/quote")!;
    expect(html).not.toMatch(/refreshments?[^<]*quoted on request/i);
    expect(html).toContain("refreshment, branded merchandise, and other option inclusions depend on the selected package or confirmed quote");
  });

  it.each(["/partnerships", "/private-puppy-yoga-events", "/private-events/quote"])("%s has no duplicate birthday alias", route => {
    const html = getPublicSeoSnapshot(route)!;
    expect(html).not.toMatch(/<a href="\/private-events\/quote">Birthday(?: Packages)?<\/a>/);
    expect(html).toContain('href="/private-events/quote"');
  });

  it("retains the purposeful birthday link on the ethics page", () => {
    expect(getPublicSeoSnapshot("/ethics")).toContain('<a href="/private-events/quote">Birthday Packages</a>');
  });

  it.each([
    "../client/src/pages/Corporate.tsx",
    "../client/src/pages/PrivatePuppyYogaEvents.tsx",
    "./chatbot-knowledge.ts",
  ])("%s does not deny all refreshments by default", path => {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    expect(source).toMatch(/Refreshments,.*depend on the selected package and confirmed quote/i);
    expect(source).not.toMatch(/Refreshments,.*not included by default/i);
  });

  it("does not call all package photography and refreshments add-ons", () => {
    const source = readFileSync(new URL("../client/src/components/sections/PrivateEvents.tsx", import.meta.url), "utf8");
    expect(source).toContain("Photography, refreshments & merchandise depend on your package");
    expect(source).not.toContain("Add-ons: Photography, Refreshments & Merchandise");
  });
});

describe("home FAQ private event follow-up", () => {
  it("promises a personalized quote without an unverified response time", () => {
    const source = readFileSync(new URL("../client/src/components/sections/FAQ.tsx", import.meta.url), "utf8");
    const answer = source.split('q: "How do I book a private event?"')[1].split('q: "What if I\'m allergic to dogs?"')[0];
    expect(answer).toContain("Our team will follow up with your personalized quote.");
    expect(answer).not.toMatch(/within\s+\d+\s*(?:hours?|days?)/i);
    expect(answer).toContain('href="/private-events/quote"');
  });
});
