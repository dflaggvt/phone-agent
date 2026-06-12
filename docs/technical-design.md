# Technical Design

## System Overview

Phone Agent is a cloud-native, Android-first communication intelligence platform. The initial production path remains forwarded phone calls through Retell, but the durable architecture is cross-channel: every call, SMS, email, document, calendar event, manual note, and future agent-to-agent exchange is normalized into a `CommunicationItem` and optionally attached to a `TopicThread`.

The backend is the system of record. It owns topic memory, communication items, identities, permissions, user rules, summaries, decisions, open questions, tasks, audit logs, and workflow outcomes. Retell is initial voice infrastructure, not the domain core.

The first implementation should remain a modular monolith on Node.js/TypeScript/Express with clear domain boundaries, durable persistence, provider adapters, event-driven seams, and tests. Services can be extracted later when scale, compliance, or team ownership requires it.

## Major Components

- Android app: communication inbox, topic threads, active call surface, call history, decisions, tasks, calendar activity, rules, and settings.
- Client API: authenticated APIs for Android and future iOS/web clients.
- Provider webhook APIs: Retell now; future SMS, email, calendar, document, and agent-message providers.
- Provider abstraction layer: normalizes vendor payloads into domain events and communication items.
- Communication ingestion service: creates and updates `CommunicationItem` records.
- Topic thread service: creates, updates, merges, splits, and retrieves persistent topic threads.
- Topic classification service: assigns communication items to existing or new topics with confidence and evidence.
- Extraction service: facts, tasks, decisions, open questions, deadlines, conflicts, summaries, and suggested actions.
- Interruption engine: decides whether to silently record, notify, request answer, request decision, or transfer live.
- Identity and participant service: users, contacts, callers, external participants, agent identities, and topic-scoped roles.
- Permission service: thread, participant, channel, artifact, and action authorization.
- Sharing service: permissioned recap, request, task, document, and decision artifacts via SMS/email/web links.
- Voice runtime service: Retell-backed live call handling with replaceable voice provider interfaces.
- Calendar service: free/busy and assistant-owned calendar writes with notifications and audit.
- Audit and retention service: immutable logs, data retention, deletion, and policy evidence.

## Backend Services

Logical modules:

- `identity`: users, devices, sessions, contacts, external identities.
- `providers`: voice/SMS/email/calendar/document/agent provider adapters.
- `communications`: generic communication items and raw-content references.
- `topics`: topic threads, timeline, participant links, status, and memory.
- `topic-classification`: topic suggestions, confidence, conflict detection, and extraction.
- `voice`: inbound call state, Retell webhooks, transfer, live answer, transcripts.
- `calendar`: free/busy, assistant-created events, update allow-list, calendar activity feed.
- `permissions`: participant/thread/channel/artifact access rules.
- `sharing`: permissioned artifacts and external replies.
- `notifications`: push/local notifications, decision cards, calendar change notifications.
- `billing`: payment provider integration, billing account state, pricing configuration, usage rating, spending caps, invoices, and paid-action gates.
- `audit`: access logs, AI decisions, policy decisions, sharing events, retention events.

Each module should own its repository interfaces. Vendor payloads may be retained by reference for audit/debugging, but domain services must not depend on vendor-specific schemas.

## Mobile App

Ideal production primary bottom-navigation destinations:

- Home: default destination for horizontally browsable topic cards, recent calls, call actions, and entry points into all topics, call history, and search. Home may show one compact assistant-needs signal when action items are waiting, but it should not render review cards or passive notification history.
- Assistant: action center for live-call control, live answer/transfer requests, topic suggestions, review/action items, assistant notes, test call, and immediate assistant activity. It should not duplicate profile, billing, broad settings, forwarding setup, contacts, full call history, or long-term topic management.
- Profile: account identity, assistant identity, forwarding, billing, calendar, contacts, notification preferences, privacy, support, diagnostics, and logout.

Topics, Review/Needs Review, Search, and Inbox/history remain production surfaces, but they are drill-ins or utilities rather than permanent bottom-navigation destinations. Review/action cards surface primarily on Assistant; Home only links to Assistant with a compact count when needed. Logout must confirm intent, sign out of Firebase, clear Room cache for the signed-out user, and return to first-run auth.

Recent calls should follow familiar phone-recents ergonomics: compact rows with caller, number or relationship, timestamp, and direct actions. Summaries stay in detail views and topic memory rather than bloating the call row.

Topic detail should show:

- Timeline.
- Participants.
- Latest updates.
- Decisions made and pending.
- Open questions.
- Tasks.
- Documents.
- Suggested actions.
- Related communications.
- Share/invite controls.
- Permissions and audit-visible sharing history.

The app should feel calm, minimal, and executive. It should not feel like a call center dashboard.

Android implementation direction:

- The production Android app should use Kotlin and Jetpack Compose.
- The Android client is Kotlin + Jetpack Compose only. The previous Java `Activity` view hierarchy has been retired and must not be reintroduced as a user-facing path.
- Android app architecture is MVVM: Compose screens render immutable UI state, `ViewModel` classes own screen/application state through `StateFlow`, repositories coordinate backend/cache operations, and Android framework APIs remain in Activity/service/receiver adapters.
- Compose should own the consumer app shell, navigation, screen layouts, state rendering, error/loading states, and reusable mobile design system components.
- Hilt is the dependency-injection boundary for Android. It provides application-scoped API clients, repositories, Room database access, Firebase services where injectable, and ViewModels. New production code should not manually instantiate backend clients or databases inside Activities.
- Retrofit plus OkHttp is the Android REST stack. Backend API calls should go through typed or centrally wrapped Retrofit services with consistent authorization headers, action-surface headers, timeouts, error handling, and JSON parsing. New code should not use raw `HttpURLConnection` for app API calls.
- Kotlin coroutines and `StateFlow`/`SharedFlow` are the async and stream primitives for UI state, one-shot UI events, and repository operations.
- Android-native integrations remain first-class: Firebase Phone Auth, FCM, notification actions, contacts permission, dial intents, app links, browser/payment return flows, Crashlytics, and future Play Billing or platform APIs where needed.
- Compose UI state should be driven by authenticated backend APIs and privacy-safe FCM refresh events. The app should not reintroduce periodic polling as a fallback for live call state.
- Room is a source-of-display cache, not the source of truth. Schema changes require explicit migrations or a deliberate cache reset path; debug and release builds must not use destructive migration fallback.
- UI fixtures and Compose previews should be used for pixel review, with screenshot/golden tests added as the design system stabilizes.

