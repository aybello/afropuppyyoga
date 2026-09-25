# AfroPuppyYoga Workflow Modernization Audit

**Audit date:** September 25, 2026  
**Audited release:** `bef88848daa119ef0a32590aaf1a9a7e96f78b0c`  
**Git verification:** local `HEAD` matched `user_github/main`; working tree was clean before the read-only audit.

## Executive Summary

The current core workflows have meaningful safeguards. New-hire transfer rechecks signed documents and onboarding delivery in a transaction. New Luma class creation validates a public, registration-open event. Private-event pricing is recalculated server-side, HST is centrally calculated, formal offer delivery is logged, and payment-linked booking is driven by a signed Luma webhook. Public-class cancellation, protected breeder changes, and explicit manual invitations also use deliberate confirmation gates.

However, the application is **not yet fully migrated to the new workflow model**. The audit found several still-reachable server paths that bypass those newer safeguards. The highest risk areas are staff portal revocation and historic reactivation, private-event payment and cancellation records, Luma event reuse, generic schedule mutations, legacy birthday intake, and outbound message idempotency. The findings prove reachable code paths, not that a customer, staff member, or provider has used them in production.

## Highest-Priority Findings

| Area | Finding | Material risk | Required outcome |
|---|---|---|---|
| Staff access | Staff Management revocation does not deactivate the active APY HQ profile that actually authorizes the portal. Historic accepted profiles can also be reactivated without current signing/onboarding evidence. | Former staff can retain or regain portal access. | One authoritative team-state removal path, session invalidation, and onboarding-evidence gates for reactivation. |
| Private-event bookings | Quick Booking Link creates a paid Luma event without an inquiry, class record, action log, communication record, or webhook link. | Paid bookings can be absent from APY HQ tracking. | Remove the bypass or create a complete tracked inquiry before publishing. |
| Private-event cancellation | Generic class cancellation includes private-event Luma events but does not update the private-event commercial state. | A private event can receive a public-class credit flow while its booking record remains inconsistent. | Filter private events out or provide a dedicated cancellation workflow. |
| Luma reuse | Existing-event reuse returns before public/open verification. | A hidden, closed, cancelled, sold-out, or stale event can be treated as bookable and used in breeder confirmation. | GET-verify every reused event before local persistence or communication. |
| Schedule changes | Generic update/archive routes can alter breeder identity or archive a breeder-backed class without protected preview/notice flow. | Silent breeder changes, missing notices, and missing audit records. | Route breeder changes and archive through the protected workflows only. |
| Legacy birthday API | `birthday.submitInquiry` remains public even though the public page redirects to the current quote flow. | New birthday requests can land in a legacy table outside quote, approval, and booking controls. | Tombstone the API or adapt it to create a complete current inquiry. |
| Communications | Review texts, broadcasts, inbound owner alerts, and breeder-lead sends lack consistent pre-send claims and durable idempotency. | Duplicate/untracked SMS or email after retries, overlapping runs, or post-send database failures. | Add durable claim records, unique keys, provider delivery status, and retry rules. |

## Supporting Findings

| Area | Finding | Required outcome |
|---|---|---|
| Private-event offers | Client Gmail compose can send a payment link without server quote state or communication logs. | Replace with recorded server delivery or a pre-compose audit mutation. |
| Private-event status | Generic status editor can mark a private event booked or cancelled without verified payment or cancellation outcome. | Reserve commercial states for dedicated verified transitions. |
| Coverage and staffing | Weekend backup assignment does not recheck leave status; Puppy Monitor assignment accepts inactive classes. | Server-side availability and active-schedule checks. |
| Training | Completion is read-then-insert with no unique `(staffId, moduleKey)` key. | Unique key plus idempotent insert and defensive totals. |

## Controls Confirmed as Current

- Current applicant transfer verifies accepted status, delivered onboarding resources, latest signed agreement, and delivery-claim state inside the transaction.
- New public Luma events use the corrected registration-question schema, require public/open verification, and do not automatically invite the calendar audience.
- Luma invitations remain a separate explicit owner action with readiness checks and duplicate prevention.
- Formal private-event quote intake recalculates customer-entered values server-side, keeps HST calculations in cents, gates exceptions, and links payment to a signed webhook.
- Invoice approval and cumulative payment recording are owner-gated; QuickBooks is a read/import integration; Refund Tracker is a manual ledger and does not execute processor refunds.
- Public-class cancellation is preview-key gated and credit-idempotent for the same event.
- Central SMS suppression is checked across the primary SMS senders.

## Audit Limits

This was a read-only source and focused-test audit. It did not establish that any vulnerability was used, that any Luma event is currently closed, that any staff session remains active, that a payment was missed, or that duplicate communications occurred. After the code remediation, the remaining live work is a controlled database, provider, and application-log reconciliation to measure historical impact without altering records.

## Remediation Update

The September 25 workflow-hardening release closed the reachable operational bypasses identified in this audit. Staff Management now uses the same APY HQ removal path as the staffing tools, removes portal access, disables email, phone, and email-linked identities, preserves the Employee Directory history as inactive, and keeps Operations Manager and Puppy Monitor coverage checks in place. New email invites are bound to an immutable APY HQ profile ID, so a later email edit cannot cause removal to revoke the wrong person. Removals and staffing-duty assignments share a transaction-scoped database mutex, so coverage and upcoming-duty checks remain valid through the final mutation. Reactivation is limited to a completed onboarding record with delivered documents and a current signed agreement.

Private-event quick links and client-side Gmail sending are retired in favour of the tracked inquiry, approval, booking, payment, and recorded delivery path. Generic commercial status edits cannot claim a booking or cancellation. Public-class cancellation excludes Luma event IDs linked to private events. Existing Luma class events are GET-verified as public, registration-open, and usable before reuse. Generic schedule mutations cannot replace a breeder or archive a class, and the existing preview-and-notice workflows remain the only active route for those actions.

The release also tombstones the legacy birthday API, prevents staffing against inactive or past classes, validates weekend backup availability, makes training completion idempotent, and adds durable claims for review texts and manual SMS broadcasts. Inbound SMS forwarding now occurs only for a newly persisted Twilio message. The seven database migrations are additive: new claim tables prevent duplicate future review-text and training completion records, communications idempotency protects manual SMS delivery, one mutex table serializes cross-instance staffing changes, and an immutable invite-profile binding prevents identity drift. Existing invites were bound only where exactly one existing profile had the same normalized email; records without a one-to-one match deliberately fail closed for manual review. No historical invoices, applications, employees, customer records, or schedules are changed.

## Next Implementation Sequence

1. **Access and commercial boundaries:** canonical access revocation/reactivation, tracked quick links, dedicated private-event cancellation, and status restrictions.
2. **Booking and breeder integrity:** verify reused Luma events, prohibit generic breeder changes and silent archive, and validate coverage/staffing lifecycle state.
3. **Intake and communications:** retire legacy birthday intake and add durable message claims, unique constraints, provider IDs, and retry behavior.
4. **Validation and reconciliation:** migrations, focused tests, full suite, TypeScript, production build, independent review, GitHub synchronization, then read-only production reconciliation.

---

This audit is a release-hardening record. It should be updated as each item is corrected and verified.
