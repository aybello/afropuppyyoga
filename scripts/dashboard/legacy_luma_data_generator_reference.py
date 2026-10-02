#!/usr/bin/env python3
"""Generate the AfroPuppyYoga Luma data module.

This generator always preserves the marker-delimited Instagram block in the
existing TypeScript module. It uses public Luma calendar data by default and
switches to matched Stripe CSV revenue only when an authenticated CSV export
is supplied as the optional third argument.

Usage:
  python3 json_to_ts.py <public_events.json> <lumaData.ts> [stripe_revenue.json]
"""
from __future__ import annotations

import json
import os
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

INSTA_MARKER_START = "// === INSTAGRAM_DATA_START ==="
INSTA_MARKER_END = "// === INSTAGRAM_DATA_END ==="
DEFAULT_AVG_TICKET_PRICE_CAD = 56.0

DEFAULT_INSTAGRAM_DATA = """// === INSTAGRAM_DATA_START ===
export const INSTAGRAM_DATA = {
  followers: 10000,
  avgLikes: 450,
  avgComments: 28,
  topPosts: [
    { description: "Bernedoodle puppy yoga session", likes: 892, comments: 45, date: "2026-05-15" },
    { description: "Golden Retriever class sold out", likes: 743, comments: 38, date: "2026-04-22" },
    { description: "Hamilton debut event", likes: 621, comments: 29, date: "2026-03-08" },
  ],
  trafficSources: [
    { source: "Instagram", percentage: 45 },
    { source: "Direct", percentage: 25 },
    { source: "Word of Mouth", percentage: 18 },
    { source: "Google", percentage: 8 },
    { source: "Other", percentage: 4 },
  ],
  monthlyFollowerGrowth: [
    { month: "Jan 2026", followers: 8200 },
    { month: "Feb 2026", followers: 8650 },
    { month: "Mar 2026", followers: 9100 },
    { month: "Apr 2026", followers: 9480 },
    { month: "May 2026", followers: 9820 },
    { month: "Jun 2026", followers: 10000 },
  ],
} as const;
// === INSTAGRAM_DATA_END"""


def ts_string(value: Any) -> str:
    """Return a safe TypeScript double-quoted string literal."""
    return json.dumps(str(value or ""), ensure_ascii=True)


def load_existing_instagram_section(ts_path: str) -> str:
    """Keep the Instagram content independent from Luma refreshes."""
    if not os.path.exists(ts_path):
        print("  No existing data module, using default Instagram section")
        return DEFAULT_INSTAGRAM_DATA

    content = Path(ts_path).read_text(encoding="utf-8")
    start = content.find(INSTA_MARKER_START)
    end = content.find(INSTA_MARKER_END)
    if start < 0 or end < 0:
        print("  Instagram markers not found, using default Instagram section")
        return DEFAULT_INSTAGRAM_DATA

    section = content[start : end + len(INSTA_MARKER_END)]
    print(f"  Preserved Instagram section ({len(section)} chars)")
    return section


def load_revenue(revenue_path: str | None) -> dict[str, dict[str, Any]]:
    """Load event-level revenue from the processed authenticated Stripe CSV."""
    if not revenue_path or not os.path.exists(revenue_path):
        return {}

    try:
        payload = json.loads(Path(revenue_path).read_text(encoding="utf-8"))
        by_id = {
            str(item.get("event_id")): item
            for item in payload.get("events", [])
            if item.get("event_id")
        }
        print(f"  Loaded Stripe revenue records: {len(by_id)}")
        return by_id
    except (OSError, ValueError, TypeError) as exc:
        print(f"  Warning: could not load Stripe revenue data: {exc}")
        return {}


def is_yoga_event(event: dict[str, Any]) -> bool:
    name = str(event.get("name", "")).lower()
    return all(excluded not in name for excluded in ("gift card", "private", "book a"))


