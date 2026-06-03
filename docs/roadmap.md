# Roadmap

## Phase 0: Design Foundation

Goal: align the product and architecture around cross-channel topic memory before expanding implementation.

Scope:

- Product requirements.
- Architecture.
- Technical design.
- Domain model.
- Provider abstractions.
- Topic thread model.
- Permission model.
- Initial Retell integration assumptions.
- Compliance review checklist.

Exit criteria:

- `TopicThread` is accepted as the primary product object.
- `CommunicationItem` is accepted as the generic cross-channel ingestion object.
- Retell is documented as replaceable voice infrastructure.
- Topic threads are documented as security boundaries.
- Open questions and implementation phases are documented.

## Phase 1: AI Call Ingestion

Goal: reliably ingest forwarded calls and store them as generic communication items.

Scope:

- Receive call events from Retell.
- Store calls as `CommunicationItem` records.
- Store transcripts and summaries.
- Show call history / communication inbox.
- Basic user/contact model.
- Basic Retell webhook handling.
- Basic local/dev setup.

Exit criteria:

- A forwarded call creates a normalized communication item.
- Retell payloads are confined to adapter/infrastructure code.
- Calls can still power existing active-call and call-history UX.

## Phase 2: Topic Thread MVP

Goal: make topic threads visible and useful before broad automation.

Scope:

- Create topic threads manually.
- Attach calls to topic threads manually.
- Auto-suggest topic thread based on call summary.
- Store decisions, open questions, and tasks.
- Topic thread detail view.

Exit criteria:

- User can create "Basement Project" and attach related calls.
- Topic detail shows timeline, participants, decisions, open questions, tasks, and related communications.
- AI suggestions are reviewable and correctable.

## Phase 2.7: Production Mobile UX Facelift

Goal: turn the Android app from a functional beta shell into a consumer-ready communication command center.

Scope:

- Detailed mobile UX blueprint.
- Today, Topics, Inbox, Assistant, and Search information architecture.
- Production screen hierarchy for setup, forwarding, assistant notes, calendar, people memory, topic detail, communication detail, and live-call actions.
- Loading, empty, error, offline, stale, and notification deep-link states.
- Reusable mobile components and visual system.
- Screenshot-based QA across representative Android viewports.

Exit criteria:

- The app feels calm, minimal, and executive rather than like an internal admin tool.
- Topic threads are visually central to the experience.
- Live-call actions are clear, reliable, and time-sensitive.
- Users can understand setup status, assistant status, recent communications, and pending decisions at a glance.

## Phase 2.8: Self-Serve Multi-User Onboarding

Goal: make the app usable by a new Google Play user without hard-coded owner assumptions.

Scope:

- Account bootstrap and authenticated client session.
- Verified user phone number state.
- Assistant profile customization.
- Per-user Retell number assignment/provisioning.
- Carrier forwarding setup.
- Test call and first handled call review.
- Cost guardrails before provisioning paid resources.
- Billing eligibility gate before paid assistant number assignment.

Exit criteria:

- A new user can create an account, configure their assistant, obtain or assign an AI forwarding number, and understand the exact next step.
- Every client API resolves the authenticated user from the session/token.
- Every Retell webhook resolves the user from assigned phone routing before context is loaded.
- Assistant customization affects Retell dynamic context without hard-coding Retell into the domain.

## Phase 2.9: Pay-As-You-Go Monetization

Goal: let public users enter a credit card, set a spending cap, and pay for the assistant work they actually use.

Scope:

- Stripe customer/payment method setup.
- Billing account and billing state model.
- Required monthly spending cap.
- Customer-facing pricing: Phone Agent Personal, included assistant minutes, assistant-minute overage, and internal AI processing cost tracking.
- Internal cost ledger for provider minutes, model tokens, tool calls, and future channel costs.
- Usage rating service and versioned price/cost rate cards.
- Billing gates before paid assistant number assignment and paid AI/voice actions.
- Mobile billing onboarding screen and settings screen.
- Invoice/payment webhook mirroring.
- Cap warning notifications.

Exit criteria:

- A new public user cannot provision paid infrastructure without a payment method and cap.
- Usage is recorded idempotently before meter events are sent to Stripe.
- The app shows current spend, cap, and billing state without exposing backend vendor names.
- Users receive warnings before paid usage is blocked.
- Gross margin can be measured per user, call minute, and AI processing unit.

## Phase 2.95: Production Hardening

Goal: move from usable alpha to a controlled public beta that can safely handle real users, real calls, and real money.

Scope:

- Durable provider webhook idempotency.
- Billing reconciliation, invoice mirror, and cap enforcement.
- Secret rotation and least-privilege IAM review.
- Provider outage and retry behavior.
- Android crash-free onboarding and billing QA.
- Compliance launch checklist for AI disclosure, call recording consent, privacy policy, terms, refund policy, and data deletion.
- Production observability: alerts for webhook failures, 5xx spikes, billing failures, transfer failures, and provider cost anomalies.
- Privacy-safe product analytics for activation, engagement, conversion, reliability, and retention.
- Shared backend rate limiting across scaled instances, plus edge controls before closed beta.
- User-scoped calendar OAuth/activity and route-scoped call history.

Exit criteria:

- No known path can double-subscribe or double-charge a user.
- New paid users cannot trigger paid infrastructure before verified auth, payment method, spending cap, and idempotent provisioning are in place.
- Provider webhook retries are safe and observable.
- Calendar, call history, notifications, analytics, and live actions are tenant-scoped and covered by regression tests.
- Product analytics supports launch decisions without storing private communication content.
- Operators can reconcile billing and repair failed provider events without editing database documents manually.
- Launch-blocking legal/compliance items are either complete or explicitly disabled in product scope.

## Phase 3: AI Topic Classification

Goal: classify new communications into topic context and maintain structured thread state.

Scope:

- Classify new communication items into existing or new topics.
- Extract facts, tasks, decisions, and open questions.
- Detect conflicts with prior thread state.
- Generate recommended next actions.
- Track confidence, evidence, and model versions.

Exit criteria:

- The system can explain why it attached a communication to a topic.
- Users can accept, reject, detach, merge, or split topic suggestions.
- Decisions and questions are stored as structured state, not only summary text.

## Phase 4: Cross-Channel Ingestion

Goal: expand beyond calls while preserving one domain model.

Scope:

- Add email ingestion.
- Add SMS ingestion.
- Add document/attachment references.
- Normalize everything into communication items.
- Improve thread timeline.
- Treat calendar events as communication items as well as scheduling artifacts.

Exit criteria:

- A topic thread can contain calls, emails, SMS, calendar events, documents, and notes.
- Provider integrations remain adapter-scoped.
- The communication inbox is channel-neutral.

## Phase 5: Interruption Engine

Goal: protect user attention using topic context, not only caller context.

Scope:

- Rules by caller/contact.
- Rules by topic.
- Rules by urgency.
- Rules by pending decision.
- Live decision cards.
- Warm transfer decisions.
- Quiet hours and escalation policy.

Exit criteria:

- The assistant can decide whether to interrupt based on topic stakes, deadlines, conflicts, and required approvers.
- Warm transfer remains approval-gated.
- Low-value communications are recorded without becoming interruptions.

## Phase 6: Shared Topic Threads

Goal: create permissioned value for external participants and a trust-building network loop.

Scope:

- Share recap via SMS/email/web link.
- Participant access to selected thread artifacts.
- Permissioned updates from external participants.
- Audit logs.
- Thread-scoped sharing rules.

Exit criteria:

- External participants can receive useful artifacts without installing the app.
- External replies can update only the scoped thread/artifact.
- User can see and revoke shared access.

## Phase 7: Agent-To-Agent Protocol

Goal: prepare for structured communication between user-owned agents.

Scope:

- Define structured agent message format.
- Topic-scoped agent handshakes.
- Permissioned requests/responses.
- Approval workflow.
- Future compatibility with open agent protocols where appropriate.

Exit criteria:

- Agents can exchange topic-scoped requests without exposing unrelated user data.
- Human approval policies are enforceable.
- Agent messages become communication items and audit events.
