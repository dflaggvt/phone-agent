-- Starter BigQuery views for Phone Agent privacy-safe product analytics.
-- Assumes exported ProductAnalyticsEvent rows are loaded into:
--   `phone_agent_analytics.product_analytics_events`

CREATE OR REPLACE VIEW `phone_agent_analytics.daily_active_users` AS
SELECT
  DATE(TIMESTAMP(occurredAt)) AS event_date,
  COUNT(DISTINCT userId) AS active_users,
  COUNT(DISTINCT sessionId) AS sessions,
  COUNT(*) AS events
FROM `phone_agent_analytics.product_analytics_events`
WHERE userId IS NOT NULL
GROUP BY event_date;

CREATE OR REPLACE VIEW `phone_agent_analytics.onboarding_funnel_daily` AS
SELECT
  DATE(TIMESTAMP(occurredAt)) AS event_date,
  COUNT(DISTINCT IF(eventName = 'app_opened', userId, NULL)) AS opened_app,
  COUNT(DISTINCT IF(eventName = 'signup_started', userId, NULL)) AS signup_started,
  COUNT(DISTINCT IF(eventName = 'verification_completed', userId, NULL)) AS phone_verified,
  COUNT(DISTINCT IF(eventName = 'assistant_name_saved', userId, NULL)) AS assistant_named,
  COUNT(DISTINCT IF(eventName = 'billing_setup_opened', userId, NULL)) AS billing_opened,
  COUNT(DISTINCT IF(eventName = 'data_refresh_finished' AND result = 'success', userId, NULL)) AS first_refresh_ready
FROM `phone_agent_analytics.product_analytics_events`
GROUP BY event_date;

CREATE OR REPLACE VIEW `phone_agent_analytics.tab_engagement_daily` AS
SELECT
  DATE(TIMESTAMP(occurredAt)) AS event_date,
  screen,
  COUNT(*) AS tab_selects,
  COUNT(DISTINCT userId) AS users
FROM `phone_agent_analytics.product_analytics_events`
WHERE eventName = 'tab_selected'
GROUP BY event_date, screen;

CREATE OR REPLACE VIEW `phone_agent_analytics.refresh_reliability_daily` AS
SELECT
  DATE(TIMESTAMP(occurredAt)) AS event_date,
  appVersion,
  osVersion,
  result,
  COUNT(*) AS refreshes,
  APPROX_QUANTILES(latencyMs, 100)[OFFSET(50)] AS latency_p50_ms,
  APPROX_QUANTILES(latencyMs, 100)[OFFSET(95)] AS latency_p95_ms
FROM `phone_agent_analytics.product_analytics_events`
WHERE eventName IN ('data_refresh_finished', 'data_refresh_failed')
GROUP BY event_date, appVersion, osVersion, result;

CREATE OR REPLACE VIEW `phone_agent_analytics.notification_actions_daily` AS
SELECT
  DATE(TIMESTAMP(occurredAt)) AS event_date,
  action,
  result,
  COUNT(*) AS actions,
  COUNT(DISTINCT userId) AS users
FROM `phone_agent_analytics.product_analytics_events`
WHERE surface = 'notification' OR eventName LIKE '%notification%'
GROUP BY event_date, action, result;

CREATE OR REPLACE VIEW `phone_agent_analytics.billing_conversion_daily` AS
SELECT
  DATE(TIMESTAMP(occurredAt)) AS event_date,
  COUNT(DISTINCT IF(eventName = 'billing_setup_opened', userId, NULL)) AS billing_opened,
  COUNT(DISTINCT IF(eventName = 'billing_checkout_opened', userId, NULL)) AS checkout_opened,
  COUNT(DISTINCT IF(eventName = 'billing_status_checked' AND result = 'success', userId, NULL)) AS billing_activated,
  COUNT(DISTINCT IF(eventName LIKE '%billing%' AND result = 'failed', userId, NULL)) AS billing_failed_users
FROM `phone_agent_analytics.product_analytics_events`
GROUP BY event_date;

CREATE OR REPLACE VIEW `phone_agent_analytics.weekly_retention` AS
WITH first_seen AS (
  SELECT
    userId,
    DATE_TRUNC(MIN(DATE(TIMESTAMP(occurredAt))), WEEK(MONDAY)) AS cohort_week
  FROM `phone_agent_analytics.product_analytics_events`
  WHERE userId IS NOT NULL
  GROUP BY userId
),
activity AS (
  SELECT DISTINCT
    userId,
    DATE_TRUNC(DATE(TIMESTAMP(occurredAt)), WEEK(MONDAY)) AS activity_week
  FROM `phone_agent_analytics.product_analytics_events`
  WHERE userId IS NOT NULL
)
SELECT
  first_seen.cohort_week,
  DATE_DIFF(activity.activity_week, first_seen.cohort_week, WEEK(MONDAY)) AS week_number,
  COUNT(DISTINCT activity.userId) AS retained_users
FROM first_seen
JOIN activity USING (userId)
GROUP BY cohort_week, week_number;
