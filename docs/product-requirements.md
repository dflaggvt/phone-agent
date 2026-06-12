# Product Requirements

## Product Overview

Phone Agent is a cross-channel communication intelligence layer. It starts as an AI-native phone call layer for a user's existing phone number, but the durable product is broader: it organizes calls, SMS, email, documents, calendar events, manual notes, and future agent-to-agent messages into persistent topic threads.

The current phone promise is: when a user misses or declines a call, the assistant can catch it, understand intent, and preserve the outcome. The expanded promise is: Phone Agent turns scattered calls, texts, emails, and messages into organized, topic-aware threads with memory, decisions, and next actions.

This is not voicemail, call screening, spam filtering, a chatbot on a phone line, or a Retell wrapper. Retell is replaceable voice infrastructure. Phone Agent owns the domain model, topic memory, user rules, permissions, identities, summaries, decisions, audit logs, and workflow outcomes.

## Vision Statement

The assistant should understand the situation, not just the message.

Phone Agent should turn communication from a stream of interruptions into an organized memory of real-world situations. The system should know what topic a communication belongs to, who is involved, what has changed, what decisions were made, what questions remain open, what tasks are due, and whether the user needs to be interrupted now.

## Problem Statement

Personal and professional communication is fragmented across channels. A single real-world situation can span phone calls, SMS, email attachments, calendar events, documents, and ad hoc notes. Users are forced to reconstruct context manually: who said what, what was decided, which document matters, whether there is a conflict, and what should happen next.

Existing products are channel-centric:

- Phone apps organize by number and timestamp.
- Email organizes by inbox and sender.
- SMS organizes by contact thread.
- Calendar organizes by time.
- Document storage organizes by file.
- Voicemail and call screening do not maintain structured memory or outcomes.

Users need a topic-aware layer that connects these fragments into durable, permissioned situation threads.

## Core Thesis

Old model: communications are organized by channel, sender, and timestamp.

New model: communications are organized by topic, participants, decisions, open questions, tasks, documents, and outcomes.

For the current conditional-forwarding product, a phone call still rings the user's phone first. If the user does not answer, or taps the red decline button, the call forwards to the assistant. The longer-term full-forwarding vision is that a call can begin with intent before interrupting the user. In both cases, a communication thread should not end with a transcript. It should update the user's understanding of the situation.

## Target Users

- Busy professionals who receive calls, emails, texts, documents, and calendar changes across many projects.
- Small business owners and solo operators coordinating vendors, customers, appointments, and follow-ups.
- Parents and caregivers managing school, sports, medical, family, and household logistics.
- Homeowners coordinating contractors, architects, accountants, inspectors, and family members.
- Users who want an executive communication layer without adopting a full CRM or call center tool.

## Primary User Stories

- As a user, I want my assistant to answer calls first so I am interrupted only when the call deserves live attention.
- As a user, I want calls, texts, emails, documents, and calendar events about the same real-world situation grouped into one topic thread.
- As a user, I want to open "Basement Project" and see the timeline, participants, decisions, open questions, tasks, documents, and latest changes.
- As a user, I want the assistant to know whether a new call repeats, changes, or conflicts with prior thread context.
- As a user, I want the assistant to create decisions, tasks, and open questions from communications, not just summaries.
- As a user, I want family, trusted contacts, vendors, unknown callers, and external participants treated according to relationship and topic permissions.
- As a user, I want to share a recap or decision request with an external participant without giving them access to unrelated threads.
- As an external participant, I want a useful recap or request that lets me correct or update the thread without installing an app.
- As a future agent participant, I want to communicate with the user's agent through a structured, topic-scoped protocol.

## Key Jobs-To-Be-Done

- Determine what a communication is about and whether it belongs to an existing topic thread.
- Preserve the facts, decisions, open questions, tasks, documents, and conflicts created by each communication.
- Decide whether a new communication changes the user's priorities or requires interruption.
- Protect the user from avoidable interruption while escalating urgent or high-impact situations.
- Let the user see the current state of a topic without rereading every message.
- Share useful, permissioned artifacts with external people through SMS, email, or web links.
- Keep communication memory transparent, editable, reversible, and access-controlled.