Current Android module boundaries:

- `ComposeActivity` owns Android integration edges only: runtime permission decisions, dial/browser intents, push refresh broadcasts, lifecycle routing, and app-shell action wiring. Firebase phone verification, first-run assistant naming, billing browser launch, FCM registration, contact sync, and analytics are delegated to focused coordinators or injectable collaborators.
- `PhoneAgentViewModel` owns authenticated app state through `StateFlow`, snapshot hydration/refresh, and cross-screen mutations. Focused screen ViewModels wrap this shared state for major surfaces such as Home, Assistant/live call, Billing, Contacts, and Onboarding so screen logic can evolve without expanding the Activity.
- Screen ViewModels should expose derived state and screen-specific commands; they should not duplicate the backend cache, bypass `PhoneAgentRepository`, or become independent sources of truth.
- `PhoneAgentRepository` owns authenticated `AppSnapshot` loading, endpoint-specific response parsing, Room cache reads/writes, and named mutation commands such as contact sync, assistant profile update, topic creation, agent note creation, billing activation, push token registration, and product analytics submission.
- `PhoneAgentRequests` owns provider-neutral Android request models and the narrow JSON serialization required by the existing backend contract. Compose screens and Activity action handlers should not construct endpoint-specific JSON bodies.
- `PhoneAgentResponses` owns typed Android response parsers for backend envelope shapes. Repository code should ask those parsers for display/domain models rather than scattering `optJSONObject` and `optJSONArray` response parsing through app code.
- `AndroidContactReader` owns Android `ContactsContract` access and transforms device rows into privacy-limited `DeviceContactInput` records. Activity code should only request permission and call the reader.
- `PhoneAgentAnalyticsTracker` owns session IDs, event sequencing, safe Android build/device metadata, Firebase ID token retrieval, and privacy-safe analytics submission. UI code should call named tracking operations and never build analytics payload JSON directly.
- `PhoneOnboardingCoordinator` owns Google sign-in handoff, email/password Firebase Auth, Firebase Phone Auth callback orchestration for protected-number verification, password reset, and assistant-name completion because those steps require an Activity surface. Account creation and login support Google and email/password; phone OTP links the protected mobile number to the already authenticated Firebase user and must never create or switch into a phone-only account.
- `BillingCoordinator`, `FcmRegistrationCoordinator`, and `ContactSyncCoordinator` own browser/payment launch, FCM token registration, and Android contact-sync orchestration respectively.
- `PhoneAgentState` owns provider-neutral UI state, navigation state, tab definitions, display models, and JSON-to-display adapters.
- `PhoneAgentScreens` owns the app shell, first-run screens, primary tabs, detail screens, profile/settings, forwarding, billing, and contact-sync UI.
- `PhoneAgentComponents` owns reusable Compose product components such as work cards, call rows, topic image cards, buttons, chips, form fields, settings rows, and compact list scaffolding.
- `PhoneAgentPreviews` owns preview fixture state and screen previews for design review, while instrumentation screenshot tests own deterministic device screenshots and later golden comparisons.
- Remaining Android cleanup should promote backend response parsing from manual JSON adapters toward generated or typed DTOs where it meaningfully improves safety, and add focused screen ViewModels where individual surfaces grow beyond simple rendering, rather than expanding `ComposeActivity`.

Backend route organization:

- `src/app.ts` remains the composition root for infrastructure construction, middleware order, global parsers, rate limiters, and route registration.
- Shared Express helpers, auth middleware, redaction helpers, and validation schemas should live under `src/routes/*` once they are reused by more than one route group.
- Stable client route groups should be registered from route modules instead of continually expanding the app composition root. Billing, analytics, notifications, topics, contacts/callers, calendar, onboarding, communication, calls, live-action, and agent-note routes belong in modules with dependency injection from `createApp`.
- Raw-body provider webhooks and live voice tool routes should also live in focused route modules once their signature and raw-body parsing behavior has dedicated contract coverage. The Retell route surface now lives in `src/routes/retellRawRoutes.ts` and receives the provider rate limiter, raw JSON parser, webhook verifier, billing gate, live-action services, and calendar tool service from `createApp`.
- Route modules may depend on application services and repository interfaces, but they must not instantiate provider clients, persistence drivers, or global infrastructure.
- Route extraction should preserve existing URL contracts and tests; it is an internal organization change, not a public API change.
- Future provider routes with signature verification must add contract tests before moving parsing, verification, or side-effect behavior.

Android local cache:

- The backend remains the system of record for user identity, topics, communications, billing, notifications, live calls, permissions, and assistant state.
- The Android app should use Room as a local source-of-display cache for authenticated product state: current user summary, onboarding status, billing summary, topics, recent calls, review suggestions, unread notification summaries, and the latest active-call snapshot.
- Room is not an offline authority. It must not independently decide routing, billing eligibility, sharing, calendar writes, paid side effects, transfer approval, or live answer state.
- Cached rows should store provider-neutral display fields plus the sanitized backend JSON snapshot needed to reconstruct Compose state. Raw provider payloads, secrets, card data, raw contact books, and unrestricted transcripts should not be expanded into local tables.
- App launch should hydrate the UI from Room first when an authenticated user has cached data, then perform a source-of-truth refresh from the backend. FCM data messages, notification actions, app launch, explicit refresh, and navigation-triggered refreshes update Room after successful API reads.
- Cached snapshots should include a `cachedAt` timestamp and a `freshness` label. Live surfaces become stale after `5m`; historical surfaces become stale after `30m`. Startup refresh failures must preserve the cached app shell and show a recoverable stale/offline label instead of replacing the app with setup failure.
- Logout must clear the local Room cache for the signed-out user. Future multi-account support should partition Room records by authenticated user ID before multiple signed-in accounts are allowed on one device.
- Room migrations must be explicit. Destructive migration is not used in debug or release; cache resets require an intentional reviewed path because local state affects user trust during startup.

Setup state is derived server-side from existing system state so future iOS/web clients can share the same activation logic. Required activation should stay intentionally short: authenticated account, verified phone number, assistant name, assigned assistant number, forwarding guidance/test call, and first useful handled call. Calendar connection, topic creation, assistant notes, relationship tuning, and deeper voice behavior are progressive setup after activation.

