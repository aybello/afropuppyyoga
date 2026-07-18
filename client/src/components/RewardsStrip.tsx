/**
 * RewardsStrip — a thin full-width callout that teases the loyalty program
 * Sits immediately below the Hero section so it's the first thing people see after the hero
 */
import { Sparkles } from "lucide-react";

export default function RewardsStrip() {
  const scrollToRewards = () => {
    const el = document.getElementById("loyalty");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div
      className="w-full py-3 px-4 flex items-center justify-center gap-3 cursor-pointer"
      style={{ background: "linear-gradient(90deg, #fce7f3 0%, #fdf2f8 50%, #fce7f3 100%)", borderBottom: "1px solid #f9a8d4" }}
      onClick={scrollToRewards}
    >
      <Sparkles size={16} style={{ color: "#8B2252" }} />
      <p className="text-sm font-semibold text-center" style={{ color: "#8B2252" }}>
        🐾 <span style={{ color: "#8B2252" }}>Earn rewards</span> with every class —{" "}
        <span
          className="underline underline-offset-2"
          style={{ color: "#8B2252" }}
        >
          Join the loyalty program
        </span>
      </p>
      <Sparkles size={16} style={{ color: "#8B2252" }} />
    </div>
  );
}