## MVP Scope

The MVP remains Android-first and phone-first, but it should be built on the cross-channel model:

- Self-serve account bootstrap for Google Play users.
- Per-user assistant profile with name, tone, greeting, disclosure, transfer, calendar, and interruption preferences.
- Per-user phone routing configuration: user's real mobile number, assigned AI forwarding number, Retell agent/template mapping, transfer destination, and forwarding verification state.
- Frictionless first-run onboarding flow that uses dedicated setup screens, not an activation card inside the Today tab, and gets a new user from install to first successful assistant-handled call with the fewest required decisions.
- Existing mobile number conditional forwarding to an AI-controlled number, where missed or declined calls forward to the assistant after the user's phone rings.
- Retell-backed inbound call handling through provider abstraction.
- AI answers, asks who is calling and why, determines intent and urgency, and can take a message.
- Call lifecycle events, transcripts, summaries, caller identity, urgency, and follow-up actions.
- Live transfer approval, live user answer requests, active call awareness, and call history.
- Caller/contact memory and relationship-aware handling.
- User-approved phone contact sync so first-time assistant callers can still be recognized when their number exists in the user's address book.
- Phone contact sync must be available in the production Android Compose app. The user should be able to open Phone contacts from Assistant or Profile/Settings, understand what will be synced, grant Android Contacts permission only after tapping sync, resync later, and see the synced contact count.
- Temporary agent notes.
- Google Calendar free/busy and direct assistant-created calendar events with notifications.
- Generic `CommunicationItem` records for calls now and future SMS, email, documents, calendar, and agent messages.
- Manual topic thread creation.
- Manual attachment of call communication items to topic threads.
- Basic topic thread detail state: title, description, participants, decisions, open questions, tasks, documents, timeline, status, and permissions.
- AI-generated topic suggestions from call summaries. A single communication item should produce at most one pending topic-review decision; repeated classifier runs or title variations must update, collapse, or hide duplicate suggestions rather than asking the user to create the same topic twice.
- Firebase Auth account foundation with Google and email/password sign-in, plus Firebase Phone Auth for protected-number verification.
- Per-user phone number and Retell routing configuration.
- Usage/cost visibility and conservative plan limits.
- Payment method collection, spending caps, and subscription/usage billing gates before paid infrastructure is provisioned for public users.
- Agent behavior eval suite for regression prevention.

## Non-MVP Scope

- Full email, SMS, WhatsApp, Slack, Teams, and document ingestion.
- External participant web portal beyond simple shared artifacts.
- Autonomous outbound AI calls.
- Native app-to-app VoIP.
- Number porting as a required onboarding path.
- Full agent-to-agent protocol execution.
- Multi-user team administration.
- Payments, legal commitments, medical advice, or regulated workflow automation.
- Broad autonomous sharing without user or policy approval.
- Full enterprise billing, team billing, annual contracts, negotiated plans, and raw token billing UI.
- Team administration, account recovery beyond Firebase-supported recovery, and non-phone enterprise SSO.

## Google Play Multi-User Requirements

The Google Play product cannot assume a single hard-coded owner, Retell number, Retell agent, transfer number, calendar, or assistant personality. Every installed app instance must resolve to an authenticated user and every provider event must resolve back to one user before any private context is loaded.

Required account states:

- Anonymous local install: no server-owned assistant resources yet.
- Firebase authenticated: verified ID token resolves to one backend user.
- Phone verified: Firebase phone claim exists and user can continue phone forwarding setup.
- Mobile-number account recovery: if Google sign-in and phone verification point to different Firebase accounts, the verified mobile-number account should be recovered as the canonical phone account and the user must not see raw provider credential-collision language.
- Assistant named: user has named the assistant or accepted the default name.
- Assistant number assigned: a Retell-managed or imported number is mapped to the user.
- Forwarding configured: carrier forwarding has been tested or manually confirmed.
- First handled call complete: the assistant has proven basic utility.

