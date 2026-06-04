param(
  [string]$ProjectId = "phone-agent-43313",
  [string]$Region = "us-central1",
  [string]$ServiceName = "phone-agent",
  [string]$HostName = "phone-agent-47585065917.us-central1.run.app"
)

$ErrorActionPreference = "Stop"

Write-Host "Configuring Cloud Monitoring for $ServiceName in $ProjectId..."

$existingUptime = gcloud monitoring uptime list-configs `
  --project $ProjectId `
  --format "value(name,displayName)" |
  ForEach-Object {
    $columns = $_ -split "\s+"
    if ($columns.Length -ge 2 -and ($columns[1..($columns.Length - 1)] -join " ") -eq "Phone Agent API readyz") {
      $columns[0]
    }
  } |
  Select-Object -First 1

if (-not $existingUptime) {
  Write-Host "Creating uptime check..."
  $token = gcloud auth print-access-token --project $ProjectId
  $body = @{
    displayName = "Phone Agent API readyz"
    monitoredResource = @{
      type = "uptime_url"
      labels = @{
        project_id = $ProjectId
        host = $HostName
      }
    }
    httpCheck = @{
      path = "/readyz"
      port = 443
      useSsl = $true
      validateSsl = $true
      requestMethod = "GET"
    }
    period = "60s"
    timeout = "10s"
    selectedRegions = @("USA_OREGON", "USA_IOWA", "USA_VIRGINIA")
    contentMatchers = @(
      @{
        content = '"status":"ok"'
        matcher = "CONTAINS_STRING"
      }
    )
  }
  $createdUptime = Invoke-RestMethod `
    -Method Post `
    -Uri "https://monitoring.googleapis.com/v3/projects/$ProjectId/uptimeCheckConfigs" `
    -Headers @{ Authorization = "Bearer $token"; "x-goog-user-project" = $ProjectId } `
    -ContentType "application/json" `
    -Body ($body | ConvertTo-Json -Depth 20)
  $existingUptime = $createdUptime.name
} else {
  Write-Host "Uptime check already exists."
}

function Ensure-Policy {
  param(
    [string]$DisplayName,
    [string]$ConditionDisplayName,
    [string]$Filter,
    [hashtable]$Aggregation,
    [string]$Comparison = "COMPARISON_GT",
    [double]$ThresholdValue,
    [string]$Duration,
    [string]$Documentation
  )

  $existing = gcloud monitoring policies list `
    --project $ProjectId `
    --format "value(displayName)" |
    Where-Object { $_ -eq $DisplayName }

  if ($existing) {
    Write-Host "Alert policy already exists: $DisplayName"
    return
  }

  Write-Host "Creating alert policy: $DisplayName"
  $policy = @{
    displayName = $DisplayName
    combiner = "OR"
    enabled = $true
    documentation = @{
      content = $Documentation
      mimeType = "text/markdown"
    }
    conditions = @(
      @{
        displayName = $ConditionDisplayName
        conditionThreshold = @{
          filter = $Filter
          comparison = $Comparison
          thresholdValue = $ThresholdValue
          duration = $Duration
          trigger = @{
            count = 1
          }
          aggregations = @($Aggregation)
        }
      }
    )
  }
  $policyFile = New-TemporaryFile
  try {
    $policy | ConvertTo-Json -Depth 20 | Set-Content -Path $policyFile -Encoding utf8
    gcloud monitoring policies create `
      --project $ProjectId `
      --policy-from-file $policyFile
    if ($LASTEXITCODE -ne 0) {
      throw "Failed to create alert policy: $DisplayName"
    }
  } finally {
    Remove-Item -LiteralPath $policyFile -Force -ErrorAction SilentlyContinue
  }
}

function Ensure-LogMetric {
  param(
    [string]$MetricName,
    [string]$Description,
    [string]$LogFilter
  )

  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $existingMetric = gcloud logging metrics describe $MetricName `
    --project $ProjectId `
    --format "value(name)" 2>$null
  $describeExitCode = $LASTEXITCODE
  $ErrorActionPreference = $previousErrorActionPreference

  if ($describeExitCode -eq 0 -and $existingMetric) {
    Write-Host "Log metric already exists: $MetricName"
    return
  }

  Write-Host "Creating log metric: $MetricName"
  gcloud logging metrics create $MetricName `
    --project $ProjectId `
    --description=$Description `
    --log-filter=$LogFilter
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to create log metric: $MetricName"
  }
}

$requestCountAggregation = @{
  alignmentPeriod = "300s"
  perSeriesAligner = "ALIGN_RATE"
  crossSeriesReducer = "REDUCE_SUM"
  groupByFields = @("resource.label.service_name")
}
$latencyAggregation = @{
  alignmentPeriod = "300s"
  perSeriesAligner = "ALIGN_PERCENTILE_95"
  crossSeriesReducer = "REDUCE_MEAN"
  groupByFields = @("resource.label.service_name")
}
$uptimeAggregation = @{
  alignmentPeriod = "120s"
  perSeriesAligner = "ALIGN_FRACTION_TRUE"
  crossSeriesReducer = "REDUCE_MEAN"
  groupByFields = @("resource.label.host")
}

