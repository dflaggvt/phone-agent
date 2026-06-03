# Agent Instructions

## Project Purpose

Phone Agent is a cross-channel communication intelligence layer. It begins as an AI-native phone agent for a user's existing number, but the durable product organizes calls, SMS, email, documents, calendar events, manual notes, and future agent-to-agent messages into persistent topic threads.

The original phone promise still matters: "Your phone only rings when it should." The expanded promise is: Phone Agent turns scattered calls, texts, emails, and messages into organized, topic-aware threads with memory, decisions, and next actions.

Retell is initial voice infrastructure, not the moat. The application must own the domain model, topic memory, user rules, permissions, identities, summaries, decisions, open questions, tasks, audit logs, and workflow outcomes.

## Product Principles

- The assistant should understand the situation, not just the message.
- Topic threads are the core product object.
- Calls are one type of communication item.
- The phone should not ring first; the system should understand intent first.
- Human interruption is expensive and should be protected.
- The AI agent should be helpful but not deceptive.
- The user should remain in control.
- The system should be reversible and transparent.
- Communications should produce outcomes: summaries, decisions, tasks, reminders, open questions, and follow-ups.
- Cross-channel topic memory is the moat.
- Permissioned sharing must be useful, transparent, scoped, revocable, and trust-building.
- Topic threads are security boundaries.
- Privacy, consent, and trust are core product requirements, not afterthoughts.

## Architecture Principles

- Keep `TopicThread` and `CommunicationItem` domain-owned and provider-neutral.
- Keep Retell, Google, Twilio, Gmail, SMS, and document-provider payloads inside adapters.
- Prefer provider abstractions over hard-coded vendors.
- Design for future SMS, email, document, calendar, WhatsApp, Slack, Teams, and agent-to-agent ingestion.
- Start with call forwarding to prove the live voice experience.
- Do not require users to port their number for the first version.
- Do not require callers or external participants to install an app.
- Keep the architecture modular.
- Make observability, auditability, and permissions first-class.
- Prefer production-grade patterns over throwaway prototype code.

## Coding Standards

- Keep domain boundaries clear: providers, communications, topics, permissions, classification, interruption, notifications, and sharing should not bleed into each other.
- The most important model is `TopicThread`, not `Call`.
- Represent calls, SMS, email, documents, calendar events, manual notes, and agent messages as `CommunicationItem` records.
- Use provider-neutral domain models inside the application.
- Keep caller memory distinct from topic memory and raw transcripts.
- Keep user-authored notes distinct from durable memory.
- Keep assistant profiles provider-neutral; translate them into Retell dynamic variables only inside voice adapters/services.
- Never introduce a new hard-coded owner, phone number, Retell agent, transfer destination, or calendar assumption. Resolve user context through authenticated client sessions or provider routing.
- Guard paid provider side effects such as phone-number purchase behind verification, plan, and idempotency checks.
- Make topic attachment confidence, provenance, and review state explicit.
- Make decisions, open questions, tasks, and conflicts structured data, not only summary text.
- Make permissions explicit at thread, participant, channel, artifact, and action levels.
- Avoid logging raw communication content in application logs.
- Treat notifications as product objects. Create privacy-safe `NotificationEvent` records instead of scattering ad hoc push/local notification text across the app.
- Default notification payloads must not expose transcripts, assistant notes, sensitive topics, or detailed calendar descriptions on the lock screen.
- Version prompts, classification schemas, extraction schemas, and routing policies when they affect user-visible behavior.
- Build fallback paths for provider failures, model failures, notification failures, transfer failures, classification failures, and permission denials.

## Documentation Standards

