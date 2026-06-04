# Implementation Plan

This plan sequences Phone Agent from its current Retell-backed phone layer toward a cross-channel topic-thread platform. Keep implementation incremental. Do not build fake integrations; add provider adapters only when a real ingestion path is available.

## Phase 0: Design Foundation

Scope:

- Update product requirements.
- Update architecture.
- Define domain model.
- Define provider abstractions.
- Define topic thread model.
- Define permission model.
- Define initial Retell integration assumptions.

Implementation tasks:

- Add provider-neutral `CommunicationItem` and `TopicThread` domain models. Status: implemented.
- Add participant, decision, open question, and task domain models. Status: implemented.
- Add repository interfaces for communication items and topic threads. Status: implemented.
- Add in-memory and Firestore persistence for communication items and topic threads. Status: implemented.
- Add voice provider abstraction types independent of Retell. Status: implemented.
- Keep existing Retell routes working. Status: implemented.

Exit criteria:

- Docs reflect cross-channel topic memory.
- Code has minimal provider-neutral domain skeleton.
- Existing backend tests still pass.

## Phase 1: AI Call Ingestion

Scope:

- Receive call events from Retell.
- Store calls as communication items.
- Store transcripts/summaries.
- Show call history.
- Basic user/contact model.
- Basic Retell webhook handling.
- Basic local/dev setup.

Implementation tasks:

- Map Retell `call_started`, `call_ended`, and `call_analyzed` events into `CommunicationItem` records. Status: implemented.
- Keep `CallSession` for voice-specific state while linking it to a communication item. Status: implemented.
- Add idempotency keys by provider and provider item ID. Status: implemented through `sourceProvider` + `providerItemId` upsert.
- Add tests for Retell-to-domain normalization. Status: implemented.

Exit criteria:

- Every completed call has a communication item with summary/transcript references.
- Call history can be powered by communication items without losing active-call behavior.

## Phase 2: Topic Thread MVP

Scope:

- Create topic threads manually.
- Attach calls to topic threads manually.
- Auto-suggest topic thread based on call summary. Status: implemented with OpenAI classifier when configured.
- Store decisions, open questions, and tasks. Status: manual topic state implemented; communication extraction scaffold implemented.
- Topic thread detail view.

Implementation tasks:

- Add `GET /v1/topics`, `POST /v1/topics`, `GET /v1/topics/{id}`. Status: implemented.
- Add attach/detach communication endpoints. Status: attach implemented; detach not yet implemented.
- Add manual CRUD for decisions, open questions, and tasks. Status: create implemented; update/delete not yet implemented.
- Add Android topic list and topic detail shell. Status: implemented with Communication Inbox, Topics, create topic, attach communication, and basic topic detail.
- Add OpenAI-backed classifier using structured JSON output. Status: implemented.
- Remove keyword-matching topic fallback. Status: implemented.
- Add accept/dismiss endpoints so suggested attachments are reviewable before automatic attachment is enabled. Status: implemented.
- Add low-confidence extraction scaffolding for decisions, questions, and tasks on communication items. Status: implemented.

Exit criteria:

- User can create a topic and attach a call.
- Topic detail shows timeline and structured state.
- Topic suggestions are reviewable.
- Heuristic suggestions are labeled as suggestions, not autonomous AI classification.

## Phase 2.5: Beta GTM Readiness

Scope:

- Android setup checklist.
- First useful handled call activation.
- Agent behavior contract for natural, transparent, policy-aware calls.
- Test-call and forwarding guidance.

Implementation tasks:

- Add `GET /v1/onboarding/status` derived from existing backend state. Status: implemented.
- Add Android first-run onboarding and activation surfaces with checklist/action routing where appropriate. Status: implemented for dedicated onboarding, assistant naming, billing/forwarding entry points, and post-onboarding activation prompts.
- Add Retell dynamic variables for agent behavior, disclosure, privacy, emergency handling, transfer policy, calendar policy, and outcome expectations. Status: implemented.
- Add tests for onboarding status and agent context injection. Status: implemented.

