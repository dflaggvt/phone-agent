# Analytics Dashboard

## Purpose

Phone Agent analytics should answer production product questions without storing communication content. The first dashboard set should be built from privacy-safe `ProductAnalyticsEvent` rows exported with `npm run analytics:export` or loaded into a warehouse table.

## Source

Initial source table:

- BigQuery dataset: `phone_agent_analytics`
- Table: `product_analytics_events`
- Grain: one app or backend product event
- Sensitive fields: not allowed

Required columns:

- `userId`
- `sessionId`
- `eventName`
- `screen`
- `surface`
- `action`
- `result`
- `objectType`
- `objectId`
- `latencyMs`
- `sequence`
- `appVersion`
- `buildType`
- `deviceClass`
- `osVersion`
- `networkStatus`
- `attributes`
- `occurredAt`
- `receivedAt`

## Dashboard Pages

### Activation

Questions:

- How many users open the app daily?
- How many reach phone verification?
- How many finish assistant naming?
- How many open billing?
- How many reach first successful data refresh?

Primary charts:

- Daily active users.
- Onboarding funnel by day.
- Median time from first app open to first successful refresh.
- Signup failure rate by app version and OS version.

### Engagement

Questions:

- Which tabs are used?
- How often do users review calls, topics, notes, and live requests?
- Are users returning after first setup?

Primary charts:

- Tab selections per user per day.
- Sessions per user per week.
- Topic opens and call-detail opens per active user.
- Notes created and archived per week.

### Reliability

Questions:

- Are app refreshes succeeding?
- Are cached/offline states common?
- Are notification actions completing?

Primary charts:

- Refresh success/failure count by app version.
- Refresh latency p50/p95.
- Notification action completion by action.
- Contact sync success/failure.

### Billing

Questions:

- Do users reach billing setup?
- Are users adding cards?
- Are cap warnings happening?
- Does usage approach caps?

Primary charts:

- Billing screen opens.
- Checkout opens and activation results.
- Cap-warning notifications by threshold.
- Billing failures by day.

### Retention

Questions:

- Do users come back after activation?
- Does live-call value improve retention?

Primary charts:

- Weekly active users.
- D1/D7 retention cohorts.
- Active users by first meaningful event.
- Churn-risk users with no app open for `7` days after setup.

## Privacy Rules

Do not add these fields to dashboards:

- Transcripts.
- Summaries.
- Assistant-note text.
- Live-answer text.
- Search query text.
- Contact names or contact-book contents.
- Calendar descriptions.
- Payment details.
- Raw provider payloads.
- Secrets or tokens.

Use counts, categories, latencies, statuses, and object IDs only.

## Implementation

Use `scripts/analytics-dashboard-bigquery.sql` to create starter BigQuery views after loading the NDJSON export into `phone_agent_analytics.product_analytics_events`.