Android first-run onboarding should consume the shared setup state but present it as a dedicated guided flow rather than a checklist inside the main app shell. The auth entry supports Firebase Google sign-in and Firebase email/password for account creation and login, with Firebase Phone Auth reserved for protected-number verification after authentication. The client must present separate `Create account` and `Log in` paths. `Create account` establishes the Firebase/user account through Google or `createUserWithEmailAndPassword` and then routes into onboarding. `Log in` restores an existing account through Google or `signInWithEmailAndPassword` and must not silently create a new Firebase user; if Firebase reports `additionalUserInfo.isNewUser` on the federated login path, the app must clean up that accidental auth user when possible, sign out, and ask the user to create an account. Conversely, an existing account encountered from the create path should be sent to login rather than treated as a new setup. Email/password errors must be translated into product-owned copy such as invalid email, weak password, account already exists, or email/password incorrect. Phone OTP is used only for protected-number verification after an authenticated account exists, not account creation or returning-user login. Google or email/password creates or opens the account, while phone verification links the protected mobile number to the same Firebase user. After phone linking succeeds, Android must force-refresh the Firebase ID token before loading setup state so the backend receives the trusted `phone_number` claim immediately. The backend must preserve an already verified protected number when later Firebase ID tokens omit the phone claim, because provider refresh tokens do not always restate linked phone data. The protected mobile number is the account-recovery anchor for the phone product, but the client must not silently switch to a separate phone-only Firebase account when a phone credential is already attached elsewhere. That collision should produce a product-owned recovery/support state until explicit account merge is implemented. Until account, phone verification, assistant name, assistant number, and forwarding instruction viewing are complete, launch should route to the next onboarding screen with bottom navigation hidden. The final test-call and first useful-call review can continue as post-onboarding activation prompts because they depend on external carrier forwarding and real inbound call behavior.

Legacy beta accounts may have product state split across a phone-auth Firebase user and a later Google-auth Firebase user. The backend must not automatically merge those accounts by display name, email absence, or phone-routing similarity because that would create an account-takeover risk. Support-led merges must be explicit: copy verified protected-number state, assistant routing, billing state, topic/call/user-owned records, notification tokens, and relevant memory from the legacy account to the Google account; then disable routing on the legacy account so inbound calls resolve to exactly one active user.

When an authenticated session is completed from login, account creation, phone verification, or account recovery, the Android client must clear local Room display cache before fetching the signed-in user's backend state. Cached state is only safe for a known current Firebase user on app startup; it must not survive account switching or be shown during a new login handoff.

The detailed mobile screen and flow contract is maintained in `docs/mobile-ux-blueprint.md`. Android implementation should follow that blueprint for navigation, primary and nested screens, live-call action states, notification deep links, empty/error states, accessibility, and screenshot-based QA.

## Voice Provider Integration

Retell is the Phase 1 voice runtime. It handles live dialog, speech, transcript, call events, tools, and warm-transfer mechanics while Phone Agent owns context, routing, topic memory, and outcomes.

Required voice concepts:

- Existing mobile number forwarding to an AI-controlled number.
- Conditional forwarding and unconditional forwarding.
- Programmable voice webhooks.
- Inbound call context injection.
- Call lifecycle events.
- Live call state.
- Warm transfer / bridge-to-user.
- Recording and transcription.
- Real-time AI conversation loop.
- Latency-sensitive voice pipeline.

Retell must remain behind a provider adapter. Future replacements include Twilio, Telnyx, Vonage, SIP, OpenAI Realtime, Twilio ConversationRelay, or a custom STT/LLM/TTS pipeline.

## Provider Abstractions

Voice provider interfaces should expose normalized domain types:

- `VoiceProvider`
- `VoiceCallEvent`
- `VoiceTranscriptEvent`
- `VoiceCallRecordingEvent`
- `VoiceInboundContextRequest`
- `VoiceTransferRequest`

Cross-channel providers should follow the same pattern:

- `SmsProvider`
- `EmailProvider`
- `CalendarProvider`
- `DocumentProvider`
- `AgentMessageProvider`

Adapters convert provider payloads into `CommunicationItem` creation/update requests and domain events. Domain modules should never require Retell, Gmail, Google Calendar, Twilio, or Slack payloads directly.

## AI Agent Runtime

The agent runtime should receive compact, permission-filtered context:

- Caller identity and relationship.
- Relevant topic thread summaries.
- Active decisions and open questions.
- Relevant tasks and deadlines.
- User-authored notes.
- Topic-level red lines and permissions.
- Interruption policy hints.
- Agent behavior contract: natural speaking style, disclosure, privacy limits, emergency handling, transfer/live-answer policy, calendar policy, and outcome expectations.

The live agent may ask questions and call backend tools, but backend policy decides whether actions are allowed. The agent should not autonomously share sensitive information, update non-owned calendar events, create durable memory, or expose thread context to external participants without policy approval.

Retell receives these controls as dynamic variables so the behavior can be evolved without coupling the domain to Retell. Future voice runtimes should receive the same provider-neutral context pack.

## Topic Classification

Every new communication should be classified:

- Who is involved?
- What is this about?
- Does it belong to an existing topic?
- Should a new topic be created?
- What facts were learned?
- Were decisions made?
- Were tasks or deadlines created?
- Are there conflicts with prior thread state?
- Does the user need to be interrupted?

Classification output must include confidence, evidence references, model version, and suggested action. Low-confidence attachments should be suggestions, not automatic mutations.

## Communication Item Model

Core fields:

- `id`, `userId`, `channel`, `direction`, `sourceProvider`, `providerItemId`.
- Sender/caller and recipients/participants.
- `occurredAt`, `receivedAt`, and optional start/end timestamps.
- Raw content reference and normalized body/transcript text.
- Summary.
- Extracted facts, tasks, decisions, open questions, deadlines, conflicts.
- Topic associations with confidence and attachment mode.
- Sensitivity, consent, retention, and sharing flags.
- Audit metadata.

Supported channels should include `phone_call`, `sms`, `email`, `calendar_event`, `document`, `manual_note`, and `agent_message`.

## Topic Thread Model

Core fields:

- `id`, `userId`, `title`, `description`, `status`.
- Participants and related contacts.
- Communication item references.
- Decisions made and pending.
- Open questions.
- Tasks.
- Documents.
- Facts and memory.
- Conflicts/inconsistencies.
- Suggested next actions.
- Permissions and sharing rules.
- Confidence scores for automatic attachments.
- Retention and audit metadata.

