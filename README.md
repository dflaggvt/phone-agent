# Phone Agent

Phone Agent is a cross-channel communication intelligence layer. It starts with AI-native call control for an existing phone number, then grows into topic-aware memory across calls, SMS, email, documents, calendar events, manual notes, and future agent-to-agent messages.

The phone promise remains: "Your phone only rings when it should." The broader product promise is: Phone Agent turns scattered communications into organized topic threads with memory, decisions, open questions, tasks, and next actions.

Retell is the first voice runtime, not the core moat. The application owns communication items, topic threads, identities, permissions, user rules, summaries, decisions, and workflow outcomes.

OpenAI is used for topic classification and extraction when configured. The domain uses a provider-neutral classifier interface. There is no keyword-matching topic fallback; if the classifier is unavailable, communications remain unassigned for manual review.

## Current implementation

This repo currently contains the backend foundation for Retell webhook ingestion plus the initial provider-neutral domain skeleton:

- `POST /webhooks/retell/inbound`: Retell inbound-call decision webhook. Returns agent override, metadata, and dynamic variables for the call.
- `POST /webhooks/retell/events`: Retell call lifecycle webhook. Normalizes `call_started`, `call_ended`, `call_analyzed`, transcript, and transfer events into Phone Agent call sessions and generic `CommunicationItem` records.
- Firebase ID-token verification for client APIs. Android uses Firebase Phone Auth; the backend creates/loads the user from the verified Firebase `uid`.
- `GET /v1/me` and `PATCH /v1/me/config`: authenticated user/config summary and setup updates.
- `PATCH /v1/me/assistant-profile`: saves provider-neutral assistant behavior settings that are translated into Retell dynamic variables.
- `POST /v1/onboarding/assistant-number`: guarded Retell number assignment/provisioning endpoint.
- `GET /v1/notifications`: privacy-safe product notification feed for live requests, summaries, topic suggestions, and calendar changes.
- `POST /v1/notifications/:id/read` and `/dismiss`: notification state updates for in-app history and recovery.
- `POST /v1/outbound-calls`: guarded Retell create-phone-call endpoint for approved outbound/test calls.
- `GET /v1/calls`: call-history endpoint backed by memory or Firestore depending on configuration.
- `GET /v1/communications`: channel-neutral communication inbox.
- `GET /v1/communications/:id`: communication item detail.
- `GET /v1/topics` and `POST /v1/topics`: topic thread list and manual creation.
- `GET /v1/topics/:id`: topic thread detail.
- `POST /v1/topics/:id/communications`: manually attach a communication item to a topic.
- `POST /v1/topics/:id/decisions`: create a pending decision on a topic.
- `POST /v1/topics/:id/open-questions`: create an open question on a topic.
- `POST /v1/topics/:id/tasks`: create a topic task.
- `GET /v1/topic-suggestions`: pending topic suggestions for review.
- `POST /v1/topic-suggestions/:id/accept`: accept a suggestion and attach or create the topic.
- `POST /v1/topic-suggestions/:id/dismiss`: dismiss a suggestion.
- `GET /readyz`: health check.
- `GET /v1/billing/usage`: current usage and plan limits.
- `GET /v1/onboarding/status`: setup checklist and activation state.
- `GET /v1/calendar/status`, `/connect-url`, `/disconnect`, and `/event-requests`: authenticated user-scoped calendar connection and assistant calendar activity.
- `POST /v1/analytics/events`: first-party, privacy-safe product analytics ingestion. The backend rejects attributes that look like transcripts, notes, search text, contact data, calendar descriptions, payment data, provider payloads, or secrets.
- `src/domain/communications`: provider-neutral `CommunicationItem` model for calls, SMS, email, calendar events, documents, manual notes, and agent messages.
- `src/domain/topics`: `TopicThread`, participant, decision, open question, and task model skeleton.
- `src/domain/providers`: provider-neutral voice provider contracts.
- `src/infrastructure/persistence`: in-memory and Firestore repositories for communication items, topic threads, and topic suggestions.
- `src/infrastructure/openai`: OpenAI implementation of provider-neutral communication classification.
- `scripts/agent-evals.mjs`: deterministic agent behavior eval harness.

The repo also contains an Android app under `android/`:

- Firebase Phone Auth first-run onboarding with real SMS/voice verification.
- Profile and Settings opened from the assistant presence/avatar control, including logout.
- Communication Inbox backed by `/v1/communications`.
- Topic Threads backed by `/v1/topics`.
- Topic creation, communication attachment, and basic topic detail.
- Live call history from Cloud Run.
- Call detail summaries and transcripts.
- Forwarding setup dial codes.
- Local shell for rules, settings, calendar activity, and future topic views.

The deployed MVP can use Firestore. The target production data store may move to PostgreSQL when topic threads, permissions, and cross-channel querying become central.

## Local setup

```bash
npm install
cp .env.example .env
npm run dev
```

Useful local commands:

```bash
npm run typecheck
npm test
npm run build
```

For local Retell webhook testing, expose the server with a tunnel and configure Retell:

- Inbound webhook URL: `https://your-tunnel.example/webhooks/retell/inbound`
- Agent or account webhook URL: `https://your-tunnel.example/webhooks/retell/events`
- Events: `call_started`, `call_ended`, `call_analyzed`, `transcript_updated`, `transfer_started`, `transfer_bridged`, `transfer_cancelled`, `transfer_ended`

Set `RETELL_API_KEY` and keep `RETELL_INBOUND_WEBHOOK_VERIFY=true` outside tests.
Set `RETELL_DEFAULT_FROM_NUMBER` to the Retell-managed or imported phone number used for outbound calls.
Set `FIREBASE_PROJECT_ID` so the backend can verify Android Firebase ID tokens.
Set `GOOGLE_OAUTH_STATE_SECRET` when Google Calendar OAuth is enabled. This must be a managed secret in deployed environments.
Set `PERSISTENCE_DRIVER=firestore` for deployed environments so call history, calendar state, billing, analytics, webhook idempotency, and shared rate limits are durable.

Client API calls under `/v1` require:

```text
Authorization: Bearer <Firebase ID token>
```

### Approved outbound test call

Retell's create-phone-call API requires a Retell-owned or imported `from_number` and an E.164 `to_number`. The backend requires `approved: true` and a human-readable `reason`.

```bash
curl -X POST http://localhost:3000/v1/outbound-calls \
  -H "content-type: application/json" \
  -d '{
    "approved": true,
    "toNumber": "+12137774445",
    "reason": "Run a controlled Retell integration test."
  }'
```

Do not use this endpoint for autonomous outbound calling until approval, audit, compliance, and user controls are implemented.

## Documentation

Start here before implementing:

- [Product requirements](docs/product-requirements.md)
- [Technical design](docs/technical-design.md)
- [Architecture](docs/architecture.md)
- [Roadmap](docs/roadmap.md)
- [Implementation plan](docs/implementation-plan.md)
- [Monetization and billing](docs/monetization.md)
- [Open questions](docs/open-questions.md)

## Verification

```bash
npm run typecheck
npm test
npm run build
```

## GCP deployment

Cloud Run deployment instructions live in [docs/deployment-gcp.md](docs/deployment-gcp.md).

## Android app

Android build instructions live in [android/README.md](android/README.md).
