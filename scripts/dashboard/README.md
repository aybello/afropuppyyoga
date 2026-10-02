# APY private dashboard refresh

The private `/dashboard` route reads **aggregate-only** Luma public calendar data at request time and caches it for 15 minutes. Its revenue values remain visibly marked **Estimated** because public ticket counts and advertised ticket prices are not an authenticated payment record.

## Stripe-confirmed revenue

Do not replace the estimate with a payment total unless an owner-authenticated Luma Stripe sales CSV has been exported for the intended all-time period and checked for coverage. The recovered scripts below preserve the former workflow:

1. Sign into Luma in a browser session owned by an authorized APY administrator.
2. Export the sales history CSV from the Luma calendar payment area.
3. Run `extract_luma_revenue.py` on the CSV.
4. Reconcile event coverage before any dashboard data is marked Stripe-confirmed.
5. Keep raw CSVs and customer-level rows outside the deployed client bundle and database unless a separate privacy review approves retained storage.

The recovered `legacy_luma_refresh_reference.py`, `legacy_luma_data_generator_reference.py`, and `legacy_luma_csv_parser_reference.py` retain the former Luma CSV and marker-delimited Instagram refresh semantics for future migration. They are reference-only, not production schedulers, because a sandbox browser session is not durable. If an automated production refresh is approved later, use a deployed, authenticated `/api/scheduled/*` handler and a server-side secret or secure file intake. Do not place Luma credentials, browser cookies, or raw sales CSV data in client code or Git.

## Instagram data

The dashboard intentionally shows no Instagram performance values until a verified account refresh exists. When it is restored, return aggregate metrics only through the owner-only dashboard router and store its refresh time and data source.
