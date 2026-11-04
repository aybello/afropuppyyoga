/**
 * RewardsStrip — a thin full-width callout that teases the loyalty program
 * Sits immediately below the Hero section so it's the first thing people see after the hero
 */
import { SparkleIcon } from "@/components/PublicIcons";

export default function RewardsStrip() {
  const scrollToRewards = () => {
    const el = document.getElementById("loyalty");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div
      className="w-full py-3 px-4 flex items-center justify-center gap-3 cursor-pointer"
      style={{ background: "#FDE9EF", borderBottom: "1px solid #F29CB8" }}
      onClick={scrollToRewards}
    >
      <SparkleIcon size={16} style={{ color: "#B52F5A" }} aria-hidden />
      <p className="text-sm font-semibold text-center" style={{ color: "#34221D" }}>
        🐾 <span style={{ color: "#B52F5A" }}>Earn rewards</span> with every class —{" "}
        <span
          className="underline underline-offset-2"
          style={{ color: "#B52F5A" }}
        >
          Join the loyalty program
        </span>
      </p>
      <SparkleIcon size={16} style={{ color: "#B52F5A" }} aria-hidden />
    </div>
  );
}
