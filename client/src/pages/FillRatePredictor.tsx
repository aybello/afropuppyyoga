// AfroPuppyYoga — Fill Rate Predictor
// Design: Clean operational tool, teal/coral palette, data-forward layout
// Purpose: Internal tool for Ay to predict class fill rates before booking

import { useState, useEffect } from "react";

const MODEL_URL =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663446228701/TnRBecMtwf5qQkTJcvZpfJ/apy_model_data_516a7c87.json";

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

interface BreedStat {
  breed: string;
  avg_tickets: number;
  avg_fill_rate: number;
  sessions: number;
  std_tickets: number;
  total_revenue: number;
  avg_revenue_per_session: number;
}

interface LocationStat {
  location: string;
  avg_tickets: number;
  sessions: number;
  fill_rate: number;
}

interface MonthStat {
  month: number;
  month_name: string;
  avg_tickets: number;
  fill_rate: number;
  multiplier: number;
  sessions: number;
}

interface BreedLocationStat {
  breed: string;
  location: string;
  avg_tickets: number;
  std_tickets: number;
  sessions: number;
  fill_rate: number;
}

interface ModelData {
  breed_stats: BreedStat[];
  location_stats: LocationStat[];
  month_stats: MonthStat[];
  breed_location_matrix: BreedLocationStat[];
  all_breeds: string[];
  all_locations: string[];
  capacity: number;
  overall_avg_tickets: number;
  total_sessions_analyzed: number;
  date_range: string;
}

interface Prediction {
  predicted_tickets: number;
  low: number;
  high: number;
  fill_rate: number;
  recommendation: string;
  tier: "hot" | "high" | "solid" | "moderate" | "low";
  data_points: number;
  revenue_estimate: number;
  revenue_low: number;
  revenue_high: number;
}

function predict(
  model: ModelData,
  breed: string,
  location: string,
  month: number
): Prediction {
  const CAPACITY = model.capacity;
  const overallAvg = model.overall_avg_tickets;

  const blData = model.breed_location_matrix.find(
    (r) => r.breed === breed && r.location === location
  );
  const bData = model.breed_stats.find((r) => r.breed === breed);
  const locData = model.location_stats.find((r) => r.location === location);
  const mData = model.month_stats.find((r) => r.month === month);

  const locMultiplier = locData ? locData.avg_tickets / overallAvg : 1.0;
  const monthMultiplier = mData ? mData.multiplier : 1.0;

  let base: number;
  let std: number;
  let n: number;

  if (blData && blData.sessions >= 2) {
    base = blData.avg_tickets;
    std = blData.std_tickets || 2.0;
    n = blData.sessions;
  } else if (bData) {
    base = bData.avg_tickets * locMultiplier;
    std = bData.std_tickets || 2.0;
    n = bData.sessions;
  } else {
    base = overallAvg * locMultiplier;
    std = 4.0;
    n = 1;
  }

  let prediction = base * monthMultiplier;
  prediction = Math.min(prediction, CAPACITY);

  const uncertainty = Math.max(1.5, (std / Math.sqrt(Math.max(n, 1))) * 1.5);
  const low = Math.max(1, Math.round(prediction - uncertainty));
  const high = Math.min(CAPACITY, Math.round(prediction + uncertainty));
  const point = Math.round(prediction);
  const fillRate = (prediction / CAPACITY) * 100;

  // Revenue estimate (avg ticket ~$118.70)
  const avgTicket = 118.7;
  const revenueEst = point * avgTicket * 4; // 4 class slots per day
  const revLow = low * avgTicket * 4;
  const revHigh = high * avgTicket * 4;

  let recommendation: string;
  let tier: Prediction["tier"];

  if (fillRate >= 80) {
    recommendation = "Sell out expected — run 4 classes and open a waitlist";
    tier = "hot";
  } else if (fillRate >= 65) {
    recommendation = "High demand — 4 classes recommended, promote 2 weeks out";
    tier = "high";
  } else if (fillRate >= 50) {
    recommendation = "Solid — 4 classes viable, light promotion needed";
    tier = "solid";
  } else if (fillRate >= 35) {
    recommendation = "Moderate — run 3 classes, promote aggressively";
    tier = "moderate";
  } else {
    recommendation = "Low demand — run 3 classes or consider a breed swap";
    tier = "low";
  }

  return {
    predicted_tickets: point,
    low,
    high,
    fill_rate: Math.round(fillRate * 10) / 10,
    recommendation,
    tier,
    data_points: n,
    revenue_estimate: Math.round(revenueEst),
    revenue_low: Math.round(revLow),
    revenue_high: Math.round(revHigh),
  };
}

