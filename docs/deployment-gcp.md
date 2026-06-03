# GCP Deployment

Phone Agent should run on Cloud Run for the first production-minded deployment. Cloud Run gives us a stable HTTPS URL for Retell webhooks, managed scaling, and Cloud Logging without introducing Kubernetes complexity.

## Target architecture

- Cloud Run: backend API and Retell webhooks.
- Secret Manager: Retell API key and OAuth client secrets.
- Artifact Registry: container images.
- Cloud Build: image builds.
- Cloud Logging: structured application logs.
- Firestore: MVP persistence for calls, caller memory, calendar activity, and early topic-thread data.
- Firebase Authentication: Android phone-number sign-in and backend ID-token verification.

The current MVP deployment uses Firestore for durable state. PostgreSQL remains the likely target once topic threads, participant permissions, cross-channel querying, and retention workflows need stronger relational modeling.

## Current GCP context

The local `gcloud` config is currently set to:

- Project: `phone-agent-43313`
- Account: `dflagg@gmail.com`

## Deploy

Load local secrets into the current shell first:

```powershell
$env:RETELL_API_KEY = "<retell-api-key>"
$env:RETELL_DEFAULT_AGENT_ID = "agent_f01f598fee49ba8e238f3124bc"
$env:RETELL_DEFAULT_FROM_NUMBER = "+19143593659"
$env:FIREBASE_PROJECT_ID = "phone-agent-43313"
$env:STRIPE_PUBLISHABLE_KEY = "<stripe-publishable-key>"
$env:STRIPE_SECRET_KEY = "<stripe-secret-key>"
$env:STRIPE_WEBHOOK_SECRET = "<stripe-webhook-signing-secret>"
$env:STRIPE_PRICE_PERSONAL_MONTHLY = "price_..."
$env:STRIPE_PRICE_PERSONAL_CALL_MINUTE_OVERAGE = "price_..."
$env:BILLING_REQUIRED_FOR_PROVISIONING = "false"
$env:BILLING_DEFAULT_SPENDING_CAP_CENTS = "2500"
$env:RATE_LIMIT_WINDOW_MS = "60000"
$env:RATE_LIMIT_MAX_REQUESTS = "120"
$env:WEBHOOK_RATE_LIMIT_MAX_REQUESTS = "600"
```

Then deploy:

```powershell
.\scripts\gcp-deploy.ps1 `
  -ProjectId "phone-agent-43313" `
  -Region "us-central1" `
  -ServiceName "phone-agent"
```

The script will:

- Enable required GCP and Firebase APIs.
- Create an Artifact Registry repository if needed.
- Create/update the `retell-api-key` secret.
- Create/update Stripe Secret Manager entries when `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET` are present.
- Build and push the container image.
- Deploy Cloud Run with unauthenticated access so Retell can call webhooks.

## Configure Retell webhooks

After deployment, set the Retell public base URL to the Cloud Run service URL and update Retell:

```powershell
$env:RETELL_PUBLIC_BASE_URL = "https://phone-agent-xxxxx-uc.a.run.app"
node .\scripts\retell-configure-webhooks.mjs
```

This configures:

- Phone number inbound decision webhook: `/webhooks/retell/inbound`
- Agent lifecycle webhook: `/webhooks/retell/events`

## Configure Stripe webhooks

Create a Stripe webhook endpoint pointing at:

```text
https://phone-agent-xxxxx-uc.a.run.app/webhooks/billing/stripe
```

Required events:

- `checkout.session.completed`
- `payment_method.attached`
- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Store the webhook signing secret as `STRIPE_WEBHOOK_SECRET` and redeploy.

## Configure Stripe catalog

Before enabling production paid usage, configure Stripe products and prices in the target Stripe environment:

```powershell
$env:STRIPE_SECRET_KEY = "<stripe-secret-key>"
npm run stripe:configure-catalog
```

The script creates or reuses Stripe products, Billing Meters, and prices:

- `phone_agent_call_minutes`: Billing Meter for assistant call-minute events.
- `phone_agent_personal_monthly_usd`: `$19/mo` Phone Agent Personal plan.
- `phone_agent_personal_call_minute_overage_usd`: tiered monthly meter with 50 included minutes, then `$0.39/min`.
- AI processing is tracked internally for margin and is not included as a default Stripe price in the Personal plan.

Copy the returned price IDs into deployment configuration as:

- `STRIPE_PRICE_PERSONAL_MONTHLY`
- `STRIPE_PRICE_PERSONAL_CALL_MINUTE_OVERAGE`

Customer records, payment methods, subscriptions, invoices, and usage events are per-user runtime objects. Do not create those manually for normal users.

## Verify

```powershell
curl https://phone-agent-xxxxx-uc.a.run.app/readyz
```

Expected response:

```json
{ "status": "ok" }
```

Then place a test call to:

```text
+1 (914) 359-3659
```

After the call, check:

```powershell
curl https://phone-agent-xxxxx-uc.a.run.app/v1/calls
```

## Configure Cloud Monitoring

Run the monitoring setup after the first successful backend deploy and after service renames:

```powershell
.\scripts\gcp-monitoring-setup.ps1 `
  -ProjectId "phone-agent-43313" `
  -Region "us-central1" `
  -ServiceName "phone-agent" `
  -HostName "phone-agent-47585065917.us-central1.run.app"
