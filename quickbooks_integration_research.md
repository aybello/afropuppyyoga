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

## Production app activation notes

Intuit requires the production redirect URI to be added in the developer dashboard under **Settings → Redirect URIs → Production**. The registered URI must match the OAuth request exactly and must use HTTPS; IP-address redirect destinations are not allowed. APY’s exact production callback is:

`https://afropuppyyoga.ca/api/integrations/quickbooks/callback`

The Intuit production key experience shown to the owner has an incomplete production checklist. The official redirect-URI guidance confirms production and sandbox environments have distinct URI registrations. Intuit’s public production-keys guidance also states that production app details and the app-assessment questionnaire are required before live production keys/data can be activated. The owner must complete these developer-portal fields and retain control of the credentials.

### APY URL mapping for the Intuit app profile

| Intuit field | APY value or behavior |
| --- | --- |
| Product website / host domain | `https://afropuppyyoga.ca` |
| Launch URL | `https://afropuppyyoga.ca/admin/quickbooks` |
| Connect / reconnect URL | `https://afropuppyyoga.ca/admin/quickbooks` |
| OAuth redirect URI | `https://afropuppyyoga.ca/api/integrations/quickbooks/callback` |
| App purpose | Internal, owner-controlled read-only QuickBooks Online reporting and export to a private Google Sheet |
| Data access | Accounting read scope only; no payments, writes, transaction edits, or reconciliation |

Before entering a privacy-policy or disconnect URL, APY must add a public privacy notice and a truthful internal disconnect flow. Do not claim those pages exist before they have been implemented.

### Deployment verification note — September 7, 2026

The Privacy, Terms, and QuickBooks Disconnect routes were built and passed local visual validation, then published in checkpoint `c6c83b37`. Immediately after publication, the custom domain `https://afropuppyyoga.ca/privacy` still returned APY’s client-side 404 on two checks. Do not enter the public privacy, terms, or disconnect URLs in the Intuit production form until a post-propagation live-domain check confirms the deployed route is available.

At the next check, the custom domain still returned the prior 404 implementation, while the managed `afropuppy-euumx9tb.manus.space` domain began loading the updated shell. Treat this as deployment propagation rather than a confirmed production-route defect; recheck the custom domain before submitting the Intuit form.

After republishing in checkpoint `42518a05`, the custom-domain Privacy route still returned the old client-side 404 both normally and with a cache-busting query string. The public production-app URLs must remain pending until this deployment discrepancy is resolved.

The managed production domain was then checked with the same cache-busting release marker and also served the prior 404 page. This is consistent with stale production bundle propagation across both domains, not an App route mismatch: local build and preview include the new route. Do not enter the policy URLs in Intuit until a live-domain verification succeeds.
