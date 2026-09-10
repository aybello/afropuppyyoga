# APY Mobile Business-Texting Transition Plan

## Status

**Selected direction:** A dedicated mobile business-texting app using the existing APY business number.  
**Current status:** Planning only. No number port, provider account, API credential, or live message-routing change has been started.

## Why the Current Notification Cannot Be Replied To

The current inbound-SMS webhook stores each guest reply and sends the owner a new notification text from the APY Twilio number. The forwarded notification has no native connection to the original guest conversation, so replying from the phone sends the message back to the APY number rather than to the guest.

## Current APY Dependencies on the Business Number

| Dependency | Current behavior | Required transition decision |
|---|---|---|
| Guest and breeder SMS | Direct programmatic messages from APY workflows | Move to the new provider’s SMS API before the port date. |
| Guest replies | Inbound webhook stores replies and forwards an owner notification | Let the mobile inbox own the live conversation; optionally retain signed webhooks for APY records and consent handling. |
| Automated calls | Current cancellation workflow can use a programmable voice call | Cannot be assumed to continue through the mobile SMS provider; select a deliberate replacement or retirement path. |
| Staff SMS sign-in codes | APY HQ sends one-time codes through the business number | Rebuild and test against the new provider before the port. |
| Delivery records and opt-outs | APY records delivery status and applies STOP/START safeguards | Preserve APY suppression checks and verify the new provider’s opt-out behavior before turning automation back on. |

## Safe Transition Sequence

1. **Create the mobile business workspace.** The owner creates the provider workspace, installs the mobile app, and verifies that the inbox experience meets the day-to-day reply need using a temporary number. The APY business number remains untouched.
2. **Build and test the replacement integration.** APY adds the new provider’s API and signed inbound webhooks behind a provider boundary. Test outbound SMS, inbound replies, STOP/START handling, staff passcodes, delivery records, and failure states using test-only numbers.
3. **Resolve calls before the port.** Decide whether automated calls will use a separate programmable voice number, move to a different voice provider, or be retired in favor of SMS and email. Do not assume the mobile inbox service can preserve APY’s current automated-call behavior.
4. **Prepare the port request.** The owner supplies the carrier-required authorization materials through the provider’s secure porting process. For Canadian numbers, this commonly includes a current authorization letter, account details, any required PIN, and an address matching carrier records.
5. **Port only after green preflight checks.** Freeze automated SMS/calls during the change window, complete the port, update production credentials and webhooks, and run an owner-controlled inbound/outbound test. Keep the legacy provider account available for historic delivery/audit records.
6. **Observe the transition.** Keep automation limited until real inbound/outbound messages, opt-outs, staff access codes, and any retained calling path are verified. Document the final setup in APY HQ and the Context Hub.

## Owner Decisions Needed Before Implementation

| Decision | Options |
|---|---|
| Automated calls | Keep them through a separate voice service; replace them with manual calls from the mobile app; or retire automated calls and retain email/SMS. |
| Staff access-code delivery | Keep SMS one-time codes through the new provider; or use a different verified access channel. |
| Build authorization | Authorize APY to build and test the provider integration before the number-port request. |

## Verified Provider Capabilities and Constraints

Quo documents programmatic SMS sending/receiving and signed inbound-message webhooks, which can support APY’s current automation model. Its public API documentation states that MMS is not supported. Quo also documents that porting converts a number to an internet-based line and may temporarily affect SMS availability. Twilio documents that a Canadian port requires owner-controlled authorization materials and matching carrier-record information.

## Sources

1. [Twilio — Receiving Two-Way SMS and MMS](https://help.twilio.com/articles/235288367-Receiving-Two-Way-SMS-and-MMS-Messages-with-Twilio)
2. [Twilio — Canada Porting Guidelines](https://www.twilio.com/en-us/guidelines/ca/porting)
3. [Quo — Number Porting Overview](https://support.quo.com/getting-started/porting/overview)
4. [Quo — API](https://www.quo.com/api)
5. [Quo — Webhooks Overview](https://www.quo.com/docs/2026-03-30/webhooks-overview)