Exit criteria:

- User can see what remains to activate the beta experience.
- User can start forwarding setup, test call, calendar connection, topic creation, and notes from one app surface.
- The agent receives explicit behavior guardrails on every inbound call.

## Phase 2.6: Production Readiness Foundation

Scope:

- Auth and multi-user domain foundation.
- Per-user phone number and Retell mapping.
- Production onboarding state.
- Assistant profile customization and provider-neutral translation into Retell context.
- Frictionless first-run flow: verify phone, name assistant, assign number, configure forwarding, test first call. This must be a dedicated onboarding sequence with bottom navigation hidden, not an activation checklist embedded in Today.
- Self-serve Google Play account bootstrap with paid-resource guardrails.
- Agent eval suite.
- Billing and cost controls.
- Pay-as-you-go monetization with card-on-file and user spending caps.

Implementation tasks:

- Add provider-neutral user configuration with owned phone number, Retell forwarding number, Retell agent ID, live transfer number, plan, usage limits, and onboarding status. Status: implemented for authenticated user config, route lookup, billing state, onboarding state, and assistant profile; remaining work is self-serve provider-number provisioning at scale.
- Add assistant profile model with onboarding-required assistant name plus post-activation defaults for greeting style, disclosure style, warmth, brevity, proactivity, transfer policy, calendar policy, and unknown caller policy. Status: implemented for backend model, onboarding capture, Android editing, and voice-context rendering.
- Add optional Android contact sync and backend contact resolver so first-time callers can be identified from the user's address book. Status: implemented for backend sync/resolution, production Compose contact sync UI, and disconnect/delete controls.
- Replace account bootstrap and per-user API-token auth with Firebase Auth ID-token verification. Status: implemented.
- Remove development-only phone verification fallback. Phone ownership must come from Firebase Phone Auth before assistant-number provisioning. Status: implemented.
- Add Retell number provisioning adapter for purchase/update/list without leaking Retell payloads into the domain. Status: pending.
- Resolve inbound Retell calls by forwarding number instead of hard-coded user ID. Status: implemented.
- Replace single-user onboarding assumptions with user-derived setup state. Status: implemented for Firebase-authenticated users, per-user phone routing, billing state, assistant profile, and onboarding status.
- Remove API-token beta auth from the mobile product path. Client APIs require verified Firebase ID tokens. Status: implemented.
- Add usage ledger and billing guardrails for call minutes, OpenAI classification calls, and monthly limits. Status: implemented for idempotent call-minute/classification usage, local rated spend application, runtime/provisioning gates, and cap-warning notifications; detailed provider SKU/token cost ledger is pending.
- Add billing account, payment method, spending cap, rating, and billing-state gates before paid phone/AI infrastructure. Status: implemented for billing account, hosted card setup, spending caps, active/cap checks, paid side-effect gates, rated usage fields, and local invoice mirror.
- Add agent behavior eval fixtures and script for natural greeting, disclosure, privacy, emergency handling, transfer policy, calendar limits, live-answer behavior, provider/internal-label leakage, and no internal-label leakage. Status: implemented.

Exit criteria:

- The backend can represent more than one user and route calls by assigned Retell number.
- Client APIs have an authentication seam and no longer depend only on `default-user`.
- Onboarding status is based on user configuration and activation state.
- Agent behavior changes can be checked by a repeatable eval script.
- Usage/cost limits are visible and enforced conservatively before expensive actions.

## Phase 2.65: Pay-As-You-Go Billing

Scope:

- Stripe or comparable payment provider integration.
- Billing account model.
- Payment method collection flow.
- Monthly spending cap.
- Usage rating and customer-facing meters.
- Internal provider/model cost ledger.
- Billing webhooks and local invoice mirror.
- Paid-resource gates.

Implementation tasks:

