#!/usr/bin/env python3
"""Refresh AfroPuppyYoga Luma dashboard data.

The runner first tries the authenticated Luma Stripe sales CSV endpoint using
only Luma cookies from a locally exposed Chrome DevTools session. It always
refreshes public calendar events, then regenerates the TypeScript data module
without touching the marker-delimited Instagram section.

When an authenticated CSV is unavailable, the runner still completes a public
calendar refresh and clearly reports that revenue remains estimated. A WebDev
checkpoint must be saved by the caller after the runner reports a successful
TypeScript check.

Usage:
  python3 /home/ubuntu/.luma-refresh/run_weekly_refresh.py
  python3 /home/ubuntu/.luma-refresh/run_weekly_refresh.py --require-actual
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

CALENDAR_ID = "cal-Z474jeIbvUXskHE"
PROJECT_DIR = Path("/home/ubuntu/apy-revenue-calculator")
DATA_MODULE = PROJECT_DIR / "client/src/lib/lumaData.ts"
PUBLIC_FETCHER = Path("/home/ubuntu/fetch_luma_events_v2.py")
GENERATOR = Path("/home/ubuntu/json_to_ts.py")
CSV_EXTRACTOR = Path("/home/ubuntu/skills/luma-analytics/scripts/extract_luma_revenue.py")
PUBLIC_EVENTS_JSON = Path("/home/ubuntu/luma_events.json")
STRIPE_REVENUE_JSON = Path("/home/ubuntu/luma_stripe_revenue.json")
SALES_CSV = Path("/home/ubuntu/Downloads/luma-sales-history.csv")
SALES_URL = (
    "https://api2.luma.com/calendar/admin/payments/download-sales-history-csv"
    f"?calendar_api_id={CALENDAR_ID}"
)
CDP_URL = os.environ.get("LUMA_CDP_URL", "http://127.0.0.1:9222")


def run(command: list[str], cwd: Path | None = None, required: bool = True) -> bool:
    print("+", " ".join(command))
    result = subprocess.run(command, cwd=cwd, check=False)
    if required and result.returncode != 0:
        raise RuntimeError(f"Command failed with exit code {result.returncode}: {' '.join(command)}")
    return result.returncode == 0


def cdp_luma_cookie_header() -> str | None:
    """Return Luma-domain cookies only, never unrelated browser cookies."""
    try:
        import requests
        import websocket  # type: ignore
    except ImportError:
        print("CDP cookie extraction unavailable: requests/websocket-client not installed")
        return None

    try:
        targets = requests.get(f"{CDP_URL}/json", timeout=3).json()
        page = next((item for item in targets if item.get("type") == "page"), None)
        if not page:
            print("No browser page is exposed through CDP")
            return None
        ws = websocket.create_connection(page["webSocketDebuggerUrl"], timeout=5)
        ws.send(json.dumps({"id": 1, "method": "Network.getAllCookies"}))
        message = json.loads(ws.recv())
        ws.close()
        cookies = message.get("result", {}).get("cookies", [])
        allowed = [
            cookie
            for cookie in cookies
            if "luma.com" in str(cookie.get("domain", "")).lstrip(".").lower()
        ]
        if not allowed:
            print("No Luma cookies were found through CDP")
            return None
        header = "; ".join(f"{cookie['name']}={cookie['value']}" for cookie in allowed)
        print(f"Found {len(allowed)} Luma-domain cookie(s) through CDP")
        return header
    except Exception as exc:
        print(f"CDP cookie extraction failed: {type(exc).__name__}: {exc}")
        return None


def download_authenticated_sales_csv() -> bool:
    """Attempt the private CSV export. Returns false without failing fallback."""
    cookie_header = cdp_luma_cookie_header()
    if not cookie_header:
        return False

    request = urllib.request.Request(
        SALES_URL,
        headers={
            "Cookie": cookie_header,
            "Accept": "text/csv,application/json,*/*",
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            body = response.read()
            content_type = response.headers.get("content-type", "")
        if len(body) < 32 or b"api_id" not in body[:4096].lower():
            print(f"Stripe CSV endpoint did not return a CSV ({content_type}, {len(body)} bytes)")
            return False
        SALES_CSV.write_bytes(body)
        print(f"Downloaded authenticated Stripe CSV: {SALES_CSV} ({len(body):,} bytes)")
        return True
    except urllib.error.HTTPError as exc:
        print(f"Stripe CSV download unavailable: HTTP {exc.code} {exc.reason}")
    except Exception as exc:
        print(f"Stripe CSV download unavailable: {type(exc).__name__}: {exc}")
    return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Refresh AfroPuppyYoga Luma dashboard data")
    parser.add_argument(
        "--require-actual",
        action="store_true",
        help="Fail rather than fall back if an authenticated Stripe CSV cannot be downloaded.",
    )
    args = parser.parse_args()

    for required_path in (PROJECT_DIR, DATA_MODULE, PUBLIC_FETCHER, GENERATOR, CSV_EXTRACTOR):
        if not required_path.exists():
            raise FileNotFoundError(f"Required refresh input missing: {required_path}")

    print(f"=== AfroPuppyYoga Luma refresh | {datetime.now(timezone.utc).isoformat()} ===")
    csv_downloaded = download_authenticated_sales_csv()

    if args.require_actual and not csv_downloaded:
        print("Actual-only refresh blocked: sign in to Luma in the browser, then rerun.")
        return 3

    # Public API data supplies authoritative dates, locations, event IDs, tickets, and future events.
    run([sys.executable, str(PUBLIC_FETCHER)])

    revenue_args: list[str] = []
    if csv_downloaded:
        run([sys.executable, str(CSV_EXTRACTOR), str(SALES_CSV), str(STRIPE_REVENUE_JSON)])
        revenue_args = [str(STRIPE_REVENUE_JSON)]

    run([sys.executable, str(GENERATOR), str(PUBLIC_EVENTS_JSON), str(DATA_MODULE), *revenue_args])
    run(["pnpm", "run", "check"], cwd=PROJECT_DIR)

    mode = "actual authenticated Stripe CSV" if csv_downloaded else "estimated public calendar data"
    print(f"REFRESH COMPLETE: {mode}")
    print("Instagram marker section: preserved by generator")
    print("TypeScript: 0 errors")
    print("Next: save a WebDev checkpoint for this refresh.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"REFRESH FAILED: {type(exc).__name__}: {exc}", file=sys.stderr)
        raise SystemExit(1)