Required guardrails:

- Do not provision paid Retell/telephony resources for anonymous users.
- Do not let one user's mobile app read another user's calls, topics, notes, calendar activity, rules, or Retell mapping.
- Do not load caller memory, topic memory, or calendar context into a Retell call until the inbound number is mapped to a user.
- Calendar OAuth connections, free/busy checks, assistant-created event records, and calendar activity history must be scoped to the authenticated user. A global calendar connection is not acceptable for multi-user beta.
- Caller identity and relationship memory must be scoped to the owning user. The same external phone number may be "Mom" for one user, "Contractor" for another, and unknown for a third.
- The voice agent must greet or refer to a caller by name only when that name comes from the caller's user-scoped profile, an explicit user-authored note for that caller, or the caller's own statement during the current call. It must never use hard-coded caller names.
- Contact-derived identity is separate from caller memory. A synced phone contact can identify a first-time caller, but prior-call memory, summaries, and inferred facts should only come from actual communications or user edits.
- Contact sync is optional and revocable at the platform permission level. The app must never imply that synced contacts have conversation history; they are identity hints only.
- Treat billing and usage limits as onboarding gates before broad self-serve launch.
- Require a payment method and user-selected monthly spending cap before assigning a dedicated paid assistant number to non-beta users.
- Use customer-facing usage categories such as assistant call time, AI processing, assistant number, messages, documents, and storage. Do not show backend provider names or raw token details in the primary consumer billing experience.

## Assistant Customization Requirements

Each user needs an `AssistantProfile` that translates product controls into provider-neutral agent context.

Onboarding should require only one assistant customization decision: the assistant display name. The default name is `Assistant`, and the user can continue without changing it. This gives the assistant a user-facing identity without forcing the user through personality, policy, or rule decisions before activation.

The main app shell should not be the primary onboarding surface for a new user. Before core setup is complete, the app should route the user into a traditional first-run sequence: value promise, account/phone verification, assistant naming, assistant number assignment, forwarding instructions, and a final test-call prompt. The Today tab should become useful after this sequence, not serve as the setup checklist.

The auth entry step must separate `Create account` from `Log in`. A new user explicitly creates an account with Google or email/password first, then enters onboarding: protected mobile-number verification, assistant naming, assistant-number assignment, forwarding instructions, and post-setup activation. A returning user logs in with Google or email/password and should be restored directly to the app when setup is complete, or resumed at the next incomplete onboarding step when setup is not complete. Returning users with a previously verified protected number must not be sent back to number verification because of stale or incomplete provider token claims. Phone-number OTP is available for protected-number verification, not account creation or returning-user login. The login path must not silently create a new Firebase/user account. Email/password login must only authenticate an existing Firebase user, while email/password account creation must fail with clear product copy if the email already exists. User display name can be shown or edited later in Profile; it should not be a blocker before authentication. Google or email/password authenticates the account, but the user must still verify the mobile number that the assistant will protect before call routing, assistant-number provisioning, or forwarding setup.

The full customizable fields are:

- Assistant display name.
- Greeting style: concise, warm, formal, protective.
- Disclosure style: standard, explicit, minimal where legally allowed.
- Warmth: `1-5`.
- Brevity: `1-5`.
- Proactivity: `1-5`.
- Unknown caller handling.
- Family/trusted caller handling.
- Transfer policy.
- Calendar policy.
- Topic memory policy.

Retell receives these settings through an adapter as dynamic variables and agent overrides. The domain must not store "Retell prompt text" as the durable customization object.

## Retell Provisioning Requirements

Retell is the first voice platform. For each onboarded user, the backend should support:

- Assigning an existing Retell number from inventory.
- Purchasing a Retell number when allowed by plan, verification, and cost policy.
- Binding the number to the shared Phone Agent Retell agent/template or a user-specific Retell agent when necessary.
- Setting the inbound webhook URL so the backend can inject per-call user context.
- Storing provider IDs and phone numbers in user-owned routing configuration.
- Releasing or disabling numbers when a user cancels or violates policy.

The preferred long-term model is shared Retell agent templates plus per-call dynamic context. One Retell agent per user is acceptable only as a migration bridge or when a provider limitation requires it.

## Monetization And Billing Requirements

Phone Agent should launch with a base subscription plus usage overage because live voice, AI model calls, transcription, topic classification, calendar actions, messaging, storage, and future document processing all create variable cost. Pure usage billing is useful for testing, but public consumer pricing should be more predictable.

User-facing billing requirements:

- A new public user must add a payment method before the app assigns a paid assistant forwarding number.
- The user must choose or accept a monthly spending cap before paid usage begins.
- The default spending cap should be conservative, initially `$40/mo`, giving room for the `$19/mo` plan plus moderate overage.
- The app should warn at `50%`, `80%`, and `100%` of the monthly cap.
- At the cap, paid assistant work should pause or degrade gracefully until the user raises the cap or the next billing period starts.
- Billing screens should explain charges in plain language: assistant call time, AI processing, assistant number, messages, documents, and storage.
- The app should show current month spend, cap, next reset date, payment method, invoices, and usage by category.
- Users should be able to pause paid usage and cancel/release an assistant number.
- Users should be able to cancel their subscription without deleting their account. Canceling should stop new paid assistant work immediately while preserving account history and settings.
- Users should be able to remove their account from the app. Account removal should cancel paid access, disable device notifications, unmap phone routing, clear local app data, sign the user out, and begin backend deletion or retention workflows for user-owned data.

Internal billing requirements:

- Track provider/model/token/minute costs separately from customer-facing pricing.
- Record all billable usage with idempotency keys before sending usage to a payment provider.
- Maintain local billing state so product gates do not depend on synchronous reads from Stripe or another payment provider.
- Never store raw card data. Use Stripe or comparable hosted/SDK payment collection.
- Price configuration and cost rate cards must be versioned and effective-dated.
- Usage statements and invoice descriptions must avoid sensitive caller names, transcripts, topic names, or calendar details unless the user explicitly exports a detailed report.

Initial public beta pricing recommendation:

| Unit | Customer Price | Product Behavior |
| --- | ---: | --- |
| Phone Agent Personal | `$19.00/mo` | Includes assistant number, 50 assistant-handled minutes, summaries, topic matching, and basic AI processing. |
| Additional assistant call time | `$0.39/min` | Applies after included minutes and remains protected by the user's monthly cap. |
| AI processing | included initially | Track internally; expose limits or add-ons later if usage materially affects margin. |

The detailed monetization design lives in `docs/monetization.md`.

## Core User Flows

## Inbound Call Flow

1. Caller dials the user's existing phone number.
2. Carrier forwarding routes the call to the AI-controlled number.
3. Voice provider sends an inbound webhook.
4. Backend normalizes the provider event and creates or updates a `CommunicationItem` with channel `phone_call`.
5. Agent context service resolves caller, relationship, active notes, related topic threads, and interruption rules.
   - Resolution order: user-scoped synced contacts for caller display name, user-scoped caller memory for prior history and relationship, then unknown caller. Model-extracted names must not override a synced contact name for the same phone number.
6. AI agent answers with disclosure and asks for identity and intent as needed.
7. Agent classifies urgency, topic, requested outcome, and whether user interruption is warranted.
8. Agent handles the call, requests a live answer, requests transfer approval, creates/updates calendar items when allowed, or takes a message.
9. Transcript and summary are stored.
10. Topic classification suggests or attaches a topic thread and extracts decisions, open questions, tasks, and conflicts.

## Topic Thread Flow