- Update docs in the same change as architecture, product scope, provider behavior, security posture, or compliance behavior changes.
- Do not implement features without updating relevant docs first.
- Keep `docs/product-requirements.md` aligned with user-facing behavior.
- Keep `docs/technical-design.md` aligned with implementation architecture and operational assumptions.
- Keep `docs/architecture.md` diagrams current when service boundaries, data flows, domain objects, or provider abstractions change.
- Keep `docs/roadmap.md` current when phase scope changes.
- Keep `docs/open-questions.md` current as assumptions are answered or new risks emerge.
- Keep `docs/implementation-plan.md` current when build sequencing changes.
- Keep `docs/mobile-ux-blueprint.md` current when Android/mobile navigation, screen hierarchy, visual system, notification behavior, empty/error states, or user flows change.
- Keep `docs/monetization.md` current when pricing, billing, metering, payment provider behavior, spending caps, paid-resource gates, or cost assumptions change.

## Mobile UX Standards

- Treat `docs/mobile-ux-blueprint.md` as the source of truth for production mobile screen and flow design.
- The production Android UI direction is Kotlin + Jetpack Compose. Treat the legacy Java activity as prototype scaffolding during migration, not the long-term UX foundation.
- Prefer reusable Compose design-system components and previewable fixture states over one-off programmatic layouts.
- Mobile UX documentation must include measurable details: dimensions, typography, spacing, counts, timing thresholds, loading/error states, QA viewports, and acceptance criteria.
- Keep the production mobile app centered on the blueprint IA: Home, Topics, Inbox, Assistant, and Search unless the blueprint changes first.
- Topic threads should remain visually central; call history should not take over the product shape.
- Every primary screen needs loading, empty, error, offline, and stale-data behavior where applicable.
- Verify significant Android UI changes with screenshots on a connected device or emulator before calling the work done.
- The app should feel calm, minimal, and executive, not like an internal admin panel or call-center tool.

## Testing Expectations

- Add unit tests for domain models, provider adapters, topic attachment, permissions, routing/interruption rules, and structured AI output parsing.
- Add contract tests for provider webhook normalization.
- Add integration tests for inbound call handling, communication item creation, topic suggestions, notification delivery, and warm transfer.
- Add scenario tests for AI behavior before changing prompts or routing/classification policy.
- Test idempotency for repeated provider webhooks.
- Test authorization on every user-owned and thread-scoped resource.
- Test privacy, sharing, and retention behavior for recordings, transcripts, summaries, documents, and topic memory.

## Security Expectations

- Verify provider webhook signatures and protect against replay.
- Encrypt sensitive data in transit and at rest.
- Store secrets in managed secret storage, not source control.
- Use least-privilege service credentials and provider scopes.
- Enforce user-owned data boundaries.
- Enforce thread-level access control.
- Audit sensitive access, sharing, permission decisions, and AI actions.
- Do not let the agent disclose remembered facts or thread context unless policy allows it.
- Avoid sensitive notification payloads unless explicitly allowed by user settings.
- Treat consent, disclosure, recording, retention, and external sharing as core system behavior.
- Treat billing as a trust and safety system. Do not provision paid numbers, start paid AI/voice usage, or send billable external messages unless billing state, spending caps, and idempotent usage recording are in place for that path.
- Never store raw card details. Use a payment provider token/portal/SDK and store only non-sensitive payment method display metadata.

## Working With Docs And Implementation

Before implementing a feature:

1. Read `AGENTS.md`.
2. Check relevant docs for intended behavior.
3. Update docs if the implementation requires a new assumption or changes an existing one.
4. Prefer provider/domain abstractions over direct vendor coupling.
5. Add tests that cover domain behavior, not only framework plumbing.
6. Add observability for user-impacting communication flows.

When architecture changes, update docs in this order:

1. `docs/product-requirements.md` for user-facing behavior and product shape.
2. `docs/technical-design.md` for component behavior and operational design.
3. `docs/architecture.md` for diagrams and data flow.
4. `docs/roadmap.md` for phase scope.
5. `docs/open-questions.md` for assumptions, risks, and unresolved decisions.
6. `docs/implementation-plan.md` for execution sequencing.
7. `docs/monetization.md` for pricing, billing gates, metering, payment provider behavior, and margin assumptions.
