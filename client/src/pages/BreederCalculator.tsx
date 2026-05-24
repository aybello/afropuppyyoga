// AfroPuppyYoga — Breeder Compensation Calculator
// Design: Clean operational tool matching FillRatePredictor style (teal/coral palette)
// Purpose: Internal tool to calculate fair breeder pay based on breed demand, puppies, distance, reliability

import { useState, useMemo } from "react";

// ─── Breed demand data (based on APY class fill rate data) ───────────────────
const BREEDS = [
  { name: "Golden Retriever", demand: "high" },
  { name: "Labrador Retriever", demand: "high" },
  { name: "Goldendoodle", demand: "high" },
  { name: "Bernedoodle", demand: "high" },
  { name: "Cavapoo", demand: "high" },
  { name: "Poodle (Toy/Mini)", demand: "high" },
  { name: "Bichon Frise", demand: "medium" },
  { name: "Shih Tzu", demand: "medium" },
  { name: "Maltese", demand: "medium" },
  { name: "Pomeranian", demand: "medium" },
  { name: "Havanese", demand: "medium" },
  { name: "Cocker Spaniel", demand: "medium" },
  { name: "Beagle", demand: "medium" },
  { name: "Corgi", demand: "medium" },
  { name: "Dachshund", demand: "medium" },
  { name: "French Bulldog", demand: "high" },
  { name: "Bulldog (English)", demand: "medium" },
  { name: "Boxer", demand: "low" },
  { name: "Doberman", demand: "low" },
  { name: "Rottweiler", demand: "low" },
  { name: "German Shepherd", demand: "medium" },
  { name: "Husky", demand: "medium" },
  { name: "Pincher (Miniature)", demand: "medium" },
  { name: "Other / Rare Breed", demand: "rare" },
];

// ─── Multiplier config ────────────────────────────────────────────────────────
// Base pay: $450 (floor). Max target: $700 (rare breed + far distance + many puppies)
const BASE_PAY = 450;

const DEMAND_MULTIPLIERS: Record<string, { mult: number; label: string; color: string }> = {
  rare:   { mult: 1.30, label: "Rare / Exotic",  color: "#7c3aed" },
  high:   { mult: 1.15, label: "High Demand",     color: "#059669" },
  medium: { mult: 1.00, label: "Medium Demand",   color: "#0284c7" },
  low:    { mult: 0.90, label: "Lower Demand",    color: "#64748b" },
};

const DISTANCE_BRACKETS = [
  { label: "0 – 15 km",  max: 15,  mult: 1.00 },
  { label: "16 – 30 km", max: 30,  mult: 1.07 },
  { label: "31 – 50 km", max: 50,  mult: 1.15 },
  { label: "51 – 75 km", max: 75,  mult: 1.22 },
  { label: "75+ km",     max: 999, mult: 1.30 },
];

const PUPPY_MULTIPLIERS = [
  { count: 5,  label: "5 — below minimum", mult: 0.90 },
  { count: 6,  label: "6 — good",         mult: 0.97 },
  { count: 7,  label: "7 — good",          mult: 0.98 },
  { count: 8,  label: "8 — ideal",         mult: 1.00 },
  { count: 9,  label: "9 — great",         mult: 1.04 },
  { count: 10, label: "10+ — excellent",   mult: 1.07 },
];

const RELIABILITY_MULTIPLIERS = [
  { key: "excellent", label: "Excellent — never cancelled, always on time", mult: 1.08 },
  { key: "good",      label: "Good — reliable, minor lateness once",        mult: 1.00 },
  { key: "fair",      label: "Fair — cancelled once or occasionally late",  mult: 0.93 },
  { key: "poor",      label: "Poor — multiple cancellations / no-shows",    mult: 0.85 },
];

function fmt(n: number) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(n);
}