1. User creates a topic such as "Basement Project" manually, or the system suggests a new topic from communication content.
2. User attaches related calls or accepts an AI attachment suggestion.
3. Thread view shows timeline, participants, latest updates, decisions, open questions, tasks, documents, and suggested actions.
4. Future communications are classified against existing threads.
5. The assistant uses thread context to avoid asking repeated questions and to detect changes or conflicts.

## Cross-Channel Ingestion Flow

1. A provider adapter receives a call, SMS, email, calendar event, document reference, manual note, or future agent message.
2. Adapter normalizes provider data into a `CommunicationItem`.
3. Raw content is stored by reference with retention and sensitivity controls.
4. Classification extracts participants, topics, facts, tasks, decisions, open questions, deadlines, and conflicts.
5. System attaches the item to a topic thread automatically, suggests an attachment, or creates a candidate new thread.
6. User can confirm, correct, detach, merge, or split topics.

## AI Receptionist Flow

1. Agent answers on behalf of the user.
2. Agent discloses AI identity according to policy.
3. Agent identifies caller and reason.
4. Agent checks known caller context and likely topic thread context.
5. Agent asks only the minimum clarifying questions needed to classify intent, urgency, topic, and next action.
6. Agent gives a clear next step: message captured, user notified, transfer requested, decision card created, event created, or follow-up needed.

## User Interruption Flow

1. New communication arrives.
2. Interruption engine considers caller/contact, topic, urgency, pending decisions, deadlines, conflicts, quiet hours, and user rules.
3. Engine chooses silent record, normal notification, live answer request, decision card, warm transfer, or immediate escalation.
4. Decision is audited with evidence and model/policy version.

## Permissioned Sharing Flow

1. Agent creates a useful artifact such as a call recap, task list, document request, approval request, or thread summary.
2. Policy checks sensitivity, thread permissions, participant identity, and sharing rules.
3. User approves if required.
4. External participant receives SMS, email, or web link scoped to the specific thread artifact.
5. Participant can reply or update the thread within the granted scope.
6. Audit log records what was shared, with whom, why, and by which policy.

## Agent-To-Agent Flow

1. External agent requests a topic-scoped handshake.
2. Phone Agent verifies identity, permission, topic scope, and requested intent.
3. Agent messages use structured fields: topic, participants, issue, facts, requested action, deadline, approval requirement, attachments, and provenance.
4. Phone Agent creates decisions, tasks, or questions for the user if needed.
5. Responses disclose only information permitted for that topic and participant.

## Communication Item Model

A communication item represents any inbound or outbound unit of communication:

- Channel: phone call, SMS, email, document, calendar event, manual note, agent message.
- Source provider and provider IDs.
- Sender/caller and recipients/participants.
- Timestamp and direction.
- Raw content reference.
- Transcript, body, or extracted text.
- Summary.
- Extracted facts, tasks, decisions, open questions, deadlines, and conflicts.
- Topic thread association and confidence score.
- Privacy, sensitivity, consent, retention, and sharing flags.

## Topic Thread Model

A topic thread tracks:

- Title and description.
- Current status.
- Participants and related contacts.
- Communication items and timeline.
- Decisions made and decisions pending.
- Open questions.
- Tasks and deadlines.
- Documents and attachments.
- Extracted facts and memory.
- Conflicts or inconsistencies.
- Suggested next actions.
- Confidence scores for automatically attached items.
- Permissions and sharing rules.
- Retention and audit metadata.

## Decisions, Open Questions, And Tasks

The assistant must maintain structured state:

- Decisions made: what was decided, by whom, when, source evidence, reversibility.
- Decisions pending: options, deadline, required approvers, consequences.
- Open questions: owner, due date, source, status, answer when resolved.
- Conflicts: conflicting claims, sources, severity, recommended resolution.
- Tasks: assignee, due date, status, source communication, and follow-up channel.

## Topic Thread As Security Boundary

Topic threads are permission boundaries. A contractor may access "Basement Project" artifacts but cannot access family, medical, work, or car lease threads.

Design requirements:

- Participant-level permissions.
- Thread-level permissions.
- Channel-level permissions.
- Artifact-level sharing controls.
- User approval before sharing sensitive information.
- Data retention policies per thread.
- Audit logs for access, sharing, policy decisions, and AI-generated actions.

## Mobile App Experience

The ideal production mobile app should use three primary bottom-navigation destinations:

- Home: the default destination and daily command center. Home should prioritize horizontally browsable topic cards and recent handled calls. It may show one compact assistant-needs signal with a count when action items are waiting, but it should not render review cards or passive notification history.
- Assistant: live-call control, live answer/transfer requests, topic suggestions, review/action items, assistant notes, test call, and immediate assistant activity. It should answer "what does my assistant need from me, and what can I tell it?" rather than duplicating settings, billing, forwarding, contacts, or long-term history.
- Profile: account identity, assistant identity, forwarding, billing, calendar, contacts, notifications, privacy, support, diagnostics, and logout.

Topics remain the durable memory product, but they should be surfaced through Home cards and an all-topics drill-in instead of a permanent bottom tab. Review/action cards belong primarily on Assistant. Home may show a compact `Assistant needs review` signal that opens Assistant, but it should not duplicate the queue. Passive notifications should not appear on Home; they belong in notification history, Assistant recent activity when relevant, or a Review updates filter. Search should be a quiet utility launched from Home, not a primary tab, until cross-channel search frequency warrants promoting it.

The UI should feel calm, minimal, and executive. It should not feel like a call center.

The authenticated shell should expose Profile as the stable place for account and configuration. Logout must be available from Profile, must require confirmation, and must clear local authenticated cache after signing out.

Recent calls should use compact rows inspired by familiar phone-recents patterns: caller identity, phone number or relationship, timestamp, and direct actions such as call back, details, note, or topic attachment. Rows should stay provider-neutral and should not show long summaries inline.

For beta readiness, the app must make activation obvious. The user should always know what remains before the assistant is useful, how to make a test call, and whether the first useful handled call has happened.

The detailed production mobile screen and flow blueprint lives in `docs/mobile-ux-blueprint.md`. Future mobile UI changes should use that document as the source of truth for screen hierarchy, interaction states, empty/error states, notification behavior, and facelift sequencing.

## Agent Behavior Requirements

The voice agent should be natural, concise, transparent, and policy-aware:

- Never say internal variable names, labels, or prompt scaffolding.
- Disclose that it is an AI assistant early in the conversation.
- Ask only the minimum questions needed to identify caller, intent, urgency, and next step.
- Treat known callers according to relationship and trust context.
- Avoid revealing private memory unless the caller is allowed to receive it.
- Request user approval or live answer when the caller needs live attention or a fact the assistant should not guess.
- Handle emergencies by telling the caller to contact emergency services directly and notifying/escalating the user when possible.
- Produce outcomes: message, summary, task, topic suggestion, calendar action, answer request, or transfer request.

## Notification Product Requirements

Notifications are a first-class product surface because they replace the default phone ring. They must be reliable, actionable, privacy-safe, and explainable.

Required notification types:

- Live transfer request.
- Live answer request.
- Call summary.
- Topic suggestion.
- Decision pending.
- Calendar created, updated, or failed.
- Forwarding/setup issue.
- Assistant offline or provider issue.
- Sensitive/privacy review.

Each notification type must define priority, expiration, default privacy level, deep-link target, and allowed actions. Live transfer notifications should arrive within `3s`, expire after `60s`, and show expired state if opened late. Live answer notifications should arrive within `3s`, expire after `90s`, and deep link to the answer composer. Call summary notifications should arrive within `15s` after analysis and avoid transcript content by default. Calendar change notifications should arrive within `10s` after create/update/failure and use generic content unless the user allows calendar details.

The app must maintain an in-app notification center/history so important requests are not lost if Android notification delivery fails. Lock-screen notifications must not expose transcript snippets, assistant notes, sensitive topic content, or detailed calendar descriptions by default.

