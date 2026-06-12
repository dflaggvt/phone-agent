# Monetization And Billing

## Positioning

Phone Agent should monetize as a usage-based communication assistant, not as a generic chatbot subscription. The product consumes variable-cost infrastructure whenever it answers calls, transcribes audio, runs model classification, generates summaries, creates calendar actions, sends messages, stores content, or keeps an assistant number reserved for a user.

The commercial promise should be simple:

> Pay for the communication work your assistant actually does.

The customer should not need to understand provider names, token math, or telecom routing to use the product. The application should still maintain a detailed internal cost ledger so pricing, margins, spending caps, and abuse controls are accurate.

## Monetization Principles

- Require a payment method before provisioning paid phone/voice infrastructure.
- Keep customer pricing transparent, usage-based, and capped by default.
- Avoid unlimited plans until gross margin is proven across real call behavior.
- Do not expose backend vendor names in normal customer-facing billing copy.
- Track internal provider cost separately from customer-facing billable usage.
- Bill by understandable units first: assistant minutes, AI processing, number reservation, and message/document actions.
- Preserve trust: no surprise bills, no hidden auto-escalation, and clear controls.
- Let users set a monthly spending cap before the assistant can generate meaningful variable cost.
- Use billing status as a policy gate for paid actions, not merely as a reporting feature.
- Let users cancel the subscription without deleting the account. Cancellation should stop new paid assistant work immediately and preserve history/settings unless the user separately removes the account.

## Recommended Initial Pricing Model

Use a base subscription with usage overage and a required spending cap.

Initial beta defaults:

- Card required before assistant number assignment.
- Default monthly spending cap: `$40`.
- Warning thresholds: `50%`, `80%`, and `100%` of cap.
- Hard stop at cap unless the user increases it.
- Grace behavior at cap: assistant can still show history and settings, but new AI-handled calls should be blocked, routed to a plain fallback message, or handled only if the provider supports a no-cost fallback.
- Cancellation behavior: set local billing state to `canceled`, cancel the provider subscription when one exists, disable paid resource provisioning, and block new paid assistant work. Do not erase account history or release the assigned assistant number unless the user separately chooses account removal.
- Account removal behavior: cancel paid access, immediately release/delete the assigned assistant number through the voice-number provider adapter to stop ongoing number cost, then clear local routing and sign-in access. If provider-side release fails, keep the local assistant-number mapping and fail the removal request so support can retry without losing cost visibility.

Recommended paid launch pricing:

| Unit | Customer Price | Notes |
| --- | ---: | --- |
| Phone Agent Personal | `$19.00/mo` | Includes assistant number, 50 assistant-handled minutes, normal summaries, topic matching, and basic AI processing. |
| Additional assistant call time | `$0.39/min` | Applies after 50 included assistant minutes. Bill in `6s` increments with `60s` minimum when supported by the rating layer. |
| AI processing | included initially | Track internally; introduce plan limits or add-on units later if usage materially affects margin. |
| Calendar action | included initially | Track internally; price later if volume matters. |
| Contact sync | included | Contact identity lookup is a trust feature, not a usage meter. |
| Topic threads | included initially | Introduce storage/thread limits later after real usage is known. |

This is intentionally more predictable than pure usage billing. The base subscription protects margin on light users, reduces Stripe fee drag from tiny invoices, and gives customers a clear starting price. The overage price protects margin on heavy users and high-cost voice configurations.

## Why Not Charge Raw Tokens Directly?

Charging raw input/output tokens is accurate but poor consumer UX. Users do not know what a token is, cannot predict token use, and will distrust a bill full of model internals.

Instead:

- Internally record raw model usage: provider, model, input tokens, cached input tokens, output tokens, request type, object ID, and cost estimate.
- Externally expose AI processing as simple units with plain-language explanations.
- Show advanced usage details only in billing detail screens or downloadable statements.
- Keep pricing configuration versioned so a token-cost change does not silently change customer bills.

## Cost Basis

Pricing must be configurable because provider costs change.

Current external reference points checked on `2026-05-31`:

- Stripe usage-based billing supports subscriptions, prices, meters, and meter events for reporting usage over a billing period: https://docs.stripe.com/billing/subscriptions/usage-based/how-it-works
- OpenAI pricing is token-based and varies by model, modality, tools, and service tier: https://platform.openai.com/docs/pricing/
- Retell pay-as-you-go voice agent pricing is published as a per-minute range and includes component-level cost drivers such as voice infrastructure, TTS, LLM, telephony, and add-ons: https://www.retellai.com/pricing

