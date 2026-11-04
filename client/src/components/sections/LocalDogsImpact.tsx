import { HeartIcon } from "@/components/PublicIcons";

export default function LocalDogsImpact() {
  return (
    <aside
      aria-label="Local dogs in need contribution"
      className="mt-6 flex max-w-xl items-start gap-3 border-t border-[#EBCDD5] pt-4 text-left text-[#34221D]"
    >
      <HeartIcon className="size-[18px] shrink-0 mt-0.5 text-[#B83F67]" aria-hidden />
      <div className="min-w-0">
        <p className="font-body text-xs font-semibold text-[#B83F67]">
          Puppy love, shared forward
        </p>
        <p className="mt-1 font-body text-sm leading-relaxed text-[#66514A] [text-wrap:pretty]">
          Your visit helps, too. <strong className="font-semibold text-[#34221D]">$0.50 from every eligible paid public-class ticket</strong> supports local dogs in need.
        </p>
      </div>
    </aside>
  );
}
