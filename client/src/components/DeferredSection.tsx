import { type ReactNode, useEffect, useRef, useState } from "react";
import { PUBLIC_DEFERRED_SECTION_MARGIN } from "@shared/deferredSection";
import { HOME_SECTION_NAVIGATION, isHomeDeferredSectionTarget } from "./homeSectionNavigation";

type DeferredSectionProps = {
  children: ReactNode;
  minHeight?: string;
  rootMargin?: string;
};

/**
 * Defers rendering costly below-the-fold content until it is close to the viewport.
 * This deliberately postpones lazy import evaluation and any third-party/media work
 * owned by the child section; it does not cache visitor-facing data.
 */
export default function DeferredSection({
  children,
  minHeight = "24rem",
  rootMargin = PUBLIC_DEFERRED_SECTION_MARGIN,
}: DeferredSectionProps) {
  const markerRef = useRef<HTMLDivElement>(null);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (shouldRender) return;
    const reveal = (event: Event) => {
      const hash = (event as CustomEvent<string>).detail;
      if (markerRef.current && isHomeDeferredSectionTarget(hash, markerRef.current)) {
        setShouldRender(true);
      }
    };
    window.addEventListener(HOME_SECTION_NAVIGATION, reveal);
    return () => window.removeEventListener(HOME_SECTION_NAVIGATION, reveal);
  }, [shouldRender]);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker || shouldRender) return;

    if (typeof IntersectionObserver === "undefined") {
      setShouldRender(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldRender(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(marker);
    return () => observer.disconnect();
  }, [rootMargin, shouldRender]);

  return (
    <div ref={markerRef} data-home-deferred-section style={shouldRender ? undefined : { minHeight }}>
      {shouldRender ? children : null}
    </div>
  );
}
