import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PRIVATE_EVENT_PACKAGE_BANDS, privateEventBandLabel } from "@shared/privateEventPricing";

// Run the actual client effects during static rendering so JSON-LD is tested,
// not merely source text. Head and unrelated app components are isolated.
vi.mock("react", async importOriginal => {
  const react = await importOriginal<typeof import("react")>();
  return { ...react, useEffect: (effect: () => void | (() => void)) => { effect(); } };
});
vi.mock("@/hooks/useSeoMeta", () => ({ useSeoMeta: () => {} }));
vi.mock("@/hooks/useMetaPixel", () => ({ useMetaPixel: () => ({ track: vi.fn() }) }));
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));
vi.mock("@/components/ChatbotWidget", () => ({ default: () => null }));
vi.mock("@/components/ScrollToTop", () => ({ default: () => null }));
vi.mock("wouter", () => ({ Link: (props: Record<string, unknown>) => createElement("a", props) }));

import Kitchener from "../client/src/pages/Kitchener";
import Hamilton from "../client/src/pages/Hamilton";
import Oakville from "../client/src/pages/Oakville";
import Waterloo from "../client/src/pages/Waterloo";
import Guelph from "../client/src/pages/Guelph";
import PrivateEvents from "../client/src/pages/PrivatePuppyYogaEvents";
import { getPublicSeoSnapshot } from "./seoRenderer";

function render(page: typeof Kitchener) {
  const scripts: Array<{ type: string; id: string; textContent: string }> = [];
  vi.stubGlobal("document", {
    createElement: () => ({ type: "", id: "", textContent: "" }),
    head: { appendChild: (script: typeof scripts[number]) => scripts.push(script) },
    getElementById: () => null,
  });
  try {
    const html = renderToStaticMarkup(createElement(page));
    return { html, schemas: scripts.filter(script => script.type === "application/ld+json").map(script => JSON.parse(script.textContent)) };
  } finally {
    vi.unstubAllGlobals();
  }
}

function assertNoUnverifiedFields(value: unknown) {
  expect(JSON.stringify(value)).not.toMatch(/"(?:geo|latitude|longitude|openingHours|openingHoursSpecification|priceRange)"|"GeoCoordinates"/);
}

describe("audited location schema", () => {
  it.each([
    ["Kitchener", Kitchener, "329 King St E", "Kitchener"],
    ["Hamilton", Hamilton, "2751 Barton Street East", "Hamilton"],
    ["Oakville", Oakville, "1670 North Service Rd E", "Oakville"],
    ["Waterloo", Waterloo, "329 King Street East", "Kitchener"],
  ] as const)("%s emits the venue address but not unverified hours, class price or coordinates", (_city, page, street, locality) => {
    const { html, schemas } = render(page);
    expect(schemas).toHaveLength(1);
    expect(schemas[0]).toMatchObject({ "@type": "LocalBusiness", address: { "@type": "PostalAddress", streetAddress: street, addressLocality: locality } });
    expect(html).toContain(street);
    assertNoUnverifiedFields(schemas);
    expect(html).toContain(`Private events starting at $${PRIVATE_EVENT_PACKAGE_BANDS.classic.min.toLocaleString("en-CA")} + HST`);
  });

  it.each(["/puppy-yoga-kitchener", "/puppy-yoga-hamilton", "/puppy-yoga-oakville"])("matches %s crawler schema on unverified fields", route => {
    const snapshot = getPublicSeoSnapshot(route)!;
    const schemas = [...snapshot.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(match => JSON.parse(match[1]));
    expect(schemas.some(schema => schema["@type"] === "LocalBusiness")).toBe(true);
    assertNoUnverifiedFields(schemas);
  });

  it("retains the private Service, FAQ and scoped offer, along with all visible package bands", () => {
    const { html, schemas } = render(PrivateEvents);
    expect(schemas).toHaveLength(1);
    const graph = schemas[0]["@graph"];
    const service = graph.find((item: Record<string, unknown>) => item["@type"] === "Service");
    expect(service).toMatchObject({ areaServed: { name: "Ontario" }, offers: { price: String(PRIVATE_EVENT_PACKAGE_BANDS.classic.min), priceCurrency: "CAD", priceSpecification: { minPrice: PRIVATE_EVENT_PACKAGE_BANDS.classic.min, maxPrice: PRIVATE_EVENT_PACKAGE_BANDS.classic.max, valueAddedTaxIncluded: false } } });
    expect(graph.some((item: Record<string, unknown>) => item["@type"] === "FAQPage")).toBe(true);
    expect(JSON.stringify(graph)).not.toContain('"@type":"LocalBusiness"');
    assertNoUnverifiedFields(graph);
    for (const band of ["classic", "signature", "luxury"] as const) expect(html).toContain(privateEventBandLabel(band));
  });

  it("keeps Guelph as an event venue and service area, not a permanent APY studio", () => {
    const { html, schemas } = render(Guelph);
    expect(html).toContain("Current Guelph event venue");
    expect(html).toContain("375 Southgate Drive, Unit 2, Guelph, Ontario");
    expect(schemas).toHaveLength(1);
    expect(schemas[0]["@graph"].some((item: Record<string, unknown>) => item["@type"] === "Service")).toBe(true);
    expect(JSON.stringify(schemas)).not.toContain('"@type":"LocalBusiness"');
    assertNoUnverifiedFields(schemas);
    const snapshot = getPublicSeoSnapshot("/puppy-yoga-guelph")!;
    expect(snapshot).not.toContain('"@type":"LocalBusiness"');
    expect(snapshot).toContain("375 Southgate Drive, Unit 2");
  });
});
