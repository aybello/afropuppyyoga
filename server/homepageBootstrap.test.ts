import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(new URL("../client/src/pages/Home.tsx", import.meta.url), "utf8");
const mainSource = readFileSync(new URL("../client/src/main.tsx", import.meta.url), "utf8");
const homeBootstrapSource = readFileSync(new URL("../client/src/homeBootstrap.tsx", import.meta.url), "utf8");
const navbarSource = readFileSync(new URL("../client/src/components/Navbar.tsx", import.meta.url), "utf8");
const indexSource = readFileSync(new URL("../client/index.html", import.meta.url), "utf8");
const heroSource = readFileSync(new URL("../client/src/components/sections/Hero.tsx", import.meta.url), "utf8");

describe("public homepage performance bootstrap", () => {
  it("selects the lean public bootstrap before loading portal and dashboard code", () => {
    expect(mainSource).toContain('window.location.pathname === "/"');
    expect(mainSource).toContain('import("./homeBootstrap")');
    expect(mainSource).toContain('import("./appBootstrap")');
  });

  it("shows a real booking shell before React is ready", () => {
    expect(indexSource).toContain('id="home-first-paint"');
    expect(indexSource).toContain("Where Wellness");
    expect(indexSource).toContain("Book a Class");
    expect(indexSource).toContain('window.location.pathname === "/"');
    expect(indexSource).toContain('classList.add("home-pending")');
    expect(indexSource).toContain("html.home-pending #home-first-paint { display: flex; }");
  });

  it("keeps the hero image in place while React takes over the shell", () => {
    expect(homeBootstrapSource).not.toContain('classList.remove("home-pending")');
    expect(heroSource).toContain('classList.remove("home-pending")');
  });

  it("keeps public booking widgets inside the tRPC and query providers", () => {
    expect(homeBootstrapSource).toContain("ClientDataProviders");
    expect(homeBootstrapSource).toContain("<Home />");
  });

  it("uses regular navigation for routes outside the lean homepage", () => {
    expect(navbarSource).not.toContain('from "wouter"');
    expect(navbarSource).toContain('href={link.href}');
    expect(navbarSource).toContain('href="/staff-access"');
  });

  it("defers costly below-fold and chat code from the first React render", () => {
    expect(homeSource).toContain('const Experience = lazy');
    expect(homeSource).toContain('const ChatbotWidget = lazy');
    expect(homeSource).toContain('const DeferredMetaPixel = lazy');
    expect(homeSource).not.toContain('import Experience from');
    expect(homeSource).not.toContain('import ChatbotWidget from');
  });

  it("uses CSS rather than Framer Motion for the hero viewport", () => {
    expect(heroSource).not.toContain("framer-motion");
    expect(heroSource).toContain("heroReveal");
  });
});
