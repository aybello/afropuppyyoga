import { HeartHandshake } from "lucide-react";

export default function LocalDogsImpact() {
  return (
    <aside
      aria-label="Local dogs in need contribution"
      className="mt-6 flex max-w-xl items-center gap-3 rounded-2xl border border-white/70 bg-[#FFF6F7]/90 px-4 py-3 text-left text-[#3D1728] shadow-[0_16px_42px_rgba(38,10,25,0.24)] backdrop-blur-md sm:mt-7 sm:gap-4 sm:px-5"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[#ECA9BD]/60 bg-[#FCE3EA] sm:size-10">
        <HeartHandshake className="size-4 text-[#A62B57] sm:size-[18px]" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="font-body text-[10px] font-bold uppercase tracking-[0.16em] text-[#A62B57]">
          Puppy love, shared forward
        </p>
        <p className="mt-0.5 font-body text-xs leading-relaxed text-[#5A2940] sm:text-sm">
          Your visit helps, too. <strong className="font-semibold text-[#7C1D43]">$0.50 from every eligible paid public-class ticket</strong> supports local dogs in need.
        </p>
      </div>
    </aside>
  );
}