- Add `BillingAccount`, `PaymentMethod`, `SpendingLimit`, `PricePlan`, `BillableMeter`, `CostRateCard`, `UsageEvent`, `RatedUsageEvent`, and `InvoiceMirror` domain models. Status: partial; `BillingAccount`, payment method summary, spending cap, rated usage fields, local spend application markers, and invoice mirror domain/persistence are implemented.
- Add Stripe customer creation and hosted/native payment method collection. Status: implemented for hosted setup sessions; native mobile PaymentSheet is pending.
- Add `GET /v1/billing/account`, `POST /v1/billing/checkout-session`, `POST /v1/billing/customer-portal`, `PATCH /v1/billing/spending-limit`, and `GET /v1/billing/invoices`. Status: implemented for provider-backed account, checkout session, portal session, spending-limit, activation, usage, and invoice listing APIs.
- Add `POST /webhooks/billing/stripe` with signature verification and idempotency. Status: implemented for core payment-method, invoice-state, and subscription events with a durable webhook event ledger.
- Add Stripe catalog configuration for the Personal monthly plan and tiered overage price. Status: implemented with `npm run stripe:configure-catalog`.
- Add idempotent Personal subscription activation after payment method plus spending cap. Status: implemented.
- Add Stripe Billing Meter event publisher for assistant call minutes and AI processing units. Status: partial; assistant call minute meter publishing is implemented, while AI processing remains internally tracked until it becomes customer-facing.
- Add rating service for Personal plan, included assistant minutes, overage assistant minutes, and internal AI processing units. Status: implemented for assistant-call overage rating, idempotent local spend application, estimated internal call-minute cost, classifier request cost, usage summary financials, and Stripe meter publishing for call minutes. Remaining work is detailed provider SKU/token rate cards.
- Add internal cost recording for voice minutes, telephony minutes, model tokens, classifier requests, and tool calls. Status: partial; call-minute and classifier estimated costs are recorded, detailed STT/TTS/telephony/model-token SKU cost events are pending.
- Gate assistant number assignment on payment method plus spending cap for public users. Status: implemented for active billing and current-period cap checks.
- Add cap warning and cap reached notification events. Status: implemented for privacy-safe `50%`, `80%`, and cap-reached billing issue notifications from the local rated usage ledger.
- Add Android billing onboarding screen before assistant number assignment. Status: in progress.
- Add billing settings screen with current spend, cap, payment method, invoices, and pause/cancel actions. Status: partial; billing entry and card/cap status are implemented, while invoice detail, pause, and cancel flows remain pending.

Exit criteria:

- Public users must add a card and set a cap before paid infrastructure is provisioned.
- Usage is recorded idempotently before payment-provider meter events are sent.
- Users can see current spend and cap in the app.
- Paid usage pauses or degrades gracefully when cap or payment state blocks it.
- Billing UI uses customer-friendly labels and does not expose provider/model names by default.

## Phase 2.66: Production Billing And Webhook Hardening

Scope:

- Provider webhook idempotency and replay-safe processing.
- Subscription race prevention and local billing mirror correctness.
- Spending-cap enforcement before paid side effects.
- Billing observability, reconciliation, and operator recovery.

Implementation tasks:

- Add a durable `WebhookEventLedger` for Stripe and other provider events. Status: implemented for Stripe billing webhooks and Retell call event webhooks.
- Process each provider webhook event ID exactly once, returning success for duplicate delivered events after the original succeeds. Status: implemented for Stripe billing webhooks and Retell analyzed/lifecycle events.
- Persist failed webhook processing attempts with error codes so operators can retry safely. Status: implemented with sanitized error metadata.
- Ensure subscription creation uses provider idempotency keys and cancellation events for stale duplicate subscriptions cannot overwrite the active subscription. Status: implemented for Stripe Personal subscriptions.
- Add a billing reconciliation command that compares local `BillingAccount` state against Stripe customers/subscriptions/invoices. Status: partial; `npm run billing:reconcile` checks local accounts against Stripe customers and Personal subscriptions.
- Add local invoice mirror and `GET /v1/billing/invoices`. Status: implemented for invoice mirror domain/persistence, Stripe invoice webhook mirroring, sanitized invoice listing, and provider fallback when no mirror exists yet.
- Enforce monthly spending caps in the billing policy before assistant-number assignment, live assistant runtime, outbound calls, and future paid message/document actions. Status: partial; assistant-number assignment, inbound runtime, outbound call creation, and Retell tool side effects are gated by active billing and cap checks; future paid message/document gates are pending.
- Add cap warning and cap-reached notification events. Status: implemented for proactive threshold warnings and cap-reached notifications through `NotificationEvent`.

