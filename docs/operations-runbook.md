# Operations Runbook

## Purpose

This runbook defines the first production operations layer for Phone Agent. It covers service health, alert signals, incident triage, billing/provider checks, and release verification for the current Cloud Run deployment.

Phone Agent handles user communication, live calls, billing state, and assistant actions. Operational monitoring must therefore catch both ordinary API failures and user-impacting communication failures.

## Current Production Surface

- Backend: Cloud Run service `phone-agent` in project `phone-agent-43313`, region `us-central1`.
- Public URL: `https://phone-agent-47585065917.us-central1.run.app`.
- Health endpoint: `GET /readyz`.
- Persistence: Firestore.
- Authentication: Firebase Auth for client APIs.
- Payments: Stripe test-mode catalog and subscriptions.
- Voice runtime: initial voice provider adapter.
- Notifications: FCM plus durable backend notification records.

## Service Health Checks

### Readiness

Command:

```powershell
curl.exe -sS https://phone-agent-47585065917.us-central1.run.app/readyz
```

Expected response:

```json
{ "status": "ok" }
```

Escalate if:

- The endpoint returns a non-`2xx` response for `2` consecutive checks.
- The endpoint takes longer than `5` seconds for `3` consecutive checks.
- Cloud Run reports no ready revision serving `100%` traffic.

### Cloud Run Revision

Command:

```powershell
gcloud run services describe phone-agent `
  --project phone-agent-43313 `
  --region us-central1 `
  --format "table(status.latestReadyRevisionName,status.traffic[0].revisionName,status.traffic[0].percent)"
```

Healthy state:

- `latestReadyRevisionName` is populated.
- The ready revision receives `100%` traffic unless a deliberate rollout is underway.

## Alert Policies

Minimum closed-beta alert policies:

| Alert | Threshold | Window | Severity | User impact |
| --- | --- | --- | --- | --- |
| API readiness failure | `/readyz` fails | `2` minutes | Critical | App, webhooks, billing, and tools may fail |
| Cloud Run 5xx responses | `>= 1` 5xx request | `5` minutes | Critical | Client or provider requests are failing |
| Cloud Run high latency | p95 latency `> 3s` | `5` minutes | Warning | Voice/tool flows may feel slow |
| Provider webhook errors | error logs on webhook routes | `5` minutes | Critical | Calls, transcripts, or billing events may not process |
| Billing reconciliation failure | reconciliation exits non-zero | each scheduled run | Critical | Revenue, duplicate subscription, or cap enforcement risk |
| FCM delivery failures | elevated failed sends | `15` minutes | Warning | User may miss live call actions |

Current setup creates service-level readiness, 5xx, latency, provider webhook, billing failure, and FCM delivery failure monitors. As of `2026-06-03`, those policies are attached to the email notification channel `dflagg@gmail.com`; verify the channel in Cloud Monitoring if Google sends a confirmation email. Billing reconciliation still needs a scheduled job and alert wrapper before public launch.

## Incident Triage

### API Down

1. Check readiness:

```powershell
curl.exe -sS https://phone-agent-47585065917.us-central1.run.app/readyz
```

2. Check latest revision and traffic:

```powershell
gcloud run services describe phone-agent --project phone-agent-43313 --region us-central1
```

3. Read recent errors:

```powershell
gcloud logging read `
  "resource.type=cloud_run_revision AND resource.labels.service_name=phone-agent AND severity>=ERROR" `
  --project phone-agent-43313 `
  --limit 50 `
  --format "table(timestamp,severity,textPayload,jsonPayload.message)"
```

4. If the latest revision is unhealthy and the previous revision was healthy, roll back traffic in Cloud Run.

### Webhooks Failing

Check for recent webhook errors without exposing raw call content:

```powershell
gcloud logging read `
  "resource.type=cloud_run_revision AND resource.labels.service_name=phone-agent AND severity>=ERROR" `
  --project phone-agent-43313 `
  --limit 100
```

Look for sanitized error codes around:

- Inbound voice context.
- Call lifecycle events.
- Billing webhooks.
- Calendar tools.
- Notification actions.

Do not paste raw transcripts, caller notes, provider secrets, card data, or calendar descriptions into tickets.

### Billing Problem

Run reconciliation:

```powershell
$env:GOOGLE_CLOUD_PROJECT = "phone-agent-43313"
$env:STRIPE_SECRET_KEY = "<stripe-secret-key>"
npm run billing:reconcile
```

Escalate if:

- A user has duplicate active subscriptions.
- A local active account has no active provider subscription.
- Meter events repeatedly fail to publish.
- A spending cap is bypassed.
- Local invoice mirrors are missing for recent paid or failed invoices after Stripe webhook delivery.

### Analytics Export

Export privacy-safe product analytics rows for dashboard prototyping or warehouse loading:

```powershell
$env:GOOGLE_CLOUD_PROJECT = "phone-agent-43313"
$env:ANALYTICS_EXPORT_SINCE = "2026-06-01T00:00:00Z"
$env:ANALYTICS_EXPORT_OUTPUT = ".\\exports\\analytics-2026-06-01.ndjson"
npm run analytics:export
```

The export intentionally strips blocked attribute keys such as transcript, summary, note, answer, query, contact, calendar, payment, secret, token, and raw payload fields. Escalate if the export command fails, exports zero rows for a known-active period, or dashboard rows contain sensitive content.

### Voice Provider Problem

Check:

- Public backend health.
- Voice provider webhook configuration.
- Voice provider dashboard for call errors.
- Recent backend logs for signature verification, billing block, route lookup, or tool failure codes.

If provider-side calls fail but `/readyz` is healthy, do not redeploy first. Verify provider webhook URLs, signatures, and number routing.

## Release Verification

Before shifting traffic after a backend deploy:

```powershell
npm run typecheck
npm test
npm run agent:evals
npm audit --omit=dev
```

After deploy:

```powershell
curl.exe -sS https://phone-agent-47585065917.us-central1.run.app/readyz
gcloud run services describe phone-agent --project phone-agent-43313 --region us-central1 `
  --format "table(status.latestReadyRevisionName,status.traffic[0].revisionName,status.traffic[0].percent)"
```

For Android release candidates:

- Build an AAB with release signing configured.
- Install or distribute through an internal testing track.
- Verify first-run onboarding, billing setup, assistant number assignment, forwarding instructions, call detail, notification actions, and calendar status.
- Confirm Crashlytics receives a non-sensitive test crash before closed beta.

## Data Safety During Incidents

Never include these in logs, tickets, screenshots, or chat:

- Full transcripts.
- Active user notes.
- Caller memory.
- Calendar descriptions.
- Raw provider payloads.
- Payment method details.
- Secret values.

Use object IDs, sanitized error codes, revision names, and timestamps instead.

## Notification Channel Setup

Cloud Monitoring policies should route to an operator-owned notification channel before closed beta.

Required channel:

- Type: email, PagerDuty, Slack, or equivalent.
- Owner: production operator.
- Coverage: backend health, 5xx, latency, webhook failures, billing reconciliation failure.

Current local setup created an email notification channel through the Cloud Monitoring API and attached it to the existing policies. If the channel becomes unverified or needs to change, update it in the Google Cloud Console and keep all six Phone Agent policies attached.