function getTierLabel(pay: number): { label: string; color: string; bg: string } {
  if (pay >= 660) return { label: "Premium",  color: "#7c3aed", bg: "#f5f3ff" };
  if (pay >= 580) return { label: "High",     color: "#059669", bg: "#ecfdf5" };
  if (pay >= 510) return { label: "Standard", color: "#0284c7", bg: "#eff6ff" };
  return              { label: "Base",      color: "#64748b", bg: "#f8fafc" };
}

export default function BreederCalculator() {
  const [breed, setBreed] = useState(BREEDS[0].name);
  const [distanceKm, setDistanceKm] = useState(15);
  const [puppyCount, setPuppyCount] = useState(8);
  const [reliability, setReliability] = useState("good");

  const result = useMemo(() => {
    const breedObj = BREEDS.find((b) => b.name === breed) ?? BREEDS[0];
    const demandMult = DEMAND_MULTIPLIERS[breedObj.demand].mult;

    const distBracket = DISTANCE_BRACKETS.find((d) => distanceKm <= d.max) ?? DISTANCE_BRACKETS[DISTANCE_BRACKETS.length - 1];
    const distMult = distBracket.mult;

    const puppyMult = (PUPPY_MULTIPLIERS.find((p) => p.count === Math.min(puppyCount, 10)) ?? PUPPY_MULTIPLIERS[1]).mult;
    const relMult = RELIABILITY_MULTIPLIERS.find((r) => r.key === reliability)?.mult ?? 1.0;

    const raw = BASE_PAY * demandMult * distMult * puppyMult * relMult;
    // Clamp to $450–$700
    const pay = Math.round(Math.min(700, Math.max(450, raw)) / 5) * 5;

    const breakdown = [
      { label: "Base rate",         value: fmt(BASE_PAY),                   mult: null },
      { label: "Breed demand",      value: `×${demandMult.toFixed(2)}`,      mult: demandMult },
      { label: "Distance",          value: `×${distMult.toFixed(2)}`,        mult: distMult },
      { label: "Puppies brought",   value: `×${puppyMult.toFixed(2)}`,       mult: puppyMult },
      { label: "Breeder reliability", value: `×${relMult.toFixed(2)}`,       mult: relMult },
    ];

    return { pay, breakdown, demandInfo: DEMAND_MULTIPLIERS[breedObj.demand], distBracket };
  }, [breed, distanceKm, puppyCount, reliability]);

  const tier = getTierLabel(result.pay);
  const barPct = Math.round(((result.pay - 450) / (700 - 450)) * 100);

  return (
    <div className="min-h-screen bg-[#FEFAF4] font-sans">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              🐶 Breeder Pay Calculator
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              AfroPuppyYoga · Internal tool · Recommended pay range: CA$450 – CA$700
            </p>
          </div>
          <a
            href="/predictor"
            className="text-sm text-[#8B2252] font-medium hover:underline hidden sm:block"
          >
            ← Fill Rate Predictor
          </a>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* ── LEFT: Inputs ── */}
        <div className="flex flex-col gap-5">

          {/* Breed */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
              Breed
            </label>
            <select
              value={breed}
              onChange={(e) => setBreed(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#8B2252]"
            >
              {BREEDS.map((b) => (
                <option key={b.name} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
            <div className="mt-2 flex items-center gap-2">
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: tier.bg, color: result.demandInfo.color }}
              >
                {result.demandInfo.label}
              </span>
              <span className="text-xs text-slate-400">demand tier</span>
            </div>
          </div>

          {/* Distance */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
              Distance from Studio
            </label>
            <p className="text-xs text-slate-400 mb-3">Approximate one-way driving distance</p>
            <div className="flex items-center gap-3 mb-2">
              <input
                type="range"
                min={1}
                max={120}
                value={distanceKm}
                onChange={(e) => setDistanceKm(Number(e.target.value))}
                className="flex-1 accent-[#8B2252]"
              />
              <span className="text-sm font-bold text-slate-800 w-16 text-right">
                {distanceKm} km
              </span>
            </div>
            <div className="flex gap-1 flex-wrap">
              {DISTANCE_BRACKETS.map((d) => (
                <button
                  key={d.label}
                  onClick={() => setDistanceKm(d.max === 999 ? 90 : Math.round(d.max * 0.7))}
                  className={`text-xs px-2 py-1 rounded-lg border transition-all ${
                    result.distBracket.label === d.label
                      ? "bg-[#8B2252] text-white border-[#8B2252]"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:border-[#8B2252]"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Puppies */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
              Number of Puppies Brought
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PUPPY_MULTIPLIERS.map((p) => (
                <button
                  key={p.count}
                  onClick={() => setPuppyCount(p.count)}
                  className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${
                    puppyCount === p.count
                      ? "bg-[#8B2252] text-white border-[#8B2252] shadow-sm"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:border-[#8B2252]"
                  }`}
                >
                  <span className="block">{p.count === 10 ? "10+" : p.count}</span>
                  <span className="block text-[9px] opacity-70 leading-tight">{p.label.split(" — ")[1]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Reliability */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
              Breeder Reliability
            </label>
            <div className="flex flex-col gap-2">
              {RELIABILITY_MULTIPLIERS.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setReliability(r.key)}
                  className={`text-left px-3 py-2.5 rounded-xl border text-sm transition-all ${
                    reliability === r.key
                      ? "bg-[#8B2252] text-white border-[#8B2252]"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:border-[#8B2252]"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT: Result ── */}
        <div className="flex flex-col gap-5">

          {/* Pay output */}
          <div
            className="rounded-2xl border-2 p-6 shadow-sm"
            style={{ background: tier.bg, borderColor: tier.color }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: tier.color }}>
                Recommended Pay
              </span>
              <span
                className="text-xs font-bold px-2.5 py-1 rounded-full text-white"
                style={{ background: tier.color }}
              >
                {tier.label}
              </span>
            </div>
            <div className="text-5xl font-black text-slate-900 mt-2 mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>
              {fmt(result.pay)}
            </div>
            <p className="text-xs text-slate-500">per session · all-in</p>

            {/* Bar */}
            <div className="mt-4">
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>CA$450</span>
                <span>CA$700</span>
              </div>
              <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${barPct}%`, background: tier.color }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1 text-right">{barPct}% of max</p>
            </div>
          </div>

          {/* Breakdown */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">
              Pay Breakdown
            </h3>
            <div className="flex flex-col gap-2">
              {result.breakdown.map((row, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">{row.label}</span>
                  <span
                    className={`text-sm font-bold ${
                      row.mult === null
                        ? "text-slate-800"
                        : row.mult > 1
                        ? "text-emerald-600"
                        : row.mult < 1
                        ? "text-red-500"
                        : "text-slate-500"
                    }`}
                  >
                    {row.value}
                  </span>
                </div>
              ))}
              <div className="border-t border-slate-100 mt-2 pt-2 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-800">Recommended Pay</span>
                <span className="text-sm font-black text-slate-900">{fmt(result.pay)}</span>
              </div>
            </div>
          </div>

          {/* Quick reference */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
              Pay Range Reference
            </h3>
            <div className="flex flex-col gap-1.5">
              {[
                { range: "CA$660 – CA$700", desc: "Rare breed + far distance", color: "#7c3aed" },
                { range: "CA$580 – CA$655", desc: "High demand + 3+ puppies", color: "#059669" },
                { range: "CA$510 – CA$575", desc: "Standard session",          color: "#0284c7" },
                { range: "CA$450 – CA$505", desc: "Low demand + close by",     color: "#64748b" },
              ].map((r) => (
                <div key={r.range} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: r.color }} />
                  <span className="text-xs font-bold" style={{ color: r.color }}>{r.range}</span>
                  <span className="text-xs text-slate-400">— {r.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-xs text-amber-700 font-medium leading-relaxed">
              <strong>Note:</strong> This is a recommended starting point. You can always adjust ±$25 based on your relationship with the breeder or special circumstances. Final pay is always your call.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