Exit criteria:

- Stripe webhook duplicate delivery cannot create duplicate subscriptions, duplicate local state transitions, or duplicate usage charges.
- A canceled duplicate subscription cannot mark a user inactive when another Personal subscription is active.
- Operator can inspect webhook processing status without reading raw provider payloads.
- Paid provider side effects are blocked when billing is inactive, past due, canceled, or over cap.
- Billing failures are recoverable without manual Firestore edits.

## Phase 2.67: Multi-User Safety And Go-Live Hardening

Scope:

- Enforce authenticated user boundaries on every user-facing read.
- Keep paid provider actions scoped to the authenticated user and assigned assistant number.
- Make calendar OAuth, calendar writes, call history, and product analytics production-safe for many users.
- Replace per-instance abuse controls with shared infrastructure where possible.
- Keep consumer UI free of backend provider names.

Implementation tasks:

- Scope Google Calendar OAuth connections, free/busy checks, create/update requests, and activity lists by `userId`. Status: implemented.
- Sign Google OAuth state with an HMAC and reject callbacks without verified state. Status: implemented.
- Scope call history to the authenticated user's assigned assistant number at the repository/query layer. Status: implemented.
- Keep Retell/voice-provider tool calls from reading calendar state unless `phone_agent_user_id` is present in call context. Status: implemented.
- Add `ProductAnalyticsEvent` domain model, repository abstraction, Firestore persistence, client ingestion endpoint, Android event capture, privacy validation, warehouse-friendly export path, dashboard spec, and starter BigQuery views. Status: implemented.
- Add durable Firestore-backed rate limit buckets for production Cloud Run deployments, with in-memory fallback for local/test. Status: implemented.
- Update environment configuration for `PERSISTENCE_DRIVER`, rate limits, and `GOOGLE_OAUTH_STATE_SECRET`. Status: implemented.
- Add regression tests for analytics privacy validation, route-scoped call history, OAuth state enforcement, and existing rate limits. Status: implemented.

Exit criteria:

- One user's calls, calendar connection, calendar activity, analytics, notes, topics, and live actions cannot appear in another user's app session.
- OAuth account linking requires a signed, unexpired user-scoped state.
- Abuse controls work across scaled backend instances when Firestore persistence is enabled.
- Engagement telemetry supports product decisions without storing communication content.
- Backend route ownership starts moving out of `src/app.ts` without changing public URLs. Status: implemented for shared route helpers, client validation schemas, billing routes, Stripe billing return pages, analytics ingestion, notifications, topics, contacts/callers, calendar, onboarding, communication, calls, live actions, agent notes, and Retell raw-body webhook/tool routes with dedicated raw-body/signature tests.

## Phase 2.7: Production Mobile UX Facelift

Scope:

- Establish the mobile UX blueprint as the source of truth for Android screens and flows.
- Redesign the app around the ideal product IA: Topics, Inbox, Home, Assistant, and Search, with Home as the default center tab.
- Retire the prototype Java view hierarchy and keep the Android UI foundation in Kotlin and Jetpack Compose.
- Make topic threads the durable product surface and Inbox the review/recent activity surface.
- Add production-quality empty, loading, offline, stale, error, and deep-link states.
- Improve setup, forwarding, assistant notes, calendar, people memory, topic detail, communication detail, and live-call action flows.
- Add an Android Room source-of-display cache so authenticated product state can render quickly on launch and remain navigable when the backend refresh is slow or unavailable.

Implementation tasks:

