#!/usr/bin/env python3
"""Recovered reference runner for the former standalone revenue dashboard.

This file is intentionally retained as an operational reference, not enabled as
production automation. It needs a locally exposed, authenticated Luma browser
session to download a private sales CSV. See README.md before using it.
"""

from pathlib import Path

CALENDAR_ID = "cal-Z474jeIbvUXskHE"
SALES_HISTORY_URL = (
    "https://api2.luma.com/calendar/admin/payments/download-sales-history-csv"
    f"?calendar_api_id={CALENDAR_ID}"
)

if __name__ == "__main__":
    raise SystemExit(
        "Reference-only runner: authenticate in Luma and follow scripts/dashboard/README.md. "
        "Do not run this from a production deployment."
    )
