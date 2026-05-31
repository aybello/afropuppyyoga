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
      style={{ background: "linear-gradient(90deg, #1a0a0f 0%, #3d0d22 50%, #1a0a0f 100%)" }}
      onClick={scrollToRewards}
    >
      <Sparkles size={16} style={{ color: "#f9a8d4" }} />
      <p className="text-sm font-semibold text-center" style={{ color: "#fff" }}>
        🐾 <span style={{ color: "#f9a8d4" }}>Earn rewards</span> with every class —{" "}
        <span
          className="underline underline-offset-2"
          style={{ color: "#f9a8d4" }}
        >
          Join the loyalty program
        </span>
      </p>
      <Sparkles size={16} style={{ color: "#f9a8d4" }} />
    </div>
  );
}