- Create `docs/mobile-ux-blueprint.md`. Status: implemented.
- Add Kotlin and Jetpack Compose to the Android project. Status: implemented.
- Remove the legacy Java Activity from the production Android app. Status: implemented.
- Add a Compose launcher activity with a reusable app shell, top bar, assistant presence control, atmospheric background, and five-item bottom navigation. Status: implemented.
- Add Hilt, Retrofit, OkHttp, ViewModel, and StateFlow as the Android production architecture foundation. Status: implemented for application graph, backend API client, repository boundary, extracted app-state ViewModel, named repository mutation commands, typed Android request models, typed response envelope parsers, and notification-action API posts.
- Keep Android framework integrations out of the app shell where practical. Status: implemented for contact-provider reads, product analytics, Firebase phone auth/onboarding, billing browser launch, FCM registration, and contact-sync orchestration through focused readers/coordinators while keeping Activity as the callback host.
- Add focused Android screen ViewModels for major surfaces. Status: implemented for Home, Assistant/live-call, Billing, Contacts, and Onboarding derived state/surface commands while the app-level `PhoneAgentViewModel` remains the shared source of truth.
- Replace ad hoc Android screen construction with reusable Compose shell and UI components. Status: implemented for core shell, cards, rows, buttons, fields, chips, detail frames, error states, centralized Material 3 theme tokens, extracted shared Compose components, extracted screen composables, and extracted Compose previews.
- Add Room-backed local cache for user summary, onboarding, billing, topics, calls, topic suggestions, notifications, and active-call snapshot. Status: implemented for schema, Compose startup hydration, repository-owned `AppSnapshot` cache hydration/persistence, cached snapshot freshness timestamps, and user-visible stale/offline labels.
- Apply compact-density UI pass across the Compose app shell and shared components. Status: implemented; current density uses `16dp` gutters, `10dp` feed gaps, `12dp` card padding, shorter topic imagery, compact quick-action grids, slimmer search chips, and `44-46dp` primary controls while preserving accessible tap targets.
- Add icon-based bottom navigation with accessible labels. Status: implemented.
- Build production Home dashboard with recent calls, call actions, and horizontally browsable topic cards. Status: implemented for the Compose launcher.
- Build production Inbox/Review with review queue and filters. Status: implemented for review queue, richer filters, compact call rows, call detail parity, and clearer calls-to-organize workflows; future channel-specific filters remain planned with cross-channel ingestion.
- Build production Topics list and topic detail. Status: implemented for image-led topic list and basic topic detail; structured edit/correction controls are pending.
- Build production Live control surface. Status: implemented for active-call status, assistant metrics, and live answer/transfer card parity for pending live requests.
- Build production assistant notes flow. Status: implemented for general, caller-scoped, and topic-scoped note creation plus note listing/archive.
- Build production Profile/Settings surface opened from the header presence/avatar control. Status: implemented for account identity, assistant, forwarding, billing, calendar, notifications, privacy, diagnostics, and logout; deeper nested management screens remain pending.
- Add first-party privacy-safe product analytics from Android into backend `ProductAnalyticsEvent` records. Status: implemented for session/action/screen events, high-fidelity safe attributes, backend validation, tests, `npm run analytics:export`, dashboard spec, and starter BigQuery views; managed dashboard deployment is pending.
- Add Compose previews and fixture states for the core screens. Status: implemented for Home, Topics, Review, Assistant, Search, Topic detail, Call detail, Forwarding, and Add note.
- Add Android unit tests for display/snapshot/request model behavior. Status: initial pure Kotlin coverage implemented for call rows, topic summaries, contact status, forwarding digits, corrupted cache parsing, contact sync serialization, and analytics sanitization.
- Add screenshot/golden testing after the first Compose component set stabilizes. Status: partial; deterministic Compose fixture state exists and Android instrumentation screenshot tests now enforce numeric baselines across core screens. Checked-in image goldens remain pending.
- Add screenshot-based QA across representative Android viewports. Status: partial; connected-device screenshot instrumentation covers Home, Topics, Review, Assistant, Search, Topic detail, Call detail, and Forwarding on the paired Samsung device. Emulator/tablet/foldable viewport matrix remains pending.