These external prices must not be hard-coded into domain logic. Store them as versioned `CostRateCard` records so the product can change providers, models, or margins without data migrations.

## Billable Usage Dimensions

Customer-facing meters:

- `personal_plan_months`
- `assistant_call_minutes_included`
- `assistant_call_minutes_overage`
- `ai_processing_units` as an internal/customer-detail meter, not a default invoice line
- `sms_segments` later
- `email_actions` later
- `document_pages_processed` later
- `storage_gb_months` later

Internal cost meters:

- `voice_provider_minutes`
- `telephony_minutes`
- `stt_minutes`
- `tts_minutes`
- `llm_input_tokens`
- `llm_cached_input_tokens`
- `llm_output_tokens`
- `llm_requests`
- `classifier_requests`
- `tool_calls`
- `calendar_api_actions`
- `sms_provider_segments`
- `email_provider_actions`
- `document_ocr_pages`
- `object_storage_gb_months`

Every internal meter should include:

- User ID.
- Source object type and ID.
- Provider.
- Model or provider SKU when applicable.
- Quantity.
- Estimated unit cost.
- Estimated total cost.
- Price/cost version.
- Idempotency key.
- Timestamp.

## Pricing And Cost Data Model

Core entities:

- `BillingAccount`: user ID, Stripe customer ID, billing status, payment method state, currency, tax settings, spending cap, and delinquency state.
- `PaymentMethod`: tokenized provider reference, brand/last4 for display, default flag, expiration, and verification state.
- `PricePlan`: public plan name, currency, status, effective dates, and user-facing pricing rules.
- `BillableMeter`: customer-facing meter definition and rounding policy.
- `CostMeter`: internal provider cost meter definition.
- `CostRateCard`: provider/model/SKU unit costs by effective date.
- `UsageEvent`: raw domain usage event, idempotent and provider-neutral.
- `RatedUsageEvent`: priced usage event with customer charge, internal estimated cost, margin, rating version, and local spend application marker.
- `InvoiceMirror`: local copy of invoice state from the billing provider.
- `CreditGrant`: promotional, refund, or manual credit.
- `SpendingLimit`: monthly cap, warning thresholds, and hard-stop policy.

Do not store raw card data. Use Stripe-hosted collection surfaces or native Stripe SDK components so Phone Agent does not touch PCI-sensitive card details.

## Billing State Machine

User billing states:

- `not_required`: private beta or internal test account.
- `payment_required`: user can browse but cannot provision paid infrastructure.
- `payment_method_added`: card exists but paid usage is not yet active.
- `active`: paid infrastructure and usage allowed within cap.
- `cap_reached`: paid usage blocked until cap increase or next billing period.
- `past_due`: payment failed; paid usage paused after grace period.
- `suspended`: abuse, chargeback, or policy block.
- `canceled`: new paid usage is blocked and paid provisioning is disabled; assigned assistant numbers remain until the user removes the account or a separate operator cleanup policy is invoked.

Paid action gates:

- Assistant number assignment requires `active` or explicit beta bypass.
- Assistant number assignment is blocked when local current-period spend is at or above the user's monthly cap.
- New AI-handled calls require `active` and remaining spending cap.
- Expensive cross-channel processing requires `active` and remaining AI processing budget.
- Calendar write actions can stay free initially but should still be usage-recorded.
- External SMS/email sharing requires `active` when provider costs are introduced.

## Stripe Integration Strategy

Use Stripe as payment processor and invoicing system, but keep Phone Agent as the source of usage truth.

Recommended Stripe model:

- Create one Stripe `Customer` per Phone Agent user.
- Collect payment method with Stripe-hosted Checkout, Customer Portal, or mobile PaymentSheet.
- Hosted payment-method setup sessions must include the plan currency, currently `usd`, so current Stripe API versions can create setup-mode Checkout Sessions consistently.
- Use a metered subscription or equivalent usage-based setup for recurring billing.
- Report customer-facing meter events to Stripe with idempotency keys.
- Listen to Stripe webhooks for payment method, invoice, payment failure, subscription, and dispute events.
- Mirror invoice/payment state locally so app behavior does not depend on synchronous Stripe reads.

Phone Agent responsibilities:

- Decide whether usage is allowed before cost is incurred.
- Record raw usage and rated usage before sending meter events.
- Enforce spending caps in real time.
- Degrade gracefully when billing provider APIs are unavailable.
- Reconcile local rated usage against Stripe invoice line items.
- Process payment-provider webhooks through a durable idempotency ledger so duplicate delivery, retries, and races cannot double-activate, double-cancel, or double-meter a user.

Stripe responsibilities:

- Card collection.
- PCI-sensitive payment method storage.
- Invoicing.
- Payment retries.
- Receipts.
- Customer payment portal.

### Stripe Catalog Configuration

Stripe needs account-level catalog objects before production billing can safely move from "card on file" to active subscription and usage metering. On current Stripe API versions, metered prices must be backed by Billing Meters.

Configure these products and prices in each Stripe environment:

| Stripe object | Lookup key or event name | Amount | Billing behavior |
| --- | --- | ---: | --- |
| Product: Phone Agent Personal | n/a | n/a | Parent product for the first consumer paid plan. |
| Price: Phone Agent Personal monthly plan | `phone_agent_personal_monthly_usd` | `$19.00` | Monthly recurring licensed price. |
| Billing Meter: Assistant call minutes | `phone_agent_call_minutes` | n/a | Aggregates customer usage from idempotent meter events. |
| Price: Personal assistant minute overage | `phone_agent_personal_call_minute_overage_usd` | `$0.00` for first 50 minutes, then `$0.39/min` | Monthly metered tiered usage. |
| Internal meter: AI processing units | n/a | n/a | Tracked inside Phone Agent for cost and margin, not a default Stripe invoice line. |

Use `npm run stripe:configure-catalog` with `STRIPE_SECRET_KEY` set to create or reuse these objects. The script is idempotent by lookup key and app metadata.

Store resulting price IDs in runtime configuration:

- `STRIPE_PRICE_PERSONAL_MONTHLY`
- `STRIPE_PRICE_PERSONAL_CALL_MINUTE_OVERAGE`

Do not store Stripe secret keys, webhook signing secrets, or raw card details in source control. Product IDs, price IDs, and lookup keys are safe configuration identifiers, but production IDs should still be managed through deployment configuration rather than scattered through application code.

Customer-specific Stripe objects are created at runtime:

- `Customer`: created when a user starts billing setup.
- Payment method: collected through Stripe-hosted or Stripe SDK surfaces.
- Subscription: created idempotently after the user has a payment method, a spending cap, and a paid assistant resource to activate.
- Usage/meter events: emitted from idempotent Phone Agent usage records, not directly from provider callbacks.

Runtime subscription rules:

- The backend creates or reuses one active Personal subscription per user/customer.
- The subscription includes the Personal monthly plan price plus the tiered assistant-minute overage price.
- The assistant number and basic AI processing are included in the Personal monthly plan, not billed as separate default invoice lines.
- Subscription creation is retried when either payment method setup or spending-cap setup completes, because the user may do those in either order.
- Subscription creation must use a stable provider idempotency key per customer and plan so concurrent webhook and app activation paths cannot create duplicate subscriptions.
- Subscription webhooks must not let an old or duplicate subscription cancellation overwrite a different active subscription in the local billing mirror.
- Webhook event IDs must be stored with status, attempt count, processed timestamp, and sanitized error information. Duplicate successful event deliveries should return `200` without reapplying side effects.
- If subscription creation fails, the local billing account stays below `active`, paid provisioning remains blocked when billing gates are enabled, and the app should show a retry path without losing the payment method state.
- Payment state is mirrored from Stripe webhooks, but product gates use the local `BillingAccount` state so the app does not depend on synchronous Stripe reads during calls.
- When billing gates are enabled, live assistant work must degrade before context assembly if payment is inactive or the spending cap is reached. The fallback may say the assistant is unavailable, but it must not load or disclose caller memory, topic memory, calendar context, user notes, or tool access.
- Outbound calls and in-call tool side effects use the same gate. If blocked, the agent receives an `unavailable` result and should take a message rather than creating transfers, live answer requests, calendar actions, or other paid work.

Usage publishing rules:

- The application records a local `UsageEvent` before publishing anything to Stripe.
- Each usage event has an idempotency key derived from the domain object, such as a call ID or classification source ID.
- The local usage record is rated before spend is applied: included minutes, overage minutes, estimated internal cost, customer charge, margin, and `ratingVersion` are stored together.
- Local spend is applied through an idempotent usage-event claim so duplicate provider webhooks cannot double-count customer spend or duplicate cap warnings.
- Meter events use Stripe customer ID plus value payload fields expected by the configured Billing Meters.
- If Stripe is unavailable, the local usage event remains the source of truth and can be retried by a later reconciliation job.
- Provider callbacks may trigger usage recording, but they must not directly publish billable usage to Stripe.
- Stripe invoice webhooks are mirrored into sanitized local `InvoiceMirror` records. The app should prefer the local mirror for invoice display and fall back to provider invoice reads only when no mirror exists yet.
- Cap warning notifications are created at `50%` and `80%` of the monthly spending cap. Cap-reached notifications are created when rated local spend reaches the cap, and paid runtime gates block further paid work.

