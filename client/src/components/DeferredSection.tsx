import { type ReactNode, useEffect, useRef, useState } from "react";
import { PUBLIC_DEFERRED_SECTION_MARGIN } from "@shared/deferredSection";

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
    const marker = markerRef.current;
    if (!marker) return;

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
  }, [rootMargin]);

  return (
    <div ref={markerRef} style={shouldRender ? undefined : { minHeight }}>
      {shouldRender ? children : null}
    </div>
  );
}