Exit criteria:

- The Android app feels consumer-ready and no longer like an internal admin/debug shell.
- Every primary screen has clear hierarchy, recovery states, and production copy.
- Live-call and notification flows route reliably to the correct user action.
- Topic threads are visually and behaviorally central to the app.

## Phase 3: AI Topic Classification

Scope:

- Classify new communication items into existing/new topics.
- Extract facts, tasks, decisions, and open questions.
- Detect conflicts with prior thread state.
- Generate recommended next actions.

Implementation tasks:

- Define structured classifier output schema.
- Add model/prompt versioning.
- Add evidence references to extracted state.
- Add confidence thresholds and review workflow.
- Add conflict records.
- If the LLM classifier is unavailable, times out, or returns unusable output, leave the communication unassigned for manual review.

Exit criteria:

- AI can suggest topic attachment and explain evidence.
- Extracted decisions/questions/tasks are structured and editable.
- Conflicts are visible but conservative.

## Phase 4: Cross-Channel Ingestion

Scope:

- Add email ingestion.
- Add SMS ingestion.
- Add document/attachment references.
- Normalize everything into communication items.
- Improve thread timeline.

Implementation tasks:

- Add email provider abstraction and first Gmail ingestion spike.
- Add SMS provider abstraction and first viable ingestion path.
- Add document reference model and attachment metadata.
- Add channel filters in inbox and topic timeline.

Exit criteria:

- At least two non-call channels produce communication items.
- Topic timeline can mix channels coherently.

## Phase 5: Interruption Engine

Scope:

- Rules by caller/contact.
- Rules by topic.
- Rules by urgency.
- Rules by pending decision.
- Live decision cards.
- Warm transfer decisions.
- Productized notification events, privacy-safe payloads, expiration, action routing, and in-app notification history.

Implementation tasks:

- Add interruption policy model.
- Add topic-based rules and deadline/pending-decision conditions.
- Add decision cards in Android.
- Add audit reasons for every interruption decision.
- Add `NotificationEvent` and `NotificationPreference` models.
- Generate notification events for transfer approval, live answer, call summary, topic suggestion, calendar change, setup issue, and provider health issue.
- Add Android notification center/history and deep links.
- Add authenticated Android FCM token registration and backend FCM delivery for privacy-safe data-only push notifications. Status: implemented for Android.
- Add Android background notification actions for transfer approval, inline live-answer reply, duplicate-tap protection, expired-state feedback, and notification dismissal/replacement. Status: implemented.
- Add notification state sync, action audit records, per-notification delivery attempts, and Android crash reporting. Status: implemented.
- Add privacy tests proving default notifications do not expose transcripts, assistant notes, or sensitive content.

Exit criteria:

- The system can interrupt based on topic context, not only caller identity.
- User can review why an interruption happened.

## Phase 6: Shared Topic Threads

Scope:

- Share recap via SMS/email/web link.
- Participant access to selected thread artifacts.
- Permissioned updates from external participants.
- Audit logs.

Implementation tasks:

- Add `TopicShare` and scoped access tokens.
- Add share artifact generation.
- Add external reply/update endpoint with narrow permissions.
- Add revoke/expire controls.
- Add audit UI surface.

Exit criteria:

- External participant can receive and update a scoped artifact without app install.
- User can see and revoke access.

## Phase 7: Agent-To-Agent Protocol

Scope:

- Define structured agent message format.
- Topic-scoped agent handshakes.
- Permissioned requests/responses.
- Approval workflow.
- Future compatibility with open agent protocols where appropriate.

Implementation tasks:

- Add agent identity model.
- Add signed structured message envelope.
- Add agent-message provider adapter.
- Add policy checks for topic-scoped access.
- Add human approval flow for high-impact requests.

Exit criteria:

- Agent messages are communication items.
- Agents can request topic-scoped actions without seeing unrelated user data.
- Approval and audit behavior is enforceable.