Topic threads are the main product object and a primary security boundary.

Topic API responses used by mobile clients should include compact, provider-neutral timeline rows for attached communication items. The backend remains the source of truth for topic-to-communication attachment; clients should not infer timeline membership from caller names, summaries, or timestamps. A topic with attached communication IDs should not render as having no communications merely because the client did not separately hydrate each communication item.

## Decisions, Open Questions, And Tasks

Structured topic state should be stored separately from summaries:

- `Decision`: status, selected option, options considered, required approvers, source evidence, deadline.
- `OpenQuestion`: question, owner, status, due date, answer, source evidence.
- `Task`: title, assignee, status, due date, source evidence, completion metadata.
- `Conflict`: claims, sources, severity, recommendation, resolution status.

The system should preserve original wording when useful and avoid inventing commitments.

## Permission Model

Permission layers:

- User-owned data boundary.
- Thread-level access.
- Participant role: owner, participant, viewer, contributor, external agent.
- Channel-level restrictions.
- Artifact-level sharing.
- Action permissions for create, update, comment, share, request approval, and agent-to-agent messages.
- Sensitive information policy.

Topic threads are permission boundaries. A participant in Basement Project cannot access Family Medical or Work Recruiting.

## Sharing And Viral Loop

Sharing must be permissioned, useful, transparent, and trust-building.

Supported artifacts:

- Call recap.
- Thread summary.
- Decision request.
- Task list.
- Shared follow-up.
- Approval request.
- Document request.

External participants may receive SMS/email/web links scoped to one artifact or one thread. They should be able to reply or update within the granted scope without installing the app. The product may later invite them to create their own Phone Agent, but sharing must not be manipulative or spammy.

## Agent-To-Agent Design

Future agent messages should be structured and topic-scoped:

- Topic ID or topic descriptor.
- Intent.
- Participants.
- Facts and requested action.
- Cost/schedule/risk impact.
- Required human approval.
- Attachments.
- Provenance.
- Expiration/deadline.

Agent handshakes must verify identity, authority, topic scope, and permissions before any thread context is disclosed.

## Authentication And Authorization

Production requirements:

- OIDC-compatible authentication.
- Verified phone number ownership.
- Device-bound refresh tokens.
- Role/policy-based authorization.
- Signed provider webhook verification.
- External participant magic links or passkeys with narrow scopes.
- Agent-to-agent authentication and signed messages when protocol support exists.

Every user-owned resource needs authorization tests before production exposure.

Current production-readiness foundation:

- `UserConfig` stores user-owned phone configuration, Retell mapping, onboarding state, and billing limits.
- `AssistantProfile` stores durable user-facing assistant behavior preferences. Retell receives a provider-specific rendering of this profile, but the application owns the canonical profile.
- Retell inbound calls are resolved by the called forwarding number so one backend can serve multiple users.
- Android client APIs use Firebase ID tokens from Google sign-in, email/password auth, and protected-number phone verification. The backend verifies tokens with Firebase Admin and derives user identity from the verified Firebase `uid`.
- User ID is resolved from auth context for client APIs and from phone-number routing for provider webhooks.
- `CallerProfile` and `CallerMemory` records are user-scoped. Lookups for caller name, relationship, trust level, and prior-call memory must include `userId` plus caller phone number so one user's contact labels cannot leak into another user's assistant context.
- Voice dynamic variables such as `caller_name`, `caller_context`, `caller_relationship`, and `opening_line` must be rendered from user-scoped caller memory or explicit call/user-note context. Provider adapters must not contain hard-coded caller names.
- `Contact` records are user-scoped identity hints synced from the mobile address book after explicit Android Contacts permission. They include display name, normalized phone numbers, labels, and source metadata, but not call summaries or inferred memory.
- Android contact sync is implemented in the production Compose launcher. The client requests `READ_CONTACTS` only after the user taps the Phone contacts sync action, reads `ContactsContract.CommonDataKinds.Phone`, groups rows by Android contact ID, and sends only `source=android_contacts`, `sourceContactId`, `displayName`, and phone number/label pairs to `POST /v1/contacts/sync`. The client must not upload email addresses, postal addresses, notes, photos, organizations, birthdays, contact groups, or raw device contact payloads.
- Contact sync status is loaded through `GET /v1/contacts/status` and rendered as a channel state in Assistant and Profile/Settings. The production repository stores this as a per-user aggregate status document written during sync so app startup does not scan all synced contacts. Runtime status lookups must not perform best-effort collection-scan migrations; older data should be corrected by an explicit operator migration or by the user resyncing contacts.
- Product analytics may record permission outcomes and aggregate counts, but never contact names, phone numbers, labels, or raw payloads. If Android's contacts provider is unavailable or returns an unsupported schema, the client must fail the sync instead of uploading an empty list that would erase previously synced contacts.
- Inbound caller resolution uses synced `Contact` records as the authoritative display-name source when a phone number matches the user's address book. `CallerProfile`/`CallerMemory` may still provide relationship, trust level, prior-call count, summaries, facts, and follow-ups for that same phone number, but model-extracted caller names from prior calls must not replace the contact display name. If no contact exists, a model-extracted caller name may seed a new caller profile, but later model extractions must not churn an existing caller name without an explicit user edit or contact match. Otherwise the caller remains unknown.
- Custom bootstrap tokens, development verification codes, anonymous default-user access, and hard-coded owner fallback are not production paths.

## Multi-User Onboarding And Provisioning

Google Play onboarding must use production authentication from the first public build. The Android app creates and restores accounts with Firebase Google sign-in or Firebase email/password, uses Firebase Phone Auth only to link the protected mobile number, and sends Firebase ID tokens to the backend. The backend verifies those tokens with Firebase Admin before creating or reading any user-owned data. Custom bootstrap tokens, in-app development verification codes, and anonymous default-user access are not production paths.

Android Firebase client configuration must use the standard `google-services.json` plus Google Services Gradle plugin path. The app must not maintain a parallel manual Firebase initialization fallback because phone-auth redirect/verification behavior depends on the generated Firebase resources and merged manifest metadata.

Onboarding states:

- `firebase_authenticated`: Firebase session exists and backend has verified the ID token.
- `phone_verified`: Firebase Auth phone number is present on the verified token.
- `account_created`: backend user profile exists for the Firebase `uid`.
- `phone_captured`: primary mobile number is copied from the verified Firebase phone claim unless the user later adds another verified route.
- `assistant_profile_configured`: assistant name is saved; deeper behavior preferences may still be defaults.
- `retell_number_assigned`: the user has a mapped AI forwarding number.
- `forwarding_instructions_viewed`: carrier-specific setup has been shown.
- `forwarding_tested`: a call to the user's Retell number was received or manually confirmed.
- `first_useful_call_reviewed`: the user has seen a meaningful handled call outcome.
- `payment_method_added`: Stripe or comparable provider has a reusable payment method for the user.
- `spending_cap_set`: user has accepted or configured a monthly spending cap.
- `billing_active`: paid usage is allowed for the current period.

Provisioning rules:

- Backend user IDs are derived from Firebase `uid`; client-supplied user IDs are ignored.
- Assistant-number provisioning requires a verified Firebase phone claim.
- Public assistant-number provisioning requires billing state `active`, a payment method, and a monthly spending cap unless the user is on an explicit beta/internal bypass.
- The backend must reject missing, expired, malformed, or wrong-project Firebase ID tokens.
- Production builds must not expose development verification codes.

- Phone verification and plan eligibility are required before automatic number purchase.
- A configurable beta allowlist may bypass billing while the product is private.
- Number purchase must be idempotent per user.
- A user may have multiple phone routes later, but the MVP supports one primary mobile number and one AI forwarding number.

Retell provisioning adapter responsibilities:

- Purchase a number with optional area code.
- Assign or update inbound/outbound agent IDs.
- Set inbound webhook URL.
- Retrieve/list provider-owned numbers for reconciliation.
- Return provider-neutral `VoiceNumberAssignment` objects.

Domain services must treat Retell number purchase as an external side effect with cost, audit, retry, and rollback implications.

## Assistant Profile To Retell Translation

The domain stores an assistant profile, not Retell-specific prompt text. A voice provider adapter renders that profile plus call-specific context into:

- `override_agent_id` when a user-specific or template agent is selected.
- Begin message.
- Dynamic variables for name, tone, disclosure, transfer policy, calendar policy, memory boundaries, and topic context.
- Metadata for user ID, assistant profile version, and routing IDs.

This enables future voice providers to receive equivalent behavior without reworking the product model.

## Billing And Cost Controls

Production billing should use Stripe or a comparable billing provider for payment collection and invoicing, while Phone Agent remains the source of truth for usage, cost, rating, policy gates, and spending caps.

Billing architecture:

- `BillingAccountService`: maps users to payment-provider customers, billing state, currency, payment method state, spending caps, and delinquency state.
- `StripeCatalog`: deployment-time products, Billing Meters, and prices for the Personal monthly plan and tiered assistant-minute overage. Price IDs are runtime configuration, while lookup keys and meter event names remain stable across environments.
- `PricingService`: resolves effective `PricePlan`, customer-facing meters, rounding rules, credits, and tax display assumptions.
- `UsageLedger`: records raw usage events with idempotency keys before any payment-provider reporting.
- `RatingService`: converts raw usage into customer charges and internal estimated cost using versioned price plans and cost rate cards.
- `MeterPublisher`: sends customer-facing meter events to Stripe with idempotency keys.
- `BillingWebhookService`: receives Stripe events and mirrors invoice, payment method, payment failure, subscription, dispute, and customer portal state.
- `WebhookEventLedger`: records provider event IDs, processing status, attempt counts, processed timestamps, and sanitized error codes so webhook handlers are idempotent and replay-safe.
- `BillingPolicy`: decides whether paid actions are allowed before cost is incurred.

Customer-facing billable dimensions:

- `personal_plan_months`
- `assistant_call_minutes`
- Internal `ai_processing_units`
- Future `sms_segments`, `email_actions`, `document_pages_processed`, and `storage_gb_months`

Internal cost dimensions:

- Voice provider minutes, telephony minutes, STT/TTS minutes, live LLM tokens or provider minutes, classifier requests, input/output tokens, tool calls, calendar writes, SMS segments, document pages, and storage.

Guardrails:

- Payment method required before paid phone-number assignment for public users.
- User-selected monthly spending cap required before paid usage starts.
- Default cap: `$40/mo`.
- Warning thresholds: `50%`, `80%`, and `100%`.
- Hard stop or degraded fallback when cap is reached.
- Audit records for expensive or externally visible AI actions.
- Provider costs tracked separately from customer pricing so gross margin can be monitored.
- Raw card data must never touch Phone Agent servers.
- Billing UI must use customer-friendly categories and avoid backend vendor/model names by default.

Runtime billing activation:

- `POST /v1/billing/checkout-session` creates a Stripe-hosted setup session for reusable card collection.
- `PATCH /v1/billing/spending-limit` stores the user's monthly cap and attempts idempotent Personal subscription activation if a payment method already exists.
- Stripe `checkout.session.completed` and `payment_method.attached` webhooks mirror payment method state and attempt idempotent subscription activation if a spending cap already exists.
- `POST /v1/billing/activate` is a client-safe retry endpoint for the mobile app after the user returns from hosted card setup.
- `POST /v1/billing/cancel-subscription` cancels the mirrored provider subscription when present, sets local billing state to `canceled`, disables paid assistant-number provisioning, and immediately blocks new paid assistant work.
- Subscription IDs and subscription status are mirrored on `BillingAccount`.
- Paid provisioning checks local billing state, not live Stripe state.
- Paid provisioning also checks the local current-period spend against the user's monthly cap. If spend is at or above the cap, the account moves to `cap_reached` and paid resource assignment is blocked until the cap increases or the period resets.
- Live inbound assistant runtime also checks the local billing state when billing gates are enabled. If the account is inactive, past due, canceled, or over cap, the voice provider receives a minimal unavailable response with no caller memory, topic context, calendar context, active user notes, or tool authorization.
- Retell tool endpoints and approved outbound-call creation use the same local billing gate. When blocked, tool endpoints return a non-sensitive `unavailable` result so the agent can take a concise message instead of creating transfers, live answer prompts, calendar actions, or other paid side effects.
- Billing blocks create privacy-safe `billing_issue` notification events for the user. These notifications should identify the blocked category and recovery action without exposing transcripts, caller names, topics, provider payloads, card data, or invoice line detail.
- Stripe webhook processing must be guarded by a durable idempotency ledger keyed by Stripe event ID. Duplicate delivery after a successful event must return success without reapplying side effects. Failed events must remain retryable and record only sanitized error metadata.
- Stripe Personal subscription creation must use a stable idempotency key per customer/plan, and subscription deletion events must be ignored when they refer to a stale duplicate subscription rather than the mirrored active subscription.

