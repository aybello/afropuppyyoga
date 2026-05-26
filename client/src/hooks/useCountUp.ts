import { useState, useEffect, useRef } from "react";

export function useCountUp(end: number, duration = 2000, startOnView = true) {
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // For small numbers, multiply duration so each step is clearly visible.
  // e.g. end=3 → 3 * 600 = 1800ms, similar feel to large counters.
  const effectiveDuration = end <= 20 ? Math.max(duration, end * 600) : duration;

  useEffect(() => {
    if (!startOnView) {
      setHasStarted(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasStarted) {
          setHasStarted(true);
        }
      },
      { threshold: 0.3 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [hasStarted, startOnView]);

  useEffect(() => {
    if (!hasStarted) return;

    let startTime: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / effectiveDuration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setCount(Math.floor(eased * end));
      if (progress < 1) requestAnimationFrame(animate);
      else setCount(end); // ensure we land exactly on the target
    };

    requestAnimationFrame(animate);
  }, [hasStarted, end, effectiveDuration]);

  return { count, ref };
}
