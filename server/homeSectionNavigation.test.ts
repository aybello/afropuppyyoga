import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Navbar from "../client/src/components/Navbar";
import Footer from "../client/src/components/Footer";
import { handleHomeSectionClick, homeSectionHref, HOME_SECTION_NAVIGATION, isHomeDeferredSectionTarget, scrollToHomeSection } from "../client/src/components/homeSectionNavigation";

let nodes: Record<string, ReturnType<typeof target>>;
let callbacks: Array<() => void>;
let disconnects: Array<ReturnType<typeof vi.fn>>;
let location: { pathname: string; hash: string };
let bus: EventTarget;
let pushState: ReturnType<typeof vi.fn>;
let scrollBy: ReturnType<typeof vi.fn>;
let markers: Element[];
let mockWindow: any;
function target(initialTop = 500) {
  let top = initialTop;
  const attributes = new Set<string>();
  return {
    scrollIntoView: vi.fn(), focus: vi.fn(), isConnected: true,
    hasAttribute: (name: string) => attributes.has(name),
    setAttribute: (name: string) => attributes.add(name),
    removeAttribute: (name: string) => attributes.delete(name),
    getBoundingClientRect: () => ({ top: top - mockWindow.scrollY }),
    shift: (delta: number) => { top += delta; },
  };
}
beforeEach(() => {
  vi.useFakeTimers();
  nodes = {}; callbacks = []; disconnects = [];
  markers = Array.from({ length: 15 }, () => ({} as Element));
  location = { pathname: "/", hash: "" };
  bus = new EventTarget();
  pushState = vi.fn((_state, _title, hash: string) => { location.hash = hash; });
  scrollBy = vi.fn(({ top }) => { mockWindow.scrollY += top; });
  mockWindow = {
    location, history: { pushState }, scrollY: 0, scrollBy,
    addEventListener: bus.addEventListener.bind(bus), removeEventListener: bus.removeEventListener.bind(bus),
    dispatchEvent: bus.dispatchEvent.bind(bus), setTimeout, clearTimeout, setInterval, clearInterval,
  };
  vi.stubGlobal("window", mockWindow);
  vi.stubGlobal("document", { body: {}, getElementById: (id: string) => nodes[id], querySelectorAll: () => markers });
  vi.stubGlobal("MutationObserver", class {
    constructor(callback: () => void) { callbacks.push(callback); }
    observe() {}
    disconnect = (() => { const fn = vi.fn(); disconnects.push(fn); return fn; })();
  });
  vi.stubGlobal("CustomEvent", class extends Event {
    detail: unknown;
    constructor(type: string, options: { detail: unknown }) { super(type); this.detail = options.detail; }
  });
});
afterEach(() => {
  scrollToHomeSection("");
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function click(overrides = {}) {
  return { button: 0, defaultPrevented: false, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false,
    currentTarget: { target: "", hasAttribute: () => false }, preventDefault: vi.fn(), ...overrides } as any;
}
describe("homepage section navigation", () => {
  it("renders private-event links for desktop, mobile and footer on every route", () => {
    for (const path of ["/", "/careers", "/private-events/quote"]) {
      location.pathname = path;
      const html = renderToStaticMarkup(createElement(Navbar));
      expect([...html.matchAll(/<a\b[^>]*href="\/#private-events"[^>]*>Private Events<\/a>/g)]).toHaveLength(2);
      expect(renderToStaticMarkup(createElement(Footer))).toMatch(/href="\/#private-events"[^>]*>Private Events<\/a>/);
    }
    expect(homeSectionHref("#gallery")).toBe("/#gallery");
  });
  it("keeps targeted wrapper mapping in sync with Home and requests only the matching section", () => {
    const home = readFileSync("client/src/pages/Home.tsx", "utf8");
    const names = [...home.matchAll(/<DeferredSection\b[^>]*><Suspense\b[^\n]*?}><(\w+)\s*\/>/g)].map(m => m[1]);
    expect(names).toEqual(["Experience", "LumaCalendar", "Memberships", "About", "OurStory", "PrivateEvents", "Gallery", "InstagramFeed", "Reviews", "OurValues", "LoyaltyProgram", "GiftCards", "EthicalStandards", "FAQ", "Contact"]);
    const cases: Record<string, string> = { "#experience": "Experience", "#memberships": "Memberships", "#about": "About", "#our-story": "OurStory", "#private-events": "PrivateEvents", "#gallery": "Gallery", "#reviews": "Reviews", "#faq": "FAQ" };
    for (const [hash, name] of Object.entries(cases)) {
      const matching = markers.flatMap((marker, index) => isHomeDeferredSectionTarget(hash, marker) ? [index] : []);
      expect(matching).toEqual([names.indexOf(name)]);
    }
    expect(markers.some(marker => isHomeDeferredSectionTarget("#unknown", marker))).toBe(false);
    const event = click();
    const requested = vi.fn();
    bus.addEventListener(HOME_SECTION_NAVIGATION, requested);
    handleHomeSectionClick(event, "#private-events");
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(pushState).toHaveBeenCalledWith(null, "", "#private-events");
    expect(requested).toHaveBeenCalledOnce();
    expect((requested.mock.calls[0][0] as CustomEvent).detail).toBe("#private-events");
    nodes["private-events"] = target(); callbacks[0]();
    expect(nodes["private-events"].scrollIntoView).toHaveBeenCalledWith({ behavior: "instant", block: "start" });
    expect(nodes["private-events"].focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(nodes["private-events"].hasAttribute("tabindex")).toBe(false);
    expect(disconnects[0]).toHaveBeenCalledOnce();
  });
  it("corrects shifts above the target for a bounded time, without fighting scroll anchoring", () => {
    nodes.gallery = target(); scrollToHomeSection("#gallery");
    nodes.gallery.shift(150); vi.advanceTimersByTime(100);
    expect(scrollBy).toHaveBeenCalledWith({ top: 150, behavior: "instant" });
    nodes.gallery.shift(100); mockWindow.scrollY += 100; vi.advanceTimersByTime(100);
    expect(scrollBy).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(2000); nodes.gallery.shift(100); vi.advanceTimersByTime(100);
    expect(scrollBy).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("stops correction on user input and preserves an existing tabindex", () => {
    nodes.gallery = target(); nodes.gallery.setAttribute("tabindex"); scrollToHomeSection("#gallery");
    bus.dispatchEvent(new Event("wheel")); nodes.gallery.shift(150); vi.advanceTimersByTime(2500);
    expect(scrollBy).not.toHaveBeenCalled();
    expect(nodes.gallery.hasAttribute("tabindex")).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("supports direct hash requests and disconnects superseded and timed-out observers", () => {
    location.hash = "#private-events"; scrollToHomeSection(location.hash); scrollToHomeSection("#gallery");
    expect(disconnects[0]).toHaveBeenCalledOnce();
    nodes.gallery = target(); callbacks[0]();
    expect(nodes.gallery.scrollIntoView).not.toHaveBeenCalled();
    callbacks[1](); expect(nodes.gallery.scrollIntoView).toHaveBeenCalledOnce();
    expect(disconnects[1]).toHaveBeenCalledOnce();
    scrollToHomeSection("#faq"); vi.advanceTimersByTime(10000);
    expect(disconnects[2]).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("leaves subpage, modified, download, target and unknown links native", () => {
    for (const overrides of [
      { ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }, { defaultPrevented: true },
      { currentTarget: { target: "_blank", hasAttribute: () => false } },
      { currentTarget: { target: "", hasAttribute: (name: string) => name === "download" } },
    ]) {
      const event = click(overrides); handleHomeSectionClick(event, "#private-events");
      expect(event.preventDefault).not.toHaveBeenCalled();
    }
    const unknown = click(); handleHomeSectionClick(unknown, "#other");
    expect(unknown.preventDefault).not.toHaveBeenCalled();
    location.pathname = "/careers";
    const subpage = click(); handleHomeSectionClick(subpage, "#private-events");
    expect(subpage.preventDefault).not.toHaveBeenCalled();
    expect(pushState).not.toHaveBeenCalled();
  });
});
