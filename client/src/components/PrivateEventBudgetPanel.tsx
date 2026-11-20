import { Calculator } from "lucide-react";
import {
  estimatePrivateEventBudget,
  privateEventBudgetRange,
} from "@shared/privateEventBudget";
import {
  PRIVATE_EVENT_EXPERIENCES,
  PRIVATE_EVENT_SCHEDULES,
  PRIVATE_EVENT_VENUES,
  type PrivateEventPreferences,
} from "@shared/privateEventExperience";
import type { PrivateEventPackageType } from "@shared/privateEventPricing";

type PrivateEventBudgetPanelProps = {
  guests: number;
  packageType: PrivateEventPackageType;
  eventPreferences: PrivateEventPreferences;
};

const centsFormatter = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function centsRange(min: number, max: number): string {
  const low = centsFormatter.format(min / 100);
  return min === max ? low : `${low}–${centsFormatter.format(max / 100)}`;
}

function positiveInteger(value: number | undefined): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export function PrivateEventBudgetPanel({
  guests,
  packageType,
  eventPreferences,
}: PrivateEventBudgetPanelProps) {
  // This descriptive budget is deliberately independent of inquiry/contact gates.
  // The original package estimator remains authoritative for the inquiry payload.
  const budget = estimatePrivateEventBudget({ guests, packageType, eventPreferences });
  const packagePreference = eventPreferences.packagePreference;
  const packageLabel = packagePreference === "help_me_choose"
    ? "Help me choose"
    : packagePreference.charAt(0).toUpperCase() + packagePreference.slice(1);
  const hasEstimate = budget.kind === "estimate" && budget.min !== null && budget.max !== null;
  const range = hasEstimate ? privateEventBudgetRange(budget.min!, budget.max!) : "";
  const resultTitle = hasEstimate
    ? budget.coreOnly ? "Core experience estimate" : "Planning estimate"
    : budget.kind === "manual" ? "Review needed" : "Complete your event details";
  const guidance = budget.reason || (budget.kind === "manual"
    ? "We’ll review your event format and prepare a tailored planning range."
    : "Add total attendance, duration and any required session or simultaneous-attendance details above.");
  const announcement = hasEstimate
    ? `${resultTitle}: ${range} CAD before HST. ${budget.coreOnly ? "Package upgrades excluded. " : ""}Travel and separately quoted extras excluded. Final quote approval required.`
    : `${resultTitle}. ${guidance}`;
  const summary = [
    {
      label: "Total attendance",
      value: positiveInteger(guests) ? `${guests} ${guests === 1 ? "guest" : "guests"}` : "Needed",
    },
    {
      label: eventPreferences.schedule === "drop_in" ? "Lounge operating time" : "Full event window",
      value: positiveInteger(eventPreferences.durationMinutes) ? `${eventPreferences.durationMinutes} minutes` : "Needed",
    },
    ...(eventPreferences.schedule === "multiple" ? [
      { label: "Scheduled sessions", value: positiveInteger(eventPreferences.sessionCount) ? String(eventPreferences.sessionCount) : "Needed" },
      { label: "Guests per session", value: positiveInteger(eventPreferences.guestsPerSession) ? String(eventPreferences.guestsPerSession) : "Needed" },
    ] : eventPreferences.schedule === "drop_in" ? [
      { label: "Guests at once", value: positiveInteger(eventPreferences.concurrentGuests) ? String(eventPreferences.concurrentGuests) : "Needed" },
    ] : [
      { label: "Scheduled sessions", value: "1" },
    ]),
  ];

  return (
    <section
      aria-labelledby="private-event-budget-title"
      data-budget-kind={budget.kind}
      className="min-w-0 rounded-2xl border border-[#F29CB8]/60 bg-[#FDE9EF] p-5 sm:p-7 text-[#34221D] font-body"
    >
      <div className="flex items-center gap-2 mb-5">
        <Calculator size={18} aria-hidden="true" focusable="false" className="shrink-0 text-[#AA365D]" />
        <h3 id="private-event-budget-title" className="text-sm font-semibold text-[#AA365D] uppercase tracking-wider">
          Live planning budget
        </h3>
      </div>

      {/* Announce only the concise result, not the full breakdown and scope. */}
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </p>

      {hasEstimate ? (
        <>
          <p className="text-sm font-semibold text-[#AA365D] mb-2">{resultTitle}</p>
          <p className="font-display text-[clamp(1.75rem,5vw,2.5rem)] leading-tight font-medium tabular-nums [overflow-wrap:anywhere]">
            {range}
          </p>
          <p className="text-sm text-[#34221D]/80 mt-1">CAD before HST · not a final quote</p>
          {budget.coreOnly && (
            <p className="mt-4 text-sm leading-relaxed text-[#34221D]/80">
              {packagePreference === "help_me_choose"
                ? "This estimates the core experience only, not a Classic package selection. We’ll help you choose a package; upgrades and extras are excluded."
                : packagePreference === "signature" || packagePreference === "luxury"
                  ? `This estimates the core experience only. Your selected ${packageLabel} upgrades are excluded and will be quoted separately.`
                  : "This estimates the core experience only. Package upgrades and extras are excluded and will be quoted separately."}
            </p>
          )}

          <dl className="mt-5 space-y-3 border-t border-[#AA365D]/20 pt-5 text-sm">
            {budget.lines.map((line, index) => (
              <div key={`${line.label}-${index}`} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <dt className="min-w-0 flex-1 basis-36 text-[#34221D]/80 [overflow-wrap:anywhere]">{line.label}</dt>
                <dd className="ml-auto tabular-nums font-medium">{privateEventBudgetRange(line.min, line.max)}</dd>
              </div>
            ))}
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-[#AA365D]/20 pt-3">
              <dt className="text-[#34221D]/80">Budget before HST</dt>
              <dd className="ml-auto tabular-nums font-medium">{range}</dd>
            </div>
            {budget.hstMinCents !== null && budget.hstMaxCents !== null && (
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <dt className="text-[#34221D]/80">HST (13%)</dt>
                <dd className="ml-auto tabular-nums font-medium">{centsRange(budget.hstMinCents, budget.hstMaxCents)}</dd>
              </div>
            )}
            {budget.totalMinCents !== null && budget.totalMaxCents !== null && (
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-[#AA365D]/20 pt-3 font-semibold">
                <dt>Subtotal incl. HST</dt>
                <dd className="ml-auto tabular-nums">{centsRange(budget.totalMinCents, budget.totalMaxCents)}</dd>
              </div>
            )}
          </dl>
          <p className="mt-2 text-xs leading-relaxed text-[#34221D]/80">
            Travel and any separately quoted extras are excluded from this subtotal. Their costs and any applicable HST will be confirmed separately.
          </p>
        </>
      ) : (
        <div>
          <p className="font-display text-2xl sm:text-3xl leading-tight font-medium [text-wrap:pretty]">{resultTitle}</p>
          <p className="mt-2 text-sm leading-relaxed text-[#34221D]/80">{guidance}</p>
          <p className="mt-3 text-sm text-[#34221D]/80">
            {budget.kind === "manual"
              ? "You can still send your event details for review. We won’t guess a price for this scope."
              : "Your planning budget updates here without contact details, an event type or a city."}
          </p>
        </div>
      )}

      <div className="mt-5 border-t border-[#AA365D]/20 pt-5 text-sm">
        <h4 className="font-semibold mb-2">Your event at a glance</h4>
        <p className="text-[#34221D]/80 leading-relaxed [text-wrap:pretty]">
          {PRIVATE_EVENT_EXPERIENCES[eventPreferences.experience].name} · {PRIVATE_EVENT_SCHEDULES[eventPreferences.schedule]} · {PRIVATE_EVENT_VENUES[eventPreferences.venue]}
        </p>
        <p className="mt-2 text-[#34221D]/80">Preferred package level: <span className="font-semibold">{packageLabel}</span></p>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
          {summary.map(item => (
            <div key={item.label} className="min-w-0">
              <dt className="text-xs leading-relaxed text-[#34221D]/80">{item.label}</dt>
              <dd className="mt-0.5 font-medium [overflow-wrap:anywhere]">{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {budget.notes.length > 0 && (
        <ul className="mt-4 space-y-2 text-sm text-[#34221D]/80 leading-relaxed list-disc pl-4">
          {budget.notes.map((note, index) => <li key={`${note}-${index}`}>{note}</li>)}
        </ul>
      )}
      {budget.exclusions.length > 0 && (
        <div className="mt-4 text-sm text-[#34221D]/80 leading-relaxed">
          <h4 className="font-semibold text-[#34221D]">Not included in this budget</h4>
          <ul className="mt-2 space-y-1 list-disc pl-4">
            {budget.exclusions.map((exclusion, index) => <li key={`${exclusion}-${index}`}>{exclusion}</li>)}
          </ul>
        </div>
      )}
      <p className="mt-5 border-t border-[#AA365D]/20 pt-4 text-sm leading-relaxed text-[#34221D]/80">
        Planning guidance only, not a booking or payable total. APY must review and approve your final scope and quote. Availability, capacity, session timing, room resets and puppy rest are not confirmed by this estimate.
      </p>
    </section>
  );
}