const TIER_CONFIG = {
  hot: {
    bg: "bg-emerald-50",
    border: "border-emerald-400",
    badge: "bg-emerald-500 text-white",
    bar: "bg-emerald-500",
    label: "SELL OUT",
    icon: "🔥",
  },
  high: {
    bg: "bg-teal-50",
    border: "border-teal-400",
    badge: "bg-teal-500 text-white",
    bar: "bg-teal-500",
    label: "HIGH",
    icon: "✦",
  },
  solid: {
    bg: "bg-sky-50",
    border: "border-sky-400",
    badge: "bg-sky-500 text-white",
    bar: "bg-sky-500",
    label: "SOLID",
    icon: "◆",
  },
  moderate: {
    bg: "bg-amber-50",
    border: "border-amber-400",
    badge: "bg-amber-500 text-white",
    bar: "bg-amber-500",
    label: "MODERATE",
    icon: "▲",
  },
  low: {
    bg: "bg-red-50",
    border: "border-red-300",
    badge: "bg-red-500 text-white",
    bar: "bg-red-400",
    label: "LOW",
    icon: "●",
  },
};

export default function FillRatePredictor() {
  const [model, setModel] = useState<ModelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [breed, setBreed] = useState("");
  const [location, setLocation] = useState("Kitchener");
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [activeTab, setActiveTab] = useState<"predict" | "rankings">("predict");

  useEffect(() => {
    fetch(MODEL_URL)
      .then((r) => r.json())
      .then((data: ModelData) => {
        setModel(data);
        setBreed(data.all_breeds[0] || "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (model && breed && location && month) {
      setPrediction(predict(model, breed, location, month));
    }
  }, [model, breed, location, month]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-[#2D9B8A] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 font-medium">Loading model data...</p>
        </div>
      </div>
    );
  }

  if (!model) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <p className="text-red-500">Failed to load model data.</p>
      </div>
    );
  }

  const tierCfg = prediction ? TIER_CONFIG[prediction.tier] : null;

  // Top breeds for rankings tab
  const topBreeds = [...model.breed_stats]
    .filter((b) => b.sessions >= 2)
    .sort((a, b) => b.avg_tickets - a.avg_tickets);

  const monthData = [...model.month_stats].sort((a, b) => {
    const order = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8];
    return order.indexOf(a.month) - order.indexOf(b.month);
  });

  return (
    <div className="min-h-screen bg-[#FAFAF8] font-sans">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              APY Fill Rate Predictor
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {model.total_sessions_analyzed} sessions analyzed &middot;{" "}
              {model.date_range}
            </p>
          </div>
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab("predict")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeTab === "predict"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Predict
            </button>
            <button
              onClick={() => setActiveTab("rankings")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeTab === "rankings"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Rankings
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {activeTab === "predict" && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Input Panel */}
            <div className="lg:col-span-2 space-y-5">
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-5">
                  Class Details
                </h2>

                <div className="space-y-4">
                  {/* Breed */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Breed
                    </label>
                    <select
                      value={breed}
                      onChange={(e) => setBreed(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D9B8A] focus:border-transparent"
                    >
                      {model.all_breeds.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Location */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Location
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {model.all_locations.map((loc) => (
                        <button
                          key={loc}
                          onClick={() => setLocation(loc)}
                          className={`py-2.5 rounded-xl text-sm font-medium transition-all border ${
                            location === loc
                              ? "bg-[#2D9B8A] text-white border-[#2D9B8A]"
                              : "bg-slate-50 text-slate-600 border-slate-200 hover:border-[#2D9B8A] hover:text-[#2D9B8A]"
                          }`}
                        >
                          {loc}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Month */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Month
                    </label>
                    <select
                      value={month}
                      onChange={(e) => setMonth(Number(e.target.value))}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D9B8A] focus:border-transparent"
                    >
                      {MONTHS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Monthly Seasonality Mini Chart */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
                  Seasonal Pattern
                </h3>
                <div className="flex items-end gap-1 h-16">
                  {monthData.map((m) => {
                    const isSelected = m.month === month;
                    const height = Math.max(4, (m.fill_rate / 100) * 64);
                    return (
                      <button
                        key={m.month}
                        onClick={() => setMonth(m.month)}
                        className="flex-1 flex flex-col items-center gap-1 group"
                        title={`${m.month_name}: ${m.fill_rate.toFixed(0)}% fill`}
                      >
                        <div
                          className={`w-full rounded-sm transition-all ${
                            isSelected
                              ? "bg-[#2D9B8A]"
                              : m.fill_rate >= 80
                              ? "bg-emerald-400 group-hover:bg-emerald-500"
                              : m.fill_rate >= 50
                              ? "bg-teal-300 group-hover:bg-teal-400"
                              : "bg-amber-300 group-hover:bg-amber-400"
                          }`}
                          style={{ height: `${height}px` }}
                        />
                        <span
                          className={`text-[9px] font-medium ${
                            isSelected ? "text-[#2D9B8A]" : "text-slate-400"
                          }`}
                        >
                          {m.month_name.slice(0, 1)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Prediction Result */}
            <div className="lg:col-span-3">
              {prediction && tierCfg ? (
                <div
                  className={`rounded-2xl border-2 ${tierCfg.border} ${tierCfg.bg} p-7 shadow-sm`}
                >
                  {/* Tier Badge */}
                  <div className="flex items-center justify-between mb-6">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wider ${tierCfg.badge}`}
                    >
                      <span>{tierCfg.icon}</span>
                      {tierCfg.label}
                    </span>
                    <span className="text-xs text-slate-400">
                      Based on {prediction.data_points} historical session
                      {prediction.data_points !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Main Number */}
                  <div className="text-center mb-6">
                    <div className="text-7xl font-black text-slate-900 leading-none">
                      {prediction.predicted_tickets}
                    </div>
                    <div className="text-slate-500 text-sm mt-1">
                      tickets predicted
                    </div>
                    <div className="text-slate-400 text-xs mt-0.5">
                      range: {prediction.low} – {prediction.high} tickets
                    </div>
                  </div>

                  {/* Fill Rate Bar */}
                  <div className="mb-6">
                    <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                      <span>Fill Rate</span>
                      <span className="font-bold text-slate-700">
                        {prediction.fill_rate}%
                      </span>
                    </div>
                    <div className="h-3 bg-white rounded-full border border-slate-200 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${tierCfg.bar}`}
                        style={{
                          width: `${Math.min(100, prediction.fill_rate)}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                      <span>0</span>
                      <span>50%</span>
                      <span>100% (20 tickets)</span>
                    </div>
                  </div>

                  {/* Recommendation */}
                  <div className="bg-white rounded-xl p-4 mb-5 border border-slate-100">
                    <p className="text-sm font-medium text-slate-700">
                      {prediction.recommendation}
                    </p>
                  </div>

                  {/* Revenue Estimate */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white rounded-xl p-3 text-center border border-slate-100">
                      <div className="text-xs text-slate-400 mb-1">
                        Low Est.
                      </div>
                      <div className="text-base font-bold text-slate-700">
                        ${prediction.revenue_low.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-white rounded-xl p-3 text-center border border-slate-200 shadow-sm">
                      <div className="text-xs text-slate-400 mb-1">
                        Day Revenue
                      </div>
                      <div className="text-base font-bold text-[#2D9B8A]">
                        ${prediction.revenue_estimate.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-white rounded-xl p-3 text-center border border-slate-100">
                      <div className="text-xs text-slate-400 mb-1">
                        High Est.
                      </div>
                      <div className="text-base font-bold text-slate-700">
                        ${prediction.revenue_high.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 text-center mt-3">
                    Revenue estimate = predicted tickets × $118.70 avg × 4
                    class slots
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
                  <p className="text-slate-400">
                    Select breed, location, and month to see prediction
                  </p>
                </div>
              )}

              {/* Quick Breed Comparison */}
              {model && breed && (
                <div className="mt-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
                    {breed} — Historical Performance
                  </h3>
                  <div className="space-y-2">
                    {model.breed_location_matrix
                      .filter((r) => r.breed === breed)
                      .sort((a, b) => b.avg_tickets - a.avg_tickets)
                      .map((r) => (
                        <div key={r.location} className="flex items-center gap-3">
                          <span className="text-sm text-slate-600 w-28 shrink-0">
                            {r.location}
                          </span>
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#2D9B8A] rounded-full"
                              style={{
                                width: `${Math.min(
                                  100,
                                  (r.avg_tickets / 20) * 100
                                )}%`,
                              }}
                            />
                          </div>
                          <span className="text-sm font-medium text-slate-700 w-20 text-right shrink-0">
                            {r.avg_tickets.toFixed(1)} avg{" "}
                            <span className="text-slate-400 text-xs">
                              (n={r.sessions})
                            </span>
                          </span>
                        </div>
                      ))}
                    {model.breed_location_matrix.filter((r) => r.breed === breed)
                      .length === 0 && (
                      <p className="text-sm text-slate-400">
                        No historical data for this breed yet.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "rankings" && (
          <div className="space-y-6">
            {/* Breed Rankings Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="font-semibold text-slate-900">
                  Breed Performance Rankings
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  All locations combined, sorted by avg tickets per session
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
                      <th className="px-6 py-3 text-left">#</th>
                      <th className="px-6 py-3 text-left">Breed</th>
                      <th className="px-4 py-3 text-center">Avg Tickets</th>
                      <th className="px-4 py-3 text-center">Fill Rate</th>
                      <th className="px-4 py-3 text-center">Sessions</th>
                      <th className="px-4 py-3 text-center">Avg Revenue</th>
                      <th className="px-6 py-3 text-left">Trend</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {topBreeds.map((b, i) => {
                      const fr = b.avg_fill_rate;
                      const tier =
                        fr >= 80
                          ? "hot"
                          : fr >= 60
                          ? "high"
                          : fr >= 40
                          ? "solid"
                          : fr >= 25
                          ? "moderate"
                          : "low";
                      const cfg = TIER_CONFIG[tier];
                      return (
                        <tr
                          key={b.breed}
                          className="hover:bg-slate-50 transition-colors cursor-pointer"
                          onClick={() => {
                            setBreed(b.breed);
                            setActiveTab("predict");
                          }}
                        >
                          <td className="px-6 py-3 text-sm text-slate-400 font-medium">
                            {i + 1}
                          </td>
                          <td className="px-6 py-3">
                            <span className="text-sm font-medium text-slate-900">
                              {b.breed}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-sm font-bold text-slate-700">
                              {b.avg_tickets.toFixed(1)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${cfg.badge}`}
                            >
                              {fr.toFixed(0)}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-slate-500">
                            {b.sessions}
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-slate-600">
                            ${b.avg_revenue_per_session?.toLocaleString() || "—"}
                          </td>
                          <td className="px-6 py-3">
                            <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${cfg.bar}`}
                                style={{ width: `${Math.min(100, fr)}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Monthly Seasonality */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h2 className="font-semibold text-slate-900 mb-1">
                Monthly Seasonality
              </h2>
              <p className="text-xs text-slate-400 mb-5">
                Average fill rate by month across all breeds and locations
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {monthData.map((m) => {
                  const fr = m.fill_rate || 0;
                  const tier =
                    fr >= 80
                      ? "hot"
                      : fr >= 60
                      ? "high"
                      : fr >= 40
                      ? "solid"
                      : "low";
                  const cfg = TIER_CONFIG[tier];
                  return (
                    <div
                      key={m.month}
                      className={`rounded-xl p-4 border ${cfg.border} ${cfg.bg}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-sm font-semibold text-slate-700">
                          {m.month_name}
                        </span>
                        <span
                          className={`text-xs font-bold px-1.5 py-0.5 rounded ${cfg.badge}`}
                        >
                          {fr.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-white rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${cfg.bar}`}
                          style={{ width: `${Math.min(100, fr)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1.5">
                        {m.sessions} session{m.sessions !== 1 ? "s" : ""} ·{" "}
                        {m.avg_tickets.toFixed(1)} avg tickets
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