Account removal:

- `DELETE /v1/account` is authenticated and destructive. It cancels paid access, disables active device push tokens, unmaps phone routing, marks `UserConfig.accountStatus` as `deleted`, attempts Firebase user deletion through the auth admin adapter, and returns a minimal success response.
- Deleted accounts must be rejected by authenticated client middleware with `account_removed`.
- Full hard deletion of user-owned communication records should run behind this endpoint according to retention policy. Until purge jobs are complete, deleted user data must remain inaccessible through client APIs and unavailable to voice-provider context injection.

Usage metering:

- `UsageService` creates an idempotent local `UsageEvent` first.
- A successful local event may be published to Stripe as a Billing Meter event when the user has an active subscription and provider customer ID.
- Billing meter publishing uses stable event names. The default public subscription publishes `phone_agent_call_minutes`; AI processing remains internal until plan limits or add-ons are introduced.
- Publishing failures are recorded on the local usage event and must not fail call webhook handling.
- Reconciliation and retry jobs should later scan unpublished usage events and publish them with the same idempotency keys.

The detailed billing and pricing design lives in `docs/monetization.md`.

## Agent Eval Suite

Agent behavior must be regression-tested before prompt or context changes are deployed.

Eval coverage:

- Natural greeting.
- AI disclosure.
- No internal label leakage.
- Known caller friendliness.
- Unknown caller identification.
- Emergency handling.
- Privacy and memory boundaries.
- Transfer approval policy.
- Live user answer policy.
- Calendar create/update limits.
- Outcome-oriented closing.

The first suite is deterministic and checks generated Retell context plus prompt/contract fixtures. Later suites should replay real redacted transcripts, run model-in-the-loop scenario tests, and gate deploys on score thresholds.

## Data Model

Core entities:

- User, Device, Contact, Participant, ExternalIdentity.
- TopicThread, TopicParticipant, TopicPermission, TopicShare.
- CommunicationItem, CommunicationParticipant, RawContentRef.
- Decision, OpenQuestion, Task, Conflict, Fact.
- DocumentReference, CalendarActivity, AgentNote.
- CallSession, ActiveCall, CallEvent, TranscriptSegment, Recording.
- CallerProfile, CallerMemory.
- Notification, ApprovalRequest, AnswerRequest.
- ProviderAccount, ProviderMapping.
- BillingAccount, PaymentMethod, PricePlan, BillableMeter, CostRateCard, UsageEvent/RatedUsageEvent, InvoiceMirror, CreditGrant, SpendingLimit.

Billing usage is locally rated before provider meter publication. Each usage event stores the provider-neutral type, quantity, idempotency key, source object, customer charge, estimated internal cost, margin, rating version, and local spend application marker. The local spend marker is claimed once per usage event before the billing account spend counter is incremented, preventing duplicate webhooks from double-applying spend. Stripe meter events remain downstream of the local ledger.

Invoice state is mirrored into sanitized `InvoiceMirror` records from Stripe webhooks. The mobile app should read local invoice summaries first and only fall back to provider invoice reads before the first mirrored invoice exists.
- AuditLog, ConsentPolicy, RetentionPolicy.

Calendar data must be user-scoped. `CalendarConnection` stores `userId`, provider, connected email, scopes, refresh token reference/value, and timestamps. `CalendarEventRequest` stores `userId`, action, source call, caller metadata, event IDs, status, timing, and error metadata. Free/busy checks, event creation, event updates, activity lists, and OAuth callbacks must always resolve a user before reading or writing calendar state.

Call history queries must be tenant-scoped at the repository or query layer. Route handlers should not fetch global call history and filter in memory for production paths.

Product analytics uses `ProductAnalyticsEvent` records keyed by generated event ID, `userId`, `sessionId`, event name, screen/surface/action/result, object references, safe attributes, client timestamps, and receipt timestamps.

Abuse controls use `RateLimitBucket` records in production persistence. Buckets are keyed by hashed limiter key, include `count`, `resetAt`, `expiresAt`, and `updatedAt`, and should be configured with Firestore TTL on `expiresAt`.

MVP persistence currently uses Firestore. Firestore is acceptable for early controlled beta and Cloud Run deploys. Long-term production may move topic and permission modeling to PostgreSQL, analytics to an event pipeline/warehouse, Redis for live state and idempotency, object storage for recordings/documents, and an outbox/event bus for durable events.

## API Design

Client API examples:

- `GET /v1/onboarding/status`
- `GET /v1/communications`
- `GET /v1/communications/{communicationItemId}`
- `GET /v1/topics`
- `POST /v1/topics`
- `GET /v1/topics/{topicThreadId}`
- `PATCH /v1/topics/{topicThreadId}`
- `POST /v1/topics/{topicThreadId}/communications`
- `DELETE /v1/topics/{topicThreadId}/communications/{communicationItemId}`
- `POST /v1/topics/{topicThreadId}/decisions`
- `POST /v1/topics/{topicThreadId}/open-questions`
- `POST /v1/topics/{topicThreadId}/tasks`
- `POST /v1/topics/{topicThreadId}/shares`
- `GET /v1/calls`
- `GET /v1/calls/active`
- `GET /v1/callers`
- `POST /v1/contacts/sync`
- `GET /v1/contacts/status`
- `GET /v1/agent-notes`
- `GET /v1/approval-requests`
- `GET /v1/answer-requests`
- `GET /v1/billing/account`
- `POST /v1/billing/checkout-session`
- `POST /v1/billing/customer-portal`
- `POST /v1/billing/activate`
- `POST /v1/billing/cancel-subscription`
- `GET /v1/billing/usage`
- `PATCH /v1/billing/spending-limit`
- `GET /v1/billing/invoices`
- `DELETE /v1/account`

Billing invoice responses must be sanitized: include invoice ID, status, amount, currency, created date, and Stripe-hosted invoice/PDF URLs only. Do not include caller names, topic names, transcripts, calendar descriptions, or provider raw invoice line metadata in the default consumer response.

Current MVP implementation exposes onboarding status, communication inbox, communication item detail, topic create/list/detail, manual communication attachment, and create-only decisions/open questions/tasks. The Android app includes Setup, Communication Inbox, Topics, manual topic creation, manual communication attachment, and a basic topic detail view.

