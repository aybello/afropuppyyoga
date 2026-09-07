# QuickBooks Online integration research — Sep 7, 2026

## Verified sources

- Intuit OAuth 2.0 setup: https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0
- Intuit API best practices: https://help.developer.intuit.com/s/article/QuickBooks-Online-API-Best-Practices
- Intuit webhooks overview: https://developer.intuit.com/app/developer/qbo/docs/develop/webhooks

## Implementation decisions

APY will use the QuickBooks Online Accounting OAuth scope and production consent flow. The connection is strictly read-only: APY imports financial facts for owner-only analysis and does not create payments, edit transactions, or reconcile accounts.

Intuit’s OAuth documentation requires an authorization code exchange and identifies the selected QuickBooks company with `realmId`. The app must validate OAuth `state`, use the configured redirect URI exactly, and refresh expired access tokens with the refresh token.

Intuit’s best-practices guidance recommends change-aware synchronization rather than repeatedly retrieving all entities. APY will use a daily managed synchronization with a fourteen-day overlap and source-key deduplication so corrected or late-updated transaction facts can be refreshed without duplicate records. A manual owner-only Sync now action is also required.

The first implementation imports read-only Purchase, Bill, Check, Deposit, and Transfer entities. Expense and income totals are management analysis only; transfers are excluded from net cash movement. APY keeps encrypted OAuth tokens server-side, masks account detail in the interface, and gives the owner a downloadable aggregate AI summary with no account numbers or individual transaction descriptions.
