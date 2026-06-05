param(
  [string]$ProjectId = "phone-agent-43313",
  [string]$Region = "us-central1",
  [string]$ServiceName = "phone-agent",
  [string]$Repository = "phone-agent",
  [string]$ImageTag = "latest",
  [string]$RetellDefaultAgentId = $env:RETELL_DEFAULT_AGENT_ID,
  [string]$RetellDefaultFromNumber = $env:RETELL_DEFAULT_FROM_NUMBER,
  [string]$UserTransferPhoneNumber = $env:USER_TRANSFER_PHONE_NUMBER,
  [string]$TransferApprovalTimeoutMs = $env:TRANSFER_APPROVAL_TIMEOUT_MS,
  [string]$LiveAnswerTimeoutMs = $env:LIVE_ANSWER_TIMEOUT_MS,
  [string]$FirebaseProjectId = $env:FIREBASE_PROJECT_ID,
  [string]$BillingPlan = $env:BILLING_PLAN,
  [string]$BillingMonthlyIncludedMinutes = $env:BILLING_MONTHLY_INCLUDED_MINUTES,
  [string]$BillingMonthlyClassificationLimit = $env:BILLING_MONTHLY_CLASSIFICATION_LIMIT,
  [string]$BillingRequiredForProvisioning = $env:BILLING_REQUIRED_FOR_PROVISIONING,
  [string]$BillingDefaultSpendingCapCents = $env:BILLING_DEFAULT_SPENDING_CAP_CENTS,
  [string]$RateLimitWindowMs = $env:RATE_LIMIT_WINDOW_MS,
  [string]$RateLimitMaxRequests = $env:RATE_LIMIT_MAX_REQUESTS,
  [string]$WebhookRateLimitMaxRequests = $env:WEBHOOK_RATE_LIMIT_MAX_REQUESTS,
  [string]$SelfServeRetellProvisioning = $env:SELF_SERVE_RETELL_PROVISIONING,
  [string]$AppPublicBaseUrl = $env:APP_PUBLIC_BASE_URL,
  [string]$StripePublishableKey = $env:STRIPE_PUBLISHABLE_KEY,
  [string]$StripeWebhookSecret = $env:STRIPE_WEBHOOK_SECRET,
  [string]$StripePricePersonalMonthly = $env:STRIPE_PRICE_PERSONAL_MONTHLY,
  [string]$StripePricePersonalCallMinuteOverage = $env:STRIPE_PRICE_PERSONAL_CALL_MINUTE_OVERAGE,
  [string]$GoogleOAuthClientId = $env:GOOGLE_OAUTH_CLIENT_ID,
  [string]$GoogleOAuthClientSecret = $env:GOOGLE_OAUTH_CLIENT_SECRET,
  [string]$GoogleOAuthRedirectUri = $env:GOOGLE_OAUTH_REDIRECT_URI,
  [string]$OpenAiClassifierModel = $env:OPENAI_CLASSIFIER_MODEL
)

$ErrorActionPreference = "Stop"

if (-not $env:RETELL_API_KEY) {
  throw "RETELL_API_KEY must be set in the current shell. Do not pass it on the command line."
}

if (-not $RetellDefaultAgentId) {
  throw "RETELL_DEFAULT_AGENT_ID is required."
}

if (-not $RetellDefaultFromNumber) {
  throw "RETELL_DEFAULT_FROM_NUMBER is required."
}

$image = "$Region-docker.pkg.dev/$ProjectId/$Repository/$ServiceName`:$ImageTag"

Write-Host "Configuring GCP project $ProjectId in $Region..."
gcloud config set project $ProjectId | Out-Null

Write-Host "Enabling required services..."
gcloud services enable `
  run.googleapis.com `
  firebase.googleapis.com `
  identitytoolkit.googleapis.com `
  artifactregistry.googleapis.com `
  cloudbuild.googleapis.com `
  secretmanager.googleapis.com `
  logging.googleapis.com

Write-Host "Ensuring Artifact Registry repository exists..."
$repoExists = gcloud artifacts repositories list `
  --location $Region `
  --filter "name:$Repository" `
  --format "value(name)"