The next implemented slice adds reviewable topic suggestions and communication extraction scaffolding. Suggestions are stored separately from topic associations until accepted by the user. A topic suggestion is the pending review state for a communication item, not an unbounded list of alternative generated titles; the backend should upsert by user and communication item, collapse existing duplicates in the review queue, and dismiss sibling pending suggestions when one is accepted or dismissed. The classifier is provider-neutral and currently uses an OpenAI-backed implementation with structured JSON output. New-topic titles are normalized server-side before storage, display, and topic creation so generated titles stay short, reusable, and free of owner names, caller names, date/time suffixes, and call-summary phrasing. Retell events may trigger this service, but Retell payloads are normalized into communication items first.

Topic detach, update/delete for structured state, permissioned sharing, and full AI classification remain future work.

Provider webhook examples:

- `POST /webhooks/retell/inbound`
- `POST /webhooks/retell/events`
- `POST /webhooks/voice/{provider}/events`
- `POST /webhooks/sms/{provider}/messages`
- `POST /webhooks/email/{provider}/messages`
- `POST /webhooks/calendar/{provider}/events`
- `POST /webhooks/agent/{provider}/messages`
- `POST /webhooks/billing/stripe`

## Event-Driven Architecture

Domain events:

- `communication.received`
- `communication.normalized`
- `communication.summarized`
- `topic.suggested`
- `topic.created`
- `topic.communication_attached`
- `topic.decision.created`
- `topic.open_question.created`
- `topic.task.created`
- `topic.conflict.detected`
- `interruption.requested`
- `sharing.artifact_created`
- `sharing.artifact_sent`
- `agent_message.received`
- `permission.decision_recorded`
- `audit.logged`
- `billing.payment_method_added`
- `billing.spending_cap_updated`
- `billing.usage_recorded`
- `billing.cap_warning_reached`
- `billing.cap_reached`
- `billing.invoice_paid`
- `billing.payment_failed`
- Existing voice events such as `call.received`, `call.completed`, `answer_request.created`, and `call.transfer.requested`.

Use an outbox pattern before adding a dedicated queue. Events must be idempotent and replayable where practical.

## Product Analytics

Phone Agent should use first-party, privacy-safe product analytics for app engagement and activation quality. Analytics are separate from audit logs and must never become a store of communication content.

Analytics events are dense and high-fidelity by default:

- `userId`, `sessionId`, `eventName`, `occurredAt`, `receivedAt`, and monotonically increasing client sequence.
- Screen, surface, tab, action, result, latency, and app version.
- Object references such as `objectType` and `objectId` when useful.
- Device class, OS version, network status category, and build type where available.
- Safe attributes with an allow-listed schema.

Analytics events must not include transcripts, summaries, assistant-note text, live-answer text, search query text, contact book contents, calendar descriptions, payment data, raw provider payloads, or secrets. If a product question requires content analysis, use derived categories or counts produced by backend services, not raw user text.

Initial events:

- `app_opened`, `screen_viewed`, `tab_selected`.
- `data_refresh_started`, `data_refresh_succeeded`, `data_refresh_failed`.
- `onboarding_step_viewed`, `onboarding_step_completed`.
- `call_row_opened`, `call_action_tapped`, `topic_opened`, `topic_created`.
- `assistant_presence_opened`, `profile_opened`, `logout_requested`, `logout_completed`.
- `billing_setup_opened`, `forwarding_opened`, `note_created`.

Analytics storage starts in Firestore behind a repository abstraction. Later scale can move event ingestion to Pub/Sub, BigQuery, or a warehouse pipeline without changing the mobile client contract.

`npm run analytics:export` exports privacy-safe analytics rows from Firestore to NDJSON for dashboard prototyping and warehouse loading. The export strips blocked attribute keys such as transcript, summary, note, answer, query, contact, calendar, payment, secret, token, and raw payload fields.

The starter dashboard contract is documented in `docs/analytics-dashboard.md`, with BigQuery view definitions in `scripts/analytics-dashboard-bigquery.sql`.

## Error Handling

Fallback behavior:

- If topic classification fails, store the communication unassigned and surface it in the inbox.
- If a topic suggestion cannot be generated confidently, store no suggestion rather than auto-attaching the item.
- If the extraction scaffold produces low-quality output, keep it on the communication item as low-confidence extracted state and require user review before promoting it into topic decisions, questions, or tasks.
- If the OpenAI classifier fails, times out, or returns invalid output, log a content-free error and leave the communication unassigned for manual review.
- Do not log raw transcripts, summaries, or model prompts.
- If confidence is low, suggest attachment rather than auto-attach.
- If permission evaluation fails, do not share; notify/audit as needed.
- If provider ingestion fails, retry with idempotency keys.
- If Retell or voice runtime fails, fall back to message capture when possible.
- If calendar write fails, notify the user and preserve a failed activity record.
- If conflict detection is uncertain, mark as possible conflict and request user review.
- If billing state is inactive, cap is reached, or payment method is missing, block paid-resource provisioning and paid AI/voice actions before provider calls are made.
- If Stripe or the payment provider is unavailable, use the local mirrored billing state for enforcement and queue meter publishing for retry.

## Observability

Track:

- Ingestion latency by channel/provider.
- Topic suggestion acceptance/rejection.
- Auto-attachment precision.
- Interruption false positives/false negatives.
- Voice latency and transfer success.
- Calendar create/update/failure rate.
- Sharing artifact sends and external replies.
- Permission denials and sensitive-data blocks.
- Audit log completeness.
- Revenue, cost, gross margin, cap warnings, cap blocks, payment failures, meter publishing retries, and invoice reconciliation errors.

Avoid logging raw communication content in general application logs.

## Notification System

Notifications are domain events before they are Android push/local notifications. The backend should create durable `NotificationEvent` records for user-impacting moments, then delivery adapters render privacy-safe payloads for Android, future iOS, web, email, or SMS.

Core entities:

- `NotificationEvent`: user ID, type, priority, title, private-safe body, optional detailed body, action target, action IDs, expiration, read/dismissed state, source object, and created timestamp.
- `NotificationPreference`: per-user lock-screen detail level, enabled types, quiet hours, channel preferences, and sensitive-content policy.
- `NotificationDelivery`: provider-neutral delivery attempt with platform, status, latency, failure reason, and retry metadata.
- `NotificationActionAudit`: user ID, notification/source object, action, surface, terminal result, latency, sanitized error code, and timestamp.

