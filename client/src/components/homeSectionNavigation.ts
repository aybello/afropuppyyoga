import type { MouseEvent } from "react";

// Home sections are mounted on demand, so a fragment may not exist yet.
export const HOME_SECTION_NAVIGATION = "home-section-navigation";
export const HOME_SECTION_HASHES = new Set([
  "#home", "#experience", "#memberships", "#private-events", "#gallery",
  "#about", "#our-story", "#reviews", "#faq",
]);

// Positions in Home's DeferredSection list, including non-navigation sections.
// Keep in sync with Home.tsx; a dedicated test checks this order.
const DEFERRED_SECTION_INDEX: Record<string, number> = {
  "#experience": 0,
  "#memberships": 2,
  "#about": 3,
  "#our-story": 4,
  "#private-events": 5,
  "#gallery": 6,
  "#reviews": 8,
  "#faq": 13,
};
export function isHomeDeferredSectionTarget(hash: string, marker: Element) {
  const index = DEFERRED_SECTION_INDEX[hash];
  return index !== undefined && document.querySelectorAll("[data-home-deferred-section]")[index] === marker;
}

let cancelPendingScroll: (() => void) | undefined;
const INTERRUPT_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]);
const MOUNT_TIMEOUT_MS = 10000;
const STABILIZATION_MS = 2000;
const STABILIZATION_INTERVAL_MS = 100;

export function scrollToHomeSection(hash: string) {
  cancelPendingScroll?.();
  if (window.location.pathname !== "/" || !HOME_SECTION_HASHES.has(hash)) return;

  let observer: MutationObserver | undefined;
  let timeout: number | undefined;
  let interval: number | undefined;
  let finished = false;
  let scrolled = false;
  const interrupt = () => cleanup();
  const interruptKey = (event: KeyboardEvent) => {
    if (INTERRUPT_KEYS.has(event.key)) cleanup();
  };
  const cleanup = () => {
    if (finished) return;
    finished = true;
    observer?.disconnect();
    if (timeout !== undefined) window.clearTimeout(timeout);
    if (interval !== undefined) window.clearInterval(interval);
    window.removeEventListener("wheel", interrupt);
    window.removeEventListener("touchstart", interrupt);
    window.removeEventListener("pointerdown", interrupt);
    window.removeEventListener("keydown", interruptKey);
    if (cancelPendingScroll === cleanup) cancelPendingScroll = undefined;
  };
  cancelPendingScroll = cleanup;
  window.addEventListener("wheel", interrupt, { passive: true });
  window.addEventListener("touchstart", interrupt, { passive: true });
  window.addEventListener("pointerdown", interrupt, { passive: true });
  window.addEventListener("keydown", interruptKey);
  timeout = window.setTimeout(cleanup, MOUNT_TIMEOUT_MS);

  const scroll = () => {
    const target = document.getElementById(hash.slice(1));
    if (!target || finished || scrolled) return false;
    scrolled = true;
    observer?.disconnect();
    observer = undefined;
    if (timeout !== undefined) window.clearTimeout(timeout);

    // Instant scrolling avoids racing a smooth animation with corrections and
    // respects reduced motion. Focus makes keyboard navigation like a fragment
    // link without adding a permanent extra tab stop.
    target.scrollIntoView({ behavior: "instant", block: "start" });
    const hadTabIndex = target.hasAttribute("tabindex");
    if (!hadTabIndex) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
    if (!hadTabIndex) target.removeAttribute("tabindex");

    let viewportTop = target.getBoundingClientRect().top;
    let documentTop = viewportTop + window.scrollY;
    interval = window.setInterval(() => {
      if (!target.isConnected || window.location.pathname !== "/") return cleanup();
      const nextViewportTop = target.getBoundingClientRect().top;
      const nextDocumentTop = nextViewportTop + window.scrollY;
      // If scroll anchoring already compensated the shift, do nothing. Do not
      // counteract ordinary scrolling when the target's document position is stable.
      if (Math.abs(nextDocumentTop - documentTop) > 1 && Math.abs(nextViewportTop - viewportTop) > 1) {
        window.scrollBy({ top: nextViewportTop - viewportTop, behavior: "instant" });
      }
      viewportTop = target.getBoundingClientRect().top;
      documentTop = viewportTop + window.scrollY;
    }, STABILIZATION_INTERVAL_MS);
    timeout = window.setTimeout(cleanup, STABILIZATION_MS);
    return true;
  };
  if (scroll()) return;

  // Observe before dispatch, so even synchronous mounts cannot be missed.
  observer = new MutationObserver(scroll);
  observer.observe(document.body, { childList: true, subtree: true });
  window.dispatchEvent(new CustomEvent(HOME_SECTION_NAVIGATION, { detail: hash }));
  scroll();
}
export function homeSectionHref(hash: string) {
  return `/${hash}`;
}
export function handleHomeSectionClick(event: MouseEvent<HTMLAnchorElement>, hash: string) {
  // Preserve native link behavior for new tabs, downloads, unknown hashes and subpages.
  const anchor = event.currentTarget;
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
      window.location.pathname !== "/" || !HOME_SECTION_HASHES.has(hash) ||
      (anchor?.target && anchor.target.toLowerCase() !== "_self") || anchor?.hasAttribute("download")) return;
  event.preventDefault();
  if (window.location.hash !== hash) window.history.pushState(null, "", hash);
  scrollToHomeSection(hash);
}
