#!/usr/bin/env python3
"""
extract_luma_revenue.py
-----------------------
Process a Luma Stripe CSV export into clean per-event revenue JSON.

Usage:
    python extract_luma_revenue.py <csv_path> [output_json_path]

Output JSON structure:
    {
      "summary": {
        "total_gross_cad": 145976.95,
        "total_net_cad": 141234.00,
        "total_tickets": 1343,
        "total_events": 94,
        "avg_gross_per_event": 1553.0,
        "avg_tickets_per_event": 14,
        "locations": 4
      },
      "events": [
        {
          "event_id": "evt-XXXX",
          "name": "AfroPuppyYoga | Kitchener | Golden Retrievers",
          "date": "2025-07-12",
          "location": "Kitchener",
          "breed": "Golden Retrievers",
          "tickets": 28,
          "gross_cad": 2940.00,
          "net_cad": 2847.80
        },
        ...
      ],
      "monthly": [
        {
          "month": "2025-07",
          "month_label": "Jul '25",
          "events": 4,
          "tickets": 112,
          "gross": 11760.00,
          "net": 11397.00,
          "avg_gross_per_event": 2940.00
        },
        ...
      ],
      "by_location": [
        {
          "location": "Kitchener",
          "events": 44,
          "tickets": 620,
          "gross": 65240.00,
          "net": 63183.00,
          "avg_gross_per_event": 1482.73
        },
        ...
      ],
      "by_breed": [
        {
          "breed": "Golden Retrievers",
          "events": 6,
          "tickets": 168,
          "gross": 17640.00,
          "avg_gross": 2940.00
        },
        ...
      ]
    }
"""

import csv
import json
import re
import sys
from collections import defaultdict
from datetime import datetime


def parse_amount(s: str) -> float:
    """Parse a currency string like 'CA$1,234.56' or '1234.56' to float."""
    if not s or s.strip() in ("", "-", "N/A"):
        return 0.0
    cleaned = re.sub(r"[^\d.\-]", "", s.strip())
    try:
        return float(cleaned)
    except ValueError:
        return 0.0


def infer_location(event_name: str) -> str:
    """Infer city location from event name."""
    name_upper = event_name.upper()
    if "KITCHENER" in name_upper:
        return "Kitchener"
    elif "HAMILTON" in name_upper:
        return "Hamilton"
    elif "MISSISSAUGA" in name_upper:
        return "Mississauga"
    elif "TORONTO" in name_upper:
        return "Toronto"
    elif "GIFT" in name_upper or "GIFT CARD" in name_upper:
        return "Gift Cards"
    else:
        return "Other"


def infer_breed(event_name: str) -> str:
    """Extract breed from event name (last pipe-separated segment)."""
    parts = [p.strip() for p in event_name.split("|")]
    if len(parts) >= 3:
        return parts[-1]
    elif len(parts) == 2:
        return parts[-1]
    return "General"


def month_label(date_str: str) -> str:
    """Convert '2025-07-12' to 'Jul '25'."""
    try:
        dt = datetime.strptime(date_str[:7], "%Y-%m")
        return dt.strftime("%b '%y")
    except ValueError:
        return date_str[:7]