Android production delivery uses Firebase Cloud Messaging. The app should register its FCM token after authenticated sign-in, refresh it when Firebase rotates the token, and handle data-only pushes by opening or refreshing the relevant app surface. The Android app must not use periodic polling as a live-request fallback. If FCM is delayed or unavailable, the durable in-app notification center is refreshed on app launch, explicit navigation, pull/manual refresh where offered, or notification deep-link open.

Live notification actions must be production-grade. Accepting or declining a transfer from the Android notification shade must work even when the app process is not already open, must dismiss or replace the original request notification, must give clear success/failure feedback, and must be idempotent so repeated taps cannot send duplicate decisions. Live answer notifications must support Android inline reply so the user can answer from the notification shade while the assistant is still on the call. When the app is already open, live answer and transfer requests should bring the Assistant live section forward automatically. If a transfer or answer request has expired, tapping the notification or submitting an action must show an explicit expired state instead of a dead screen or generic server error. In-app live answer send must also show immediate terminal feedback: `Answer sent` on success or `This answer request expired` when the assistant can no longer relay it.

Notification reliability must be observable. The system should track delivery attempts, action outcomes, latency, expired actions, disabled push tokens, and crash/error reports without storing private communication content in telemetry.

## Success Metrics

- Percentage of communications attached to the correct topic.
- User acceptance rate for AI topic suggestions.
- Reduction in avoidable phone interruptions.
- False negative rate for urgent interruptions.
- Percentage of calls or messages producing useful structured outcomes.
- Number of active topic threads with decisions, tasks, or open questions.
- Time saved finding context for a topic.
- Conflict detection precision and usefulness.
- External participant response rate to shared artifacts.
- User trust in sharing, permissions, and memory.
- Repeat caller/topic recognition accuracy.
- Onboarding completion rate.
- First useful handled call conversion rate.
- Cost per handled call and gross margin by plan.
- Agent eval pass rate before deployment.

## Product Analytics Requirements

Phone Agent needs dense, high-fidelity engagement tracking before a broader beta. The product team should be able to answer activation, retention, feature adoption, funnel, and reliability questions without reading private communication content.

Track:

- App opens, sessions, screen views, tab selection, profile/settings opens, and logout.
- Onboarding step views, completions, failures, retries, and elapsed time.
- Forwarding screen opens, dial-code taps, copy-code taps, and test-call starts.
- Call row opens, call-back taps, note taps, detail opens, and topic-attach actions.
- Assistant presence state changes, live request views, answer/transfer actions, and expired live requests.
- Topic card impressions, topic opens, topic creates, suggestion accepts/dismissals, and review queue actions.
- Billing setup opens, card setup returns, cap changes, usage views, and billing issue recovery actions.

Do not track:

- Transcript text, summaries, note bodies, live-answer text, search query text, contact book contents, calendar descriptions, payment details, or raw provider payloads.

Analytics should support per-user, per-session, per-screen, per-action, and per-object aggregation while preserving user trust.

## Product Risks

- Topic classification errors may attach sensitive communication to the wrong thread.
- Cross-channel memory may feel invasive unless transparent and controllable.
- Permissioned sharing can damage trust if scoped incorrectly.
- Agent-to-agent communication may outpace standards, identity, and consent models.
- Retell or any voice provider may limit control, latency, cost, or transfer reliability.
- The product may collapse back into call history if topic threads are not central in UX and data model.
- Legal requirements around recording, AI disclosure, privacy, and third-party data may constrain defaults.

## Differentiation

Phone Agent differs from voicemail because it is live, interactive, outcome-oriented, and topic-aware.

Phone Agent differs from call screening because it builds persistent cross-channel memory and structured topic state.

Phone Agent differs from WhatsApp-style VoIP because it improves the user's existing communication channels instead of requiring everyone to install the same app.

Phone Agent differs from a Retell wrapper because Retell is only one replaceable voice runtime. The moat is cross-channel topic memory, permissioned context, interruption policy, and workflow outcomes.
