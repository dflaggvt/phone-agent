# Privacy Policy Draft

This is a working draft for internal testing and counsel review. It is not a final legal policy.

## Overview

Call Held helps users manage calls and related communication with an AI assistant. The assistant can answer forwarded missed or declined calls, identify callers, understand call intent, summarize calls, notify the user, and support follow-up actions such as live questions, call transfer requests, calendar availability checks, and assistant-created calendar events.

## Information We Collect

We collect information needed to operate the assistant:

- Account information such as email address, phone number, display name, assistant name, onboarding status, billing status, and app settings.
- Call information such as caller phone number, called assistant number, call timestamps, call status, transcripts, summaries, intent, urgency, follow-up actions, and assistant outcomes.
- Contact information if the user grants contact access, such as contact names and phone numbers, to help recognize known callers.
- User-provided assistant notes and preferences.
- Calendar connection status, free/busy results, and assistant-created event metadata when the user connects Google Calendar.
- Notification tokens and notification action state so the app can deliver live call requests and summaries.
- Billing state, invoices, usage events, spending caps, and payment-method status through our payment provider. We do not store raw card numbers or CVC.
- Diagnostics such as crash reports, app version, device class, operating system version, and non-sensitive operational logs.

## How We Use Information

We use information to:

- Authenticate users and protect their account.
- Route calls to the user's assistant.
- Help the assistant recognize callers and understand context.
- Summarize calls and create follow-up actions.
- Notify the user about important calls, requested answers, transfers, billing issues, and calendar changes.
- Enforce billing limits, spending caps, and paid-resource gates.
- Improve reliability, debug failures, and prevent abuse.
- Support user-requested calendar actions.

## AI Processing

Call Held uses AI systems to understand call intent, summarize communications, classify topics, extract follow-up actions, and generate assistant behavior. AI systems receive only the context needed for the requested assistant action. The assistant must not intentionally disclose private caller memory, notes, calendar details, or topic context unless policy allows it.

## Sharing

We may share data with service providers that operate the product, including cloud hosting, authentication, database, notification, crash reporting, payment, voice, AI, and calendar integration providers.

We do not sell personal data. Permissioned sharing features, such as sending a recap or decision request to another person, should only share scoped artifacts chosen or approved by the user.

## Data Protection

We use encryption in transit, managed cloud storage with encryption at rest, managed secret storage, webhook verification, least-privilege provider integrations, and privacy-safe notification payloads. Raw payment card details are handled by the payment provider and should not pass through Call Held servers.

## Data Retention And Deletion

Users may request deletion of their account or specific categories of data by emailing `support@callheld.com`. Deletion requests can include account profile data, call history, transcripts, summaries, topics, assistant notes, synced contacts, calendar connection data, notification records, and support records. We may retain limited records when required for legal, security, fraud-prevention, accounting, dispute-resolution, or compliance purposes. We aim to respond within 7 days and complete verified deletion requests within 30 days unless a longer period is required by law, security review, billing dispute, or technical backup retention.

## Call Recording, Transcription, And Disclosure

Call Held may record or transcribe calls depending on assistant configuration and provider behavior. Consent and disclosure requirements vary by jurisdiction. Public release requires legal review of call recording, transcription, AI disclosure, and consent flows.

## Contact

Support email: `support@callheld.com`.

Last updated: June 9, 2026.