Default privacy policy:

- `private`: lock-screen and push payloads use generic text only.
- `summary`: caller/topic/event titles may be included, but not transcripts or assistant notes.
- `detailed`: richer content allowed only after explicit opt-in and still blocked for sensitive categories.

Android implementation:

- Store notification events in the backend.
- Expose `GET /v1/notifications` and `POST /v1/notifications/{id}/read`.
- Expose authenticated push-device registration so each signed-in Android install can upload its current FCM token.
- Generate events for transfer requests, live answer requests, live call state changes, call summaries, topic suggestions, and calendar changes.
- Deliver Android push through FCM using data-only, private-safe payloads derived from `NotificationEvent.body`.
- Android does not run periodic notification polling as a fallback. FCM data messages trigger one-shot source-of-truth refreshes while the app is active, notification deep links fetch fresh state before routing, and app launch/manual navigation refreshes the durable notification center.
- Deep links route to Assistant live actions, Inbox review queue, Calendar activity, or call detail.
- Live transfer notification actions are handled by a background Android receiver, independent of the foreground Activity, so `Accept` and `Decline` work when the app process was killed. The receiver refreshes the Firebase ID token, posts the authenticated decision, prevents duplicate in-flight action submits, cancels the original notification, and posts a privacy-safe result notification.
- Live answer notifications use Android inline reply (`RemoteInput`) so the user can send a short answer directly from the notification shade. The backend stores the answer on the pending request and the voice runtime relays it to the caller.
- Approval and answer request APIs are expiration-aware and idempotent. A duplicate action returns the current terminal state. An expired request returns a clear `409` conflict with a product-safe error code so Android can show "This request expired." Transfer approvals default to `60s`; live answer requests default to `90s` so users have time to notice, unlock, and reply while the caller is still on the line. Production config uses separate `TRANSFER_APPROVAL_TIMEOUT_MS` and `LIVE_ANSWER_TIMEOUT_MS` values. Overrides must not shorten those windows unless the product requirement, mobile copy, and operational runbook are updated together.
- Voice-provider custom function timeouts must exceed backend wait windows by at least `5s`. The initial Retell tool config uses `65s` for transfer approval and `95s` for live answer so the provider does not abort before Phone Agent returns the user's decision.
- Successful, declined, expired, and failed notification actions are audited without storing answer text, transcripts, caller notes, topic memory, or raw provider payloads.
- Completing a live action dismisses related unread `NotificationEvent` records by source object so in-app notification history does not remain stale.

Delivery rules:

- FCM payloads must include notification ID, type, priority, safe title, safe body, and deep-link target only.
- FCM payloads must not include transcripts, caller notes, active user notes, topic memory, calendar descriptions, raw provider payloads, card metadata, or sensitive document content.
- Android clients must interpret notification targets as product deep links. Live transfer targets open the specific approval and may expose Accept/Decline notification actions. Live answer targets open the specific answer composer. Summary, topic, calendar, and billing targets open their corresponding product surfaces.
- Failed or invalid FCM tokens are disabled so future sends do not repeatedly fail.
- Push delivery failure must not prevent durable `NotificationEvent` creation.
- Expired live request deep links must render an expired state in-app. They must not open a blank Assistant page or leave an actionable notification visible.
- Every FCM send attempt creates a `NotificationDelivery` record with notification ID, device token ID, provider, status, latency, and sanitized error code. Delivery records are used for support/debugging and alerting, not for lock-screen copy.

Crash/error telemetry:

- Android production builds include Firebase Crashlytics.
- Crashlytics may record crashes, app version, device class, OS version, and non-sensitive breadcrumbs such as screen/action names.
- Crash reports must not include transcripts, caller memory, assistant notes, calendar details, phone contact contents, raw notification payloads, card data, or provider secrets.

Future implementation:

- Add APNs for iOS.
- Add richer delivery attempt analytics, retry policy, quiet hours, and per-type preferences server-side.

## Security And Privacy

Requirements:

- Encrypt data in transit and at rest.
- Use least-privilege provider scopes.
- Store secrets in managed secret storage.
- Never store raw card data; use payment-provider tokens and hosted/native collection components.
- Verify provider webhooks.
- Rate-limit authenticated client APIs, provider webhooks, and Retell tool endpoints. Production Cloud Run deployments should use the shared Firestore-backed limiter so limits apply across scaled instances. Local/test runs may use the in-memory limiter. Public launch should still add Cloud Armor, API Gateway, or equivalent edge controls.
- Enforce thread-level access control.
- Track consent/disclosure settings.
- Mark sensitive information explicitly.
- Retain raw content by policy and reference it instead of copying broadly.
- Audit access, sharing, AI decisions, permission decisions, and retention/deletion.
- Default to not sharing sensitive thread context with external participants.

## Compliance Considerations

Legal review is required for:

- Recording consent.
- AI disclosure.
- TCPA and outbound AI.
- Third-party privacy and inferred facts.
- Email/SMS consent and retention.
- External participant sharing.
- Agent-to-agent identity and authorization.
- Healthcare, legal, financial, employment, and emergency-related workflows.

## Testing Strategy

Add tests for:

- Provider webhook normalization.
- Communication item creation.
- Topic thread repository behavior.
- Topic classification output parsing.
- Permission checks.
- Thread attachment and detachment.
- Decision/open-question/task extraction.
- Interruption policy.
- Sharing policy.
- Retell adapter contract tests.
- Authorization on every user-owned resource.

## Deployment Strategy

Initial deployment:

- Cloud Run backend.
- Firestore MVP persistence.
- Secret Manager.
- Cloud Logging.
- Artifact Registry and Cloud Build.
- Retell webhooks.
- Shared API/webhook rate limits with Firestore-backed buckets in production and in-memory buckets for local/test.

Target production:

- Managed PostgreSQL for topic/permission-heavy data.
- Redis for live call state and idempotency.
- Object storage for recordings and documents.
- Event bus or queue.
- API gateway/WAF/rate limiting.
- Separate dev/staging/prod projects.

## Local Development Strategy

Local development should include:

- `npm run dev`, `npm test`, `npm run typecheck`.
- Mock provider adapters.
- Seeded users, contacts, topic threads, communication items, decisions, questions, and tasks.
- Provider webhook tunnel for Retell testing.
- Future local dependencies for PostgreSQL/Redis/object storage when introduced.