$requestCountFilter = 'resource.type="cloud_run_revision" AND resource.labels.service_name="{0}" AND metric.type="run.googleapis.com/request_count" AND metric.labels.response_code_class="5xx"' -f $ServiceName
$latencyFilter = 'resource.type="cloud_run_revision" AND resource.labels.service_name="{0}" AND metric.type="run.googleapis.com/request_latencies"' -f $ServiceName
$uptimeCheckId = Split-Path -Path $existingUptime -Leaf
$uptimeFilter = 'resource.type="uptime_url" AND metric.type="monitoring.googleapis.com/uptime_check/check_passed" AND metric.labels.check_id="{0}"' -f $uptimeCheckId

$providerWebhookMetric = "phone_agent_provider_webhook_errors"
$billingFailureMetric = "phone_agent_billing_failures"
$fcmFailureMetric = "phone_agent_fcm_delivery_failures"

Ensure-LogMetric `
  -MetricName $providerWebhookMetric `
  -Description "Phone Agent provider webhook processing failures" `
  -LogFilter ('resource.type="cloud_run_revision" AND resource.labels.service_name="{0}" AND severity>=ERROR AND (jsonPayload.message:"webhook" OR textPayload:"webhook")' -f $ServiceName)

Ensure-LogMetric `
  -MetricName $billingFailureMetric `
  -Description "Phone Agent billing publish, webhook, subscription, or cap failures" `
  -LogFilter ('resource.type="cloud_run_revision" AND resource.labels.service_name="{0}" AND severity>=WARNING AND (jsonPayload.message:"billing" OR textPayload:"billing")' -f $ServiceName)

Ensure-LogMetric `
  -MetricName $fcmFailureMetric `
  -Description "Phone Agent FCM push delivery failures" `
  -LogFilter ('resource.type="cloud_run_revision" AND resource.labels.service_name="{0}" AND severity>=WARNING AND jsonPayload.errorCode:* AND (jsonPayload.message:push OR textPayload:push)' -f $ServiceName)

$logMetricAggregation = @{
  alignmentPeriod = "300s"
  perSeriesAligner = "ALIGN_RATE"
  crossSeriesReducer = "REDUCE_SUM"
}

Ensure-Policy `
  -DisplayName "Phone Agent API readiness failed" `
  -ConditionDisplayName "Ready endpoint uptime check failed" `
  -Filter $uptimeFilter `
  -Aggregation $uptimeAggregation `
  -Comparison "COMPARISON_LT" `
  -ThresholdValue 1 `
  -Duration "120s" `
  -Documentation "Phone Agent /readyz failed from at least one uptime-check region for two minutes. Check Cloud Run readiness, latest revision traffic, startup errors, and recent deploys."

Ensure-Policy `
  -DisplayName "Phone Agent API 5xx responses" `
  -ConditionDisplayName "Cloud Run 5xx response rate" `
  -Filter $requestCountFilter `
  -Aggregation $requestCountAggregation `
  -ThresholdValue 0 `
  -Duration "300s" `
  -Documentation "Phone Agent returned at least one 5xx response over five minutes. Check Cloud Run logs, latest revision health, provider webhook failures, and recent deploys."

Ensure-Policy `
  -DisplayName "Phone Agent API high latency" `
  -ConditionDisplayName "Cloud Run p95 request latency" `
  -Filter $latencyFilter `
  -Aggregation $latencyAggregation `
  -ThresholdValue 3000 `
  -Duration "300s" `
  -Documentation "Phone Agent p95 request latency exceeded 3 seconds for five minutes. Voice tool calls, mobile setup, billing, or calendar actions may be degraded."

Ensure-Policy `
  -DisplayName "Phone Agent provider webhook failures" `
  -ConditionDisplayName "Provider webhook error log rate" `
  -Filter ('resource.type="cloud_run_revision" AND metric.type="logging.googleapis.com/user/{0}"' -f $providerWebhookMetric) `
  -Aggregation $logMetricAggregation `
  -ThresholdValue 0 `
  -Duration "300s" `
  -Documentation "Provider webhook processing emitted errors. Check voice call lifecycle, billing webhooks, signature verification, idempotency claims, and recent deploys."

Ensure-Policy `
  -DisplayName "Phone Agent billing failures" `
  -ConditionDisplayName "Billing warning/error log rate" `
  -Filter ('resource.type="cloud_run_revision" AND metric.type="logging.googleapis.com/user/{0}"' -f $billingFailureMetric) `
  -Aggregation $logMetricAggregation `
  -ThresholdValue 0 `
  -Duration "300s" `
  -Documentation "Billing emitted warnings or errors. Run npm run billing:reconcile, inspect local invoice mirrors, check Stripe webhook delivery, and verify cap enforcement."

Ensure-Policy `
  -DisplayName "Phone Agent FCM delivery failures" `
  -ConditionDisplayName "FCM delivery failure log rate" `
  -Filter ('resource.type="cloud_run_revision" AND metric.type="logging.googleapis.com/user/{0}"' -f $fcmFailureMetric) `
  -Aggregation $logMetricAggregation `
  -ThresholdValue 0 `
  -Duration "900s" `
  -Documentation "FCM delivery failures may prevent live transfer or live-answer requests from reaching users. Check Firebase credentials, disabled tokens, and NotificationDelivery records."

Write-Host "Monitoring setup complete."
Write-Host "Attach notification channels in Cloud Monitoring before closed beta."
