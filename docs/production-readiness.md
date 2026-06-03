# Production Readiness

## Current Readiness

Phone Agent is a private alpha. It has real backend deployment, Firebase auth, Retell voice handling, Stripe billing foundation, Android onboarding, FCM notifications, topic-thread foundations, and basic observability. It is not ready for public Google Play launch until the launch blockers below are closed.

Working readiness score: `5/10`.

## Launch Gates

### Gate 1: Private Alpha

Status: mostly complete.

Required:

- Cloud Run backend deployed.
- Firebase Phone Auth enabled for Android.
- Retell inbound call flow working.
- Android debug install usable by the founder.
- Payment method setup and billing gates available in test mode.
- FCM push notification delivery working.
- Crash reporting included in Android builds.

Remaining:

- Validate live transfer, inline answer, and expired-request flows with real calls.
- Confirm Crashlytics receives a non-sensitive test crash in a non-debug build.

### Gate 2: Internal Google Play Test

Status: not complete.

Required:

- Android release signing configured.
- Internal test track app bundle produced.
- App versioning policy.
- Privacy policy URL.
- Terms of service URL.
- Data safety answers drafted.
- Support email configured.
- Release notes.
- At least `10` successful onboarding/call test passes on real devices.
- Crash-free install, signup, billing, onboarding, call history, and notification action flows.

### Gate 3: Closed Beta With Real Users

Status: blocked.

Required:

- Legal review of call recording, AI disclosure, TCPA/outbound AI limits, privacy policy, terms, refunds, and data deletion.
- Rate limiting at edge or API gateway.
- Cloud alerting for `5xx`, uptime, latency, webhook failures, billing failures, voice-provider failures, FCM failures, and negative-margin usage.
- Operator runbooks for failed billing, failed Retell webhooks, stuck onboarding, and user deletion.
- Secret rotation for keys previously pasted in chat.
- Billing reconciliation scheduled and monitored.
- No known duplicate subscription or duplicate meter-event path.
- Production support workflow.

### Gate 4: Public Launch

Status: blocked.

Required:

- External security review.
- Data deletion/export workflow.
- Retention policy enforcement jobs.
- Formal incident response plan.
- Provider contract review.
- At least `99%` successful authenticated app launch rate in closed beta.
- At least `95%` successful notification action completion for live requests.
- Demonstrated gross margin by plan/user segment.
- App Store/Google Play policy review complete.

## Priority Blockers

| Priority | Area | Blocker | Owner | Status |
| --- | --- | --- | --- | --- |
| P0 | Legal | Privacy policy, terms, AI disclosure, recording consent, refunds, deletion | Founder + counsel | Pending |
| P0 | Security | Rotate Retell, OpenAI, Google OAuth, and Stripe keys pasted in chat | Founder/operator | Pending |
| P0 | Android | Release signing and Play internal test app bundle | Engineering | In progress |
| P0 | Reliability | Real-call test matrix for transfer, inline answer, expired actions | Founder + engineering | Pending |
| P0 | Observability | Cloud alerting for backend uptime, 5xx, and latency is configured; provider/billing-specific monitors still needed | Engineering | Partial |
| P1 | Billing | Reconciliation schedule and operator review process | Engineering | Partial |
| P1 | Data | Deletion/export endpoints and retention jobs | Engineering | Pending |
| P1 | Abuse | Edge rate limiting and SMS/phone auth abuse controls | Engineering | Partial |
| P1 | UX | Production onboarding polish and supportable error states | Design + engineering | Partial |

## Immediate Engineering Tasks

1. Configure Android release signing through environment variables or local Gradle properties.
2. Add backend process-level rate limiting as a defense-in-depth guard before edge rate limiting.
3. Add Cloud Monitoring alert policy documentation and scriptable setup. Completed for uptime, 5xx, and latency; remaining provider/billing alerts need log-based metrics or scheduled jobs.
4. Create legal/compliance draft checklist for counsel review.
5. Create release checklist for Play internal testing.
6. Verify Crashlytics in a non-debug build.

## Non-Negotiable Production Rules

- Do not launch public users until paid-resource gates are enabled.
- Do not launch public users until keys pasted into chat are rotated.
- Do not launch public users until legal disclosures are reviewed.
- Do not expose provider names or model internals in consumer UX.
- Do not store raw card details.
- Do not include transcripts, answers, notes, caller memory, or calendar details in notification payloads or telemetry.
- Do not treat Retell as the domain model or durable moat.
