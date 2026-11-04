import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import Navbar from "../client/src/components/Navbar";

const renderNav = () => renderToStaticMarkup(createElement(Navbar));
const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("requested public navigation", () => {
  it("shows Class Pictures and Careers in the desktop navigation without opening More", () => {
    const html = renderNav();
    const header = html.match(/<header\b[\s\S]*?<\/header>/)?.[0] ?? "";
    expect(header).toContain("Class Pictures");
    expect(header).toContain('href="/careers"');
    expect(header).toContain("Careers");
    expect(header).toContain("More");
  });

  it("opens the original external class-photo folder safely in a new tab", () => {
    const html = renderNav();
    const photoLinks = html.match(/<a\b[^>]*>Class Pictures<\/a>/g) ?? [];
    expect(photoLinks).toHaveLength(2);
    for (const link of photoLinks) {
      expect(link).toContain("https://drive.google.com/drive/folders/1Q8WpKFj4cUsXlnn0jeKdBeWz5hSunp2t?usp=drive_link");
      expect(link).toContain('target="_blank"');
      expect(link).toContain('rel="noopener noreferrer"');
    }
  });

  it("keeps mobile links and gives Guelph the same location pin as the other cities", () => {
    const html = renderNav();
    const mobile = html.slice(html.indexOf('id="apy-mobile-navigation"'));
    expect(mobile).toContain("Class Pictures");
    expect(mobile).toContain("Careers");
    expect(mobile).toContain('href="/puppy-yoga-guelph"');
    expect(mobile).toContain("📍 Guelph");
    expect(source("client/src/components/Navbar.tsx")).toContain('{ label: "📍 Guelph", href: "/puppy-yoga-guelph", isPage: true }');
  });

  it("removes invoice links from both menus while preserving submission on Staff Access", () => {
    const html = renderNav();
    expect(html).not.toContain("Submit Invoice");
    expect(html).not.toContain('href="/submit-invoice"');
    expect(html).toContain('href="/staff-access"');
    expect(source("client/src/pages/StaffAccess.tsx")).toContain('href="/submit-invoice"');
    expect(source("client/src/App.tsx")).toContain('<Route path={"/submit-invoice"} component={InvoiceSubmit} />');
  });

  it("opens the existing private-event page from the header, mobile menu, hero and footer", () => {
    const html = renderNav();
    const privateLinks = html.match(/<a\b[^>]*>Private Events<\/a>/g) ?? [];
    expect(privateLinks).toHaveLength(2);
    for (const link of privateLinks) expect(link).toContain('href="/private-puppy-yoga-events"');
    const hero = source("client/src/components/sections/Hero.tsx");
    expect(hero).toContain('href="/private-puppy-yoga-events"');
    expect(hero).not.toContain('handleHomeSectionClick(e, "#private-events")');
    expect(hero).toContain('trackCTAClick("Private Events — Hero")');
    expect(source("client/src/components/Footer.tsx")).toContain('{ label: "Private Events", href: "/private-puppy-yoga-events", isPage: true }');
    expect(source("client/src/App.tsx")).toContain('<Route path="/private-puppy-yoga-events" component={PrivatePuppyYogaEvents} />');
  });
});