## User Experience

Onboarding billing screen:

- Appears after phone verification and assistant name, before assistant number assignment.
- Title: `Choose your spending limit`.
- Primary copy: `Phone Agent Personal is $19/month and includes your assistant number, 50 assistant minutes, summaries, and topic matching. Choose the most you want to spend if usage goes above the included minutes.`
- Default cap: `$40/mo`.
- Preset caps: `$25`, `$40`, `$75`, `$100`.
- Custom cap allowed with minimum `$5`.
- Primary button: `Add card`.
- Secondary link: `How usage is billed`.
- The billing screen is included in first-run onboarding only when the backend returns billing as a required activation step.
- The app should allow the user to set the cap before or after adding a card; the backend activates billing once both are present.
- Returning from Stripe-hosted card setup must trigger an authenticated billing activation and source-of-truth refresh automatically. The user should not have to know that "Check billing status" is required after adding a card.
- Once billing is active, the primary action should change to `Manage billing` and open the provider-hosted customer portal. `Add card` is only for payment-required or incomplete billing states.

Settings billing screen:

- Current month spend.
- Current cap and next reset date.
- Usage by category: calls, AI processing, number reservation, future messages/docs.
- Payment method.
- Invoices/receipts.
- Change cap.
- Pause paid usage.
- Cancel assistant number.
- Manage billing opens the provider-hosted customer portal for payment method, invoice, and subscription management.

Do not show raw provider names in the default billing UI. Advanced diagnostics may show provider-specific cost only to internal admins.

## Customer-Facing Billing Copy

Use:

- `Assistant call time`
- `AI processing`
- `Assistant number`
- `Messages`
- `Documents`
- `Storage`

Avoid:

- `Retell`
- `OpenAI tokens`
- `GPT-4.1`
- `TTS`
- `STT`
- `webhook`
- `LLM orchestration`

Explain AI processing as:

> AI processing covers summaries, topic matching, decision extraction, and follow-up detection outside the live call.

## Fraud, Abuse, And Cost Controls

Controls:

- Require verified phone number and payment method before paid phone number provisioning.
- Rate-limit assistant number assignment attempts.
- Enforce one active assistant number per user until trust is established.
- Add daily and monthly spend ceilings.
- Pause paid usage after payment failure.
- Detect unusually long calls, repeated short calls, robocall patterns, and forwarding loops.
- Require user approval before outbound paid calls.
- Alert internally on negative-margin users, high failed payments, chargebacks, and usage spikes.

## Tax, Refunds, And Legal

Open questions for legal/accounting:

- Whether AI assistant subscription and usage overage are taxable in each launch state.
- Whether phone number reservation should be treated as telecom-adjacent for tax purposes.
- Refund policy for failed assistant calls, bad transfers, or provider outages.
- Whether call recording/transcription consent affects invoice descriptions.
- Whether usage statements can include caller names or topic names; default should avoid sensitive details.

## Analytics And Metrics

Business metrics:

- Payment method attach rate.
- Billing screen conversion.
- Assistant number assignment conversion after card add.
- First paid handled call rate.
- Average revenue per active user.
- Gross margin per user.
- Gross margin per handled call minute.
- AI processing units per call.
- Call minutes per active user.
- Cap increase rate.
- Cap reached rate.
- Payment failure rate.
- Refund/credit rate.
- Churn after first invoice.

Operational metrics:

- Cost per provider minute.
- Model cost per communication item.
- Classification cost per accepted topic suggestion.
- Summary/extraction cost per useful outcome.
- Billing webhook latency.
- Meter event reconciliation failures.
- Users blocked by billing state.

## MVP Implementation Scope

Build first:

- Billing docs and pricing configuration.
- `BillingAccount` domain model.
- Stripe customer creation.
- Payment method collection flow.
- Spending cap settings.
- Usage rating service.
- Stripe meter event publisher.
- Billing webhook receiver.
- Local invoice mirror.
- Proactive cap-warning notifications.
- Billing status gate before assistant number assignment.
- Billing status gate before AI-handled live calls where feasible.
- Mobile billing onboarding screen.
- Mobile billing settings screen.
- Usage and invoice summary APIs.

Do not build first:

- Complex enterprise plans.
- Annual contracts.
- Team billing.
- Per-topic billing.
- Marketplace referrals.
- Raw token billing UI.
- Autonomous outbound calling billing without a separate approval model.
