import { HeartHandshake } from "lucide-react";

export default function LocalDogsImpact() {
  return (
    <aside
      aria-label="Local dogs in need contribution"
      className="mt-6 flex max-w-xl items-center gap-3 rounded-2xl border border-[#F2A0B8]/45 bg-[#2C1320]/70 px-4 py-3 text-left text-white shadow-[0_16px_42px_rgba(17,5,10,0.28)] backdrop-blur-md sm:mt-7 sm:gap-4 sm:px-5"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[#FFD9A3]/40 bg-[#FFD9A3]/10 sm:size-10">
        <HeartHandshake className="size-4 text-[#FFD9A3] sm:size-[18px]" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="font-body text-[10px] font-bold uppercase tracking-[0.16em] text-[#FFD9A3]">
          Puppy love, shared forward
        </p>
        <p className="mt-0.5 font-body text-xs leading-relaxed text-white/90 sm:text-sm">
          Your visit helps, too. <strong className="font-semibold text-white">$0.50 from every eligible paid public-class ticket</strong> supports local dogs in need.
        </p>
      </div>
    </aside>
  );
}