if (-not $repoExists) {
  gcloud artifacts repositories create $Repository `
    --repository-format docker `
    --location $Region `
    --description "Phone Agent container images"
}

Write-Host "Ensuring Secret Manager secret exists..."
$secretExists = gcloud secrets list --filter "name:retell-api-key" --format "value(name)"
if (-not $secretExists) {
  gcloud secrets create retell-api-key --replication-policy automatic
}

Write-Host "Adding a new Retell API key secret version..."
$secretTempFile = New-TemporaryFile
try {
  Set-Content -NoNewline -Path $secretTempFile -Value $env:RETELL_API_KEY
  gcloud secrets versions add retell-api-key --data-file=$secretTempFile
} finally {
  Remove-Item -LiteralPath $secretTempFile -Force -ErrorAction SilentlyContinue
}

if ($GoogleOAuthClientSecret) {
  Write-Host "Ensuring Google OAuth client secret exists..."
  $googleSecretExists = gcloud secrets list --filter "name:google-oauth-client-secret" --format "value(name)"
  if (-not $googleSecretExists) {
    gcloud secrets create google-oauth-client-secret --replication-policy automatic
  }

  Write-Host "Adding a new Google OAuth client secret version..."
  $googleSecretTempFile = New-TemporaryFile
  try {
    Set-Content -NoNewline -Path $googleSecretTempFile -Value $GoogleOAuthClientSecret
    gcloud secrets versions add google-oauth-client-secret --data-file=$googleSecretTempFile
  } finally {
    Remove-Item -LiteralPath $googleSecretTempFile -Force -ErrorAction SilentlyContinue
  }
}

$openAiSecretExists = gcloud secrets list --filter "name:openai-api-key" --format "value(name)"
if ($env:OPENAI_API_KEY) {
  if (-not $openAiSecretExists) {
    Write-Host "Ensuring OpenAI API key secret exists..."
    gcloud secrets create openai-api-key --replication-policy automatic
  }

  Write-Host "Adding a new OpenAI API key secret version..."
  $openAiSecretTempFile = New-TemporaryFile
  try {
    Set-Content -NoNewline -Path $openAiSecretTempFile -Value $env:OPENAI_API_KEY
    gcloud secrets versions add openai-api-key --data-file=$openAiSecretTempFile
  } finally {
    Remove-Item -LiteralPath $openAiSecretTempFile -Force -ErrorAction SilentlyContinue
  }
}

$stripeSecretExists = gcloud secrets list --filter "name:stripe-secret-key" --format "value(name)"
if ($env:STRIPE_SECRET_KEY) {
  if (-not $stripeSecretExists) {
    Write-Host "Ensuring Stripe secret key exists..."
    gcloud secrets create stripe-secret-key --replication-policy automatic
  }

  Write-Host "Adding a new Stripe secret key version..."
  $stripeSecretTempFile = New-TemporaryFile
  try {
    Set-Content -NoNewline -Path $stripeSecretTempFile -Value $env:STRIPE_SECRET_KEY
    gcloud secrets versions add stripe-secret-key --data-file=$stripeSecretTempFile
  } finally {
    Remove-Item -LiteralPath $stripeSecretTempFile -Force -ErrorAction SilentlyContinue
  }
}

$stripeWebhookSecretExists = gcloud secrets list --filter "name:stripe-webhook-secret" --format "value(name)"
if ($StripeWebhookSecret) {
  if (-not $stripeWebhookSecretExists) {
    Write-Host "Ensuring Stripe webhook secret exists..."
    gcloud secrets create stripe-webhook-secret --replication-policy automatic
  }

  Write-Host "Adding a new Stripe webhook secret version..."
  $stripeWebhookSecretTempFile = New-TemporaryFile
  try {
    Set-Content -NoNewline -Path $stripeWebhookSecretTempFile -Value $StripeWebhookSecret
    gcloud secrets versions add stripe-webhook-secret --data-file=$stripeWebhookSecretTempFile
  } finally {
    Remove-Item -LiteralPath $stripeWebhookSecretTempFile -Force -ErrorAction SilentlyContinue
  }
}

$openAiSecretExistsForDeploy = gcloud secrets list --filter "name:openai-api-key" --format "value(name)"
$googleOAuthSecretExistsForDeploy = gcloud secrets list --filter "name:google-oauth-client-secret" --format "value(name)"
$stripeSecretExistsForDeploy = gcloud secrets list --filter "name:stripe-secret-key" --format "value(name)"
$stripeWebhookSecretExistsForDeploy = gcloud secrets list --filter "name:stripe-webhook-secret" --format "value(name)"

$projectNumber = gcloud projects describe $ProjectId --format "value(projectNumber)"
$runtimeServiceAccount = "$projectNumber-compute@developer.gserviceaccount.com"

Write-Host "Granting Cloud Run runtime access to Retell API key secret..."
gcloud projects add-iam-policy-binding $ProjectId `
  --member "serviceAccount:$runtimeServiceAccount" `
  --role "roles/secretmanager.secretAccessor" `
  --quiet | Out-Null

Write-Host "Building and pushing $image..."
gcloud builds submit --tag $image .

Write-Host "Deploying Cloud Run service $ServiceName..."
$resolvedFirebaseProjectId = if ($FirebaseProjectId) { $FirebaseProjectId } else { $ProjectId }
$runtimeEnvVars = "NODE_ENV=production,LOG_LEVEL=info,PERSISTENCE_DRIVER=firestore,FIREBASE_PROJECT_ID=$resolvedFirebaseProjectId,RETELL_DEFAULT_AGENT_ID=$RetellDefaultAgentId,RETELL_DEFAULT_FROM_NUMBER=$RetellDefaultFromNumber,RETELL_INBOUND_WEBHOOK_VERIFY=true"
if ($UserTransferPhoneNumber) {
  $runtimeEnvVars = "$runtimeEnvVars,USER_TRANSFER_PHONE_NUMBER=$UserTransferPhoneNumber"
}
if ($TransferApprovalTimeoutMs) {
  $runtimeEnvVars = "$runtimeEnvVars,TRANSFER_APPROVAL_TIMEOUT_MS=$TransferApprovalTimeoutMs"
}
if ($LiveAnswerTimeoutMs) {
  $runtimeEnvVars = "$runtimeEnvVars,LIVE_ANSWER_TIMEOUT_MS=$LiveAnswerTimeoutMs"
}
if ($BillingPlan) {
  $runtimeEnvVars = "$runtimeEnvVars,BILLING_PLAN=$BillingPlan"
}
if ($BillingMonthlyIncludedMinutes) {
  $runtimeEnvVars = "$runtimeEnvVars,BILLING_MONTHLY_INCLUDED_MINUTES=$BillingMonthlyIncludedMinutes"
}
if ($BillingMonthlyClassificationLimit) {
  $runtimeEnvVars = "$runtimeEnvVars,BILLING_MONTHLY_CLASSIFICATION_LIMIT=$BillingMonthlyClassificationLimit"
}
if ($BillingRequiredForProvisioning) {
  $runtimeEnvVars = "$runtimeEnvVars,BILLING_REQUIRED_FOR_PROVISIONING=$BillingRequiredForProvisioning"
}
if ($BillingDefaultSpendingCapCents) {
  $runtimeEnvVars = "$runtimeEnvVars,BILLING_DEFAULT_SPENDING_CAP_CENTS=$BillingDefaultSpendingCapCents"
}
if ($RateLimitWindowMs) {
  $runtimeEnvVars = "$runtimeEnvVars,RATE_LIMIT_WINDOW_MS=$RateLimitWindowMs"
}
if ($RateLimitMaxRequests) {
  $runtimeEnvVars = "$runtimeEnvVars,RATE_LIMIT_MAX_REQUESTS=$RateLimitMaxRequests"
}
if ($WebhookRateLimitMaxRequests) {
  $runtimeEnvVars = "$runtimeEnvVars,WEBHOOK_RATE_LIMIT_MAX_REQUESTS=$WebhookRateLimitMaxRequests"
}
if ($StripePublishableKey) {
  $runtimeEnvVars = "$runtimeEnvVars,STRIPE_PUBLISHABLE_KEY=$StripePublishableKey"
}
if ($StripePricePersonalMonthly) {
  $runtimeEnvVars = "$runtimeEnvVars,STRIPE_PRICE_PERSONAL_MONTHLY=$StripePricePersonalMonthly"
}
if ($StripePricePersonalCallMinuteOverage) {
  $runtimeEnvVars = "$runtimeEnvVars,STRIPE_PRICE_PERSONAL_CALL_MINUTE_OVERAGE=$StripePricePersonalCallMinuteOverage"
}
if ($SelfServeRetellProvisioning) {
  $runtimeEnvVars = "$runtimeEnvVars,SELF_SERVE_RETELL_PROVISIONING=$SelfServeRetellProvisioning"
}
if ($AppPublicBaseUrl) {
  $runtimeEnvVars = "$runtimeEnvVars,APP_PUBLIC_BASE_URL=$AppPublicBaseUrl"
}
if ($GoogleOAuthClientId) {
  $runtimeEnvVars = "$runtimeEnvVars,GOOGLE_OAUTH_CLIENT_ID=$GoogleOAuthClientId"
}
if ($GoogleOAuthRedirectUri) {
  $runtimeEnvVars = "$runtimeEnvVars,GOOGLE_OAUTH_REDIRECT_URI=$GoogleOAuthRedirectUri"
}
if ($OpenAiClassifierModel) {
  $runtimeEnvVars = "$runtimeEnvVars,OPENAI_CLASSIFIER_MODEL=$OpenAiClassifierModel"
}

$runtimeSecrets = "RETELL_API_KEY=retell-api-key:latest"
if ($GoogleOAuthClientSecret -or $googleOAuthSecretExistsForDeploy) {
  $runtimeSecrets = "$runtimeSecrets,GOOGLE_OAUTH_CLIENT_SECRET=google-oauth-client-secret:latest"
}
if ($env:OPENAI_API_KEY -or $openAiSecretExistsForDeploy) {
  $runtimeSecrets = "$runtimeSecrets,OPENAI_API_KEY=openai-api-key:latest"
}
if ($env:STRIPE_SECRET_KEY -or $stripeSecretExistsForDeploy) {
  $runtimeSecrets = "$runtimeSecrets,STRIPE_SECRET_KEY=stripe-secret-key:latest"
}
if ($StripeWebhookSecret -or $stripeWebhookSecretExistsForDeploy) {
  $runtimeSecrets = "$runtimeSecrets,STRIPE_WEBHOOK_SECRET=stripe-webhook-secret:latest"
}

gcloud run deploy $ServiceName `
  --image $image `
  --region $Region `
  --platform managed `
  --allow-unauthenticated `
  --port 3000 `
  --memory 512Mi `
  --cpu 1 `
  --min-instances 0 `
  --max-instances 10 `
  --set-env-vars $runtimeEnvVars `
  --set-secrets $runtimeSecrets

$serviceUrl = gcloud run services describe $ServiceName `
  --region $Region `
  --format "value(status.url)"

Write-Host ""
Write-Host "Cloud Run URL: $serviceUrl"
Write-Host "Health check: $serviceUrl/readyz"
Write-Host ""
Write-Host "Next: run scripts/retell-configure-webhooks.mjs with RETELL_PUBLIC_BASE_URL=$serviceUrl"