def process_csv(csv_path: str) -> dict:
    """Read the Luma Stripe CSV and aggregate revenue by event."""
    # Per-event accumulator: event_id -> dict
    events: dict[str, dict] = {}

    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Luma CSV columns (actual export format as of 2026):
            # api_id, email, created_at, charge_name, currency,
            # amount, amount_refunded, amount_tax, amount_after_fees, event_api_id
            event_id = (row.get("event_api_id") or row.get("Event ID") or row.get("event_id") or "").strip()
            event_name = (row.get("charge_name") or row.get("Event Name") or row.get("event_name") or "").strip()
            event_date = (row.get("created_at") or row.get("Event Date") or row.get("event_date") or "").strip()
            gross_str = (row.get("amount") or row.get("Gross Amount") or row.get("gross_amount") or "0").strip()
            net_str = (row.get("amount_after_fees") or row.get("Net Amount") or row.get("net_amount") or "0").strip()
            # Each row = 1 ticket transaction (no quantity column in this format)
            qty_str = (row.get("Quantity") or row.get("quantity") or "1").strip()

            # Normalise date to YYYY-MM-DD (handles ISO 8601 timestamps too)
            raw_date = event_date[:10]  # works for both YYYY-MM-DD and YYYY-MM-DDTHH:MM:SS
            for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%B %d, %Y"):
                try:
                    event_date = datetime.strptime(raw_date, fmt).strftime("%Y-%m-%d")
                    break
                except ValueError:
                    continue

            gross = parse_amount(gross_str)
            net = parse_amount(net_str)
            qty = int(float(qty_str)) if qty_str.replace(".", "").isdigit() else 1

            if not event_id:
                continue

            if event_id not in events:
                events[event_id] = {
                    "event_id": event_id,
                    "name": event_name,
                    "date": event_date,
                    "location": infer_location(event_name),
                    "breed": infer_breed(event_name),
                    "tickets": 0,
                    "gross_cad": 0.0,
                    "net_cad": 0.0,
                }
            events[event_id]["tickets"] += qty
            events[event_id]["gross_cad"] += gross
            events[event_id]["net_cad"] += net
            # Keep most complete name/date
            if len(event_name) > len(events[event_id]["name"]):
                events[event_id]["name"] = event_name
            if event_date and event_date > events[event_id]["date"]:
                events[event_id]["date"] = event_date

    event_list = sorted(events.values(), key=lambda e: e["date"], reverse=True)

    # Round floats
    for e in event_list:
        e["gross_cad"] = round(e["gross_cad"], 2)
        e["net_cad"] = round(e["net_cad"], 2)

    # Summary
    total_gross = sum(e["gross_cad"] for e in event_list)
    total_net = sum(e["net_cad"] for e in event_list)
    total_tickets = sum(e["tickets"] for e in event_list)
    paid_events = [e for e in event_list if e["gross_cad"] > 0]
    locations = len({e["location"] for e in event_list if e["location"] != "Gift Cards"})

    summary = {
        "total_gross_cad": round(total_gross, 2),
        "total_net_cad": round(total_net, 2),
        "total_tickets": total_tickets,
        "total_events": len(event_list),
        "paid_events": len(paid_events),
        "avg_gross_per_event": round(total_gross / len(paid_events), 2) if paid_events else 0,
        "avg_tickets_per_event": round(total_tickets / len(event_list)) if event_list else 0,
        "locations": locations,
    }

    # Monthly aggregation
    monthly_map: dict[str, dict] = {}
    for e in event_list:
        m = e["date"][:7]
        if m not in monthly_map:
            monthly_map[m] = {"month": m, "month_label": month_label(e["date"]), "events": 0, "tickets": 0, "gross": 0.0, "net": 0.0}
        monthly_map[m]["events"] += 1
        monthly_map[m]["tickets"] += e["tickets"]
        monthly_map[m]["gross"] += e["gross_cad"]
        monthly_map[m]["net"] += e["net_cad"]
    monthly = []
    for m in sorted(monthly_map):
        rec = monthly_map[m]
        rec["gross"] = round(rec["gross"], 2)
        rec["net"] = round(rec["net"], 2)
        rec["avg_gross_per_event"] = round(rec["gross"] / rec["events"], 2) if rec["events"] else 0
        monthly.append(rec)

    # By location
    loc_map: dict[str, dict] = defaultdict(lambda: {"events": 0, "tickets": 0, "gross": 0.0, "net": 0.0})
    for e in event_list:
        loc_map[e["location"]]["events"] += 1
        loc_map[e["location"]]["tickets"] += e["tickets"]
        loc_map[e["location"]]["gross"] += e["gross_cad"]
        loc_map[e["location"]]["net"] += e["net_cad"]
    by_location = sorted(
        [{"location": loc, **dict(v)} for loc, v in loc_map.items()],
        key=lambda x: x["gross"],
        reverse=True,
    )
    for r in by_location:
        r["gross"] = round(r["gross"], 2)
        r["net"] = round(r["net"], 2)
        r["avg_gross_per_event"] = round(r["gross"] / r["events"], 2) if r["events"] else 0

    # By breed
    breed_map: dict[str, dict] = defaultdict(lambda: {"events": 0, "tickets": 0, "gross": 0.0})
    for e in event_list:
        breed_map[e["breed"]]["events"] += 1
        breed_map[e["breed"]]["tickets"] += e["tickets"]
        breed_map[e["breed"]]["gross"] += e["gross_cad"]
    by_breed = sorted(
        [{"breed": b, **dict(v)} for b, v in breed_map.items()],
        key=lambda x: x["gross"],
        reverse=True,
    )
    for r in by_breed:
        r["gross"] = round(r["gross"], 2)
        r["avg_gross"] = round(r["gross"] / r["events"], 2) if r["events"] else 0

    return {
        "summary": summary,
        "events": event_list,
        "monthly": monthly,
        "by_location": by_location,
        "by_breed": by_breed,
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python extract_luma_revenue.py <csv_path> [output_json_path]")
        sys.exit(1)

    csv_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else "luma_events.json"

    print(f"Processing: {csv_path}")
    data = process_csv(csv_path)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=True)

    s = data["summary"]
    print(f"Done -> {output_path}")
    print(f"  Events: {s['total_events']} ({s['paid_events']} paid)")
    print(f"  Tickets: {s['total_tickets']}")
    print(f"  Gross: CA${s['total_gross_cad']:,.2f}")
    print(f"  Avg/event: CA${s['avg_gross_per_event']:,.2f}")