```

This creates or reuses:

- Uptime check for `GET /readyz`.
- Alert policy for Cloud Run `5xx` responses.
- Alert policy for high Cloud Run p95 latency.

Attach at least one operator-owned notification channel in Cloud Monitoring before closed beta. The local `gcloud` installation may not include the beta command group required to create notification channels from the CLI, so creating the channel in the Google Cloud Console is acceptable.

Operational triage steps are documented in `docs/operations-runbook.md`.

## Billing reconciliation

Run this after Stripe catalog changes, webhook changes, manual Stripe cleanup, or billing incidents:

```powershell
$env:GOOGLE_CLOUD_PROJECT = "phone-agent-43313"
$env:STRIPE_SECRET_KEY = "<stripe-secret-key>"
npm run billing:reconcile
```

The command checks every local `BillingAccount` against Stripe customers and Personal subscriptions. It exits non-zero when it finds duplicate active subscriptions, a local active account without an active Stripe subscription, a local subscription mismatch, or a local canceled mirror while Stripe still has an active Personal subscription. Output is JSON and intentionally excludes raw card details.

## Production gaps

- Evaluate moving topic-thread and permission-heavy data from Firestore to PostgreSQL on Cloud SQL.
- Configure Firebase Phone Auth for production SMS/voice verification, Android app credentials, and explicit SMS region policy.
- Keep Retell webhook endpoints public but signature-verified.
- Add structured alerting for webhook failures and 5xx responses.
- Add Cloud Armor or API Gateway rate limiting before public launch. The app has process-level limits only as defense in depth.
- Add billing reconciliation and webhook replay dashboards before live billing.
- Verify Stripe webhook event idempotency in test mode using duplicate delivery and retry scenarios before enabling live mode.
- Rotate the Retell API key because it was pasted into chat during setup.
- Rotate the Stripe live secret key because it was pasted into chat during setup.

## Firebase Phone Auth SMS Region Policy

Phone number sign-in requires an explicit SMS region policy. For the current US beta, Firebase Authentication is configured with an allowlist-only policy for `US`.

To verify or reapply the policy:

```powershell
$project = "phone-agent-43313"
$token = gcloud auth print-access-token --project=$project
$body = '{"sms_region_config":{"allowlist_only":{"allowed_regions":["US"]}}}'
curl.exe -X PATCH `
  -H "Authorization: Bearer $token" `
  -H "x-goog-user-project: $project" `
  -H "Content-Type: application/json" `
  -d $body `
  "https://identitytoolkit.googleapis.com/admin/v2/projects/$project/config?updateMask=sms_region_config"
```

Use a narrow allowlist instead of allow-by-default to reduce SMS abuse and surprise verification cost.