def generate_ts(events_json_path: str, output_ts_path: str, revenue_json_path: str | None = None) -> dict[str, Any]:
    """Generate lumaData.ts and retain its Instagram marker block."""
    payload = json.loads(Path(events_json_path).read_text(encoding="utf-8"))
    all_events = payload.get("events", [])
    fetched_at = str(payload.get("fetched_at") or datetime.now(timezone.utc).isoformat())
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    yoga_events = [event for event in all_events if is_yoga_event(event)]
    past_events = [event for event in yoga_events if str(event.get("date", "")) <= today]
    future_events = [event for event in yoga_events if str(event.get("date", "")) > today]

    revenue_by_id = load_revenue(revenue_json_path)
    matched_revenue = {
        str(event.get("api_id")): revenue_by_id[str(event.get("api_id"))]
        for event in past_events
        if str(event.get("api_id")) in revenue_by_id
    }
    coverage = (len(matched_revenue) / len(past_events)) if past_events else 0.0
    use_actual_revenue = bool(revenue_by_id) and coverage >= 0.50

    if revenue_by_id and not use_actual_revenue:
        print(f"  Stripe match coverage {coverage:.0%} is below 50%; retaining public-data estimate")
    elif use_actual_revenue:
        print(f"  Using authenticated Stripe revenue for {len(matched_revenue)} / {len(past_events)} past events")
    else:
        print("  No authenticated Stripe revenue available; using CA$56/ticket estimate")

    def tickets_for(event: dict[str, Any]) -> int:
        matched = matched_revenue.get(str(event.get("api_id")))
        if use_actual_revenue and matched:
            return int(matched.get("tickets") or 0)
        return int(event.get("ticket_count") or 0)

    def revenue_for(event: dict[str, Any]) -> float:
        matched = matched_revenue.get(str(event.get("api_id")))
        if use_actual_revenue and matched:
            return round(float(matched.get("gross_cad") or 0.0), 2)
        return round(int(event.get("ticket_count") or 0) * DEFAULT_AVG_TICKET_PRICE_CAD, 2)

    total_tickets = sum(tickets_for(event) for event in past_events)
    total_guests = sum(int(event.get("guest_count") or 0) for event in past_events)
    total_revenue = round(sum(revenue_for(event) for event in past_events), 2)
    avg_tickets = total_tickets / len(past_events) if past_events else 0.0
    avg_ticket_price = (total_revenue / total_tickets) if use_actual_revenue and total_tickets else DEFAULT_AVG_TICKET_PRICE_CAD

    monthly: dict[str, dict[str, Any]] = defaultdict(
        lambda: {"events": 0, "tickets": 0, "guests": 0, "month_name": "", "revenue_cad": 0.0}
    )
    city_counts: Counter[str] = Counter()
    city_tickets: dict[str, int] = defaultdict(int)
    breed_counts: Counter[str] = Counter()
    breed_tickets: dict[str, int] = defaultdict(int)

    for event in past_events:
        month = str(event.get("month", ""))
        city = str(event.get("city") or "Other")
        breed = str(event.get("breed") or "Mixed Breeds")
        ticket_count = tickets_for(event)
        revenue = revenue_for(event)
        monthly[month]["events"] += 1
        monthly[month]["tickets"] += ticket_count
        monthly[month]["guests"] += int(event.get("guest_count") or 0)
        monthly[month]["month_name"] = str(event.get("month_name") or month)
        monthly[month]["revenue_cad"] += revenue
        city_counts[city] += 1
        city_tickets[city] += ticket_count
        breed_counts[breed] += 1
        breed_tickets[breed] += ticket_count

    instagram_section = load_existing_instagram_section(output_ts_path)
    source_name = "Luma Stripe sales CSV" if use_actual_revenue else "Luma public calendar API"
    source_note = "Actual gross revenue from authenticated Stripe CSV" if use_actual_revenue else "Estimated revenue: public ticket counts × CA$56 average ticket price"

    lines: list[str] = [
        f"// lumaData.ts — Auto-generated {fetched_at[:10]}",
        f"// Source: {source_name} (cal-Z474jeIbvUXskHE)",
        f"// Revenue basis: {source_note}",
        "// DO NOT EDIT Luma sections manually. The Instagram marker section is preserved across refreshes.",
        "",
        "// ============================================================",
        "// TYPES",
        "// ============================================================",
        "",
        "export interface LumaEvent {",
        "  api_id: string;",
        "  name: string;",
        "  date: string;",
        "  month: string;",
        "  month_name: string;",
        "  year: number;",
        "  city: string;",
        "  country: string;",
        "  breed: string;",
        "  is_free: boolean;",
        "  avg_price: number;",
        "  ticket_count: number;",
        "  guest_count: number;",
        "  revenue_cad: number;",
        "  status: string;",
        "  url: string;",
        "  cover_url: string;",
        "  start_at: string;",
        "}",
        "",
        "export interface MonthlyStat {",
        "  month: string;",
        "  month_name: string;",
        "  events: number;",
        "  tickets: number;",
        "  guests: number;",
        "  revenue_cad: number;",
        "}",
        "",
        "export interface LocationStat { city: string; events: number; tickets: number; }",
        "export interface BreedStat { breed: string; events: number; tickets: number; }",
        "",
        "// ============================================================",
        "// SUMMARY",
        "// ============================================================",
        "",
        "export const SUMMARY = {",
        f"  fetched_at: {ts_string(fetched_at[:10])},",
        f"  total_events: {len(yoga_events)},",
        f"  past_events: {len(past_events)},",
        f"  future_events: {len(future_events)},",
        f"  total_tickets: {total_tickets},",
        f"  total_guests: {total_guests},",
        f"  avg_tickets_per_class: {avg_tickets:.1f},",
        f"  avg_ticket_price_cad: {avg_ticket_price:.2f},",
        f"  total_revenue_cad: {total_revenue:.2f},",
        f"  revenue_is_estimated: {str(not use_actual_revenue).lower()},",
        f"  revenue_data_source: {ts_string('luma_stripe_csv' if use_actual_revenue else 'luma_public_api_estimate')},",
        f"  revenue_coverage_pct: {coverage * 100:.1f},",
        "  calendar_id: \"cal-Z474jeIbvUXskHE\",",
        "} as const;",
        "",
        "// ============================================================",
        "// MONTHLY DATA",
        "// ============================================================",
        "",
        "export const MONTHLY_DATA: MonthlyStat[] = [",
    ]

    for month in sorted(monthly):
        item = monthly[month]
        lines.append(
            "  { "
            f"month: {ts_string(month)}, month_name: {ts_string(item['month_name'])}, "
            f"events: {item['events']}, tickets: {item['tickets']}, guests: {item['guests']}, "
            f"revenue_cad: {item['revenue_cad']:.2f} "
            "},"
        )
    lines += [
        "];",
        "",
        "// ============================================================",
        "// LOCATION DATA",
        "// ============================================================",
        "",
        "export const LOCATION_DATA: LocationStat[] = [",
    ]
    for city, events in city_counts.most_common():
        lines.append(f"  {{ city: {ts_string(city)}, events: {events}, tickets: {city_tickets[city]} }},")
    lines += [
        "];",
        "",
        "// ============================================================",
        "// BREED DATA",
        "// ============================================================",
        "",
        "export const BREED_DATA: BreedStat[] = [",
    ]
    for breed, events in breed_counts.most_common(15):
        lines.append(f"  {{ breed: {ts_string(breed)}, events: {events}, tickets: {breed_tickets[breed]} }},")
    lines += [
        "];",
        "",
        "// ============================================================",
        "// RAW EVENTS (past yoga classes, most recent first)",
        "// ============================================================",
        "",
        "export const RAW_EVENTS: LumaEvent[] = [",
    ]

    def append_event(event: dict[str, Any]) -> None:
        lines.extend([
            "  {",
            f"    api_id: {ts_string(event.get('api_id'))},",
            f"    name: {ts_string(event.get('name'))},",
            f"    date: {ts_string(event.get('date'))},",
            f"    month: {ts_string(event.get('month'))},",
            f"    month_name: {ts_string(event.get('month_name'))},",
            f"    year: {int(event.get('year') or 0)},",
            f"    city: {ts_string(event.get('city') or 'Other')},",
            f"    country: {ts_string(event.get('country') or 'Canada')},",
            f"    breed: {ts_string(event.get('breed') or 'Mixed Breeds')},",
            f"    is_free: {str(bool(event.get('is_free'))).lower()},",
            f"    avg_price: {float(event.get('avg_price') or 0):.2f},",
            f"    ticket_count: {tickets_for(event)},",
            f"    guest_count: {int(event.get('guest_count') or 0)},",
            f"    revenue_cad: {revenue_for(event):.2f},",
            f"    status: {ts_string(event.get('status') or 'approved')},",
            f"    url: {ts_string('https://lu.ma/' + str(event.get('url') or '').lstrip('/'))},",
            f"    cover_url: {ts_string(event.get('cover_url'))},",
            f"    start_at: {ts_string(event.get('start_at'))},",
            "  },",
        ])

    for event in sorted(past_events, key=lambda item: str(item.get("date", "")), reverse=True):
        append_event(event)
    lines += [
        "];",
        "",
        "// ============================================================",
        "// UPCOMING EVENTS",
        "// ============================================================",
        "",
        "export const UPCOMING_EVENTS: LumaEvent[] = [",
    ]
    for event in sorted(future_events, key=lambda item: str(item.get("date", ""))):
        append_event(event)
    lines += [
        "];",
        "",
        instagram_section,
        "",
    ]

    os.makedirs(os.path.dirname(output_ts_path), exist_ok=True)
    Path(output_ts_path).write_text("\n".join(lines), encoding="utf-8")
    print(f"Generated {output_ts_path}")
    print(f"  Past yoga events: {len(past_events)} | Upcoming: {len(future_events)}")
    print(f"  Tickets: {total_tickets} | Revenue: CA${total_revenue:,.2f}")
    print(f"  Revenue mode: {'actual Stripe CSV' if use_actual_revenue else 'estimated public data'}")

    return {
        "past_events": len(past_events),
        "future_events": len(future_events),
        "total_tickets": total_tickets,
        "total_revenue_cad": total_revenue,
        "revenue_is_estimated": not use_actual_revenue,
        "revenue_coverage_pct": coverage * 100,
    }


if __name__ == "__main__":
    public_events = sys.argv[1] if len(sys.argv) > 1 else "/home/ubuntu/luma_events.json"
    output_ts = sys.argv[2] if len(sys.argv) > 2 else "/home/ubuntu/apy-revenue-calculator/client/src/lib/lumaData.ts"
    revenue_json = sys.argv[3] if len(sys.argv) > 3 else None
    result = generate_ts(public_events, output_ts, revenue_json)
    print(f"Summary: {result}")
