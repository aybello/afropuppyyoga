import { HeartHandshake } from "lucide-react";
import { BOOK_URL } from "@/const";

export default function LocalDogsImpact() {
  return (
    <aside
      aria-label="Local dogs in need contribution"
      className="w-full border-b border-white/15 bg-gradient-to-r from-[#702044] via-[#8B2252] to-[#B95F3D] text-white"
    >
      <div className="container flex min-h-9 items-center justify-center gap-2 py-2 text-center sm:gap-3">
        <HeartHandshake className="size-4 shrink-0 text-[#FFD9A3]" aria-hidden="true" />
        <p className="font-body text-[11px] leading-snug sm:text-xs md:text-sm">
          <strong className="font-bold tracking-wide">Every APY ticket gives back.</strong>{" "}
          $0.50 from every eligible paid public-class ticket supports local dogs in need.
        </p>
        <a
          href={BOOK_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden shrink-0 rounded-full border border-white/35 bg-white/15 px-3 py-0.5 font-body text-xs font-bold text-white transition-colors hover:bg-white/25 sm:inline-flex"
        >
          Book a class
        </a>
      </div>
    </aside>
  );
}
