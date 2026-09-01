import { HeartHandshake, PawPrint } from "lucide-react";

export default function LocalDogsImpact() {
  return (
    <section
      aria-labelledby="local-dogs-impact-heading"
      className="border-y border-[#F0D0DC] bg-[#FFF5F8]"
    >
      <div className="container py-14 md:py-18">
        <div className="grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:gap-14">
          <div className="max-w-3xl">
            <div className="mb-4 flex items-center gap-2 text-[#8B2252]">
              <PawPrint size={18} aria-hidden="true" />
              <span className="font-body text-xs font-bold tracking-[0.16em] uppercase">
                Puppy Love, Shared Forward
              </span>
            </div>
            <h2
              id="local-dogs-impact-heading"
              className="font-display text-3xl font-bold leading-tight text-[#1A0A12] md:text-4xl"
            >
              Every class gives a little love back.
            </h2>
            <p className="mt-4 max-w-2xl font-body text-base leading-relaxed text-[#4A2635] md:text-lg">
              During our current three-month pilot, AfroPuppyYoga contributes{" "}
              <strong className="font-bold text-[#8B2252]">
                $0.50 from every eligible paid, non-refunded public-class ticket
              </strong>{" "}
              to support local dogs in need.
            </p>
          </div>

          <div className="flex size-20 shrink-0 items-center justify-center rounded-full bg-[#8B2252] shadow-[0_14px_32px_rgba(139,34,82,0.22)] md:size-24">
            <HeartHandshake className="size-9 text-[#FFF5F8] md:size-11" aria-hidden="true" />
          </div>
        </div>
      </div>
    </section>
  );
}
