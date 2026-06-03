# Legal And Compliance Checklist

This document is an engineering and product checklist for counsel review. It is not legal advice.

## Required Before Public Launch

- Privacy policy.
- Terms of service.
- AI assistant disclosure language.
- Call recording and transcription consent policy.
- Data deletion process.
- Data export process.
- Refund and credit policy.
- Billing terms for base subscription, included minutes, overage, spending caps, failed payments, and cancellation.
- Support and abuse contact.
- Google Play Data Safety form answers.

## Call Handling

Questions for counsel:

- What disclosure is required when an AI assistant answers a personal or business call?
- What disclosure is required when calls are recorded, transcribed, summarized, or analyzed?
- Does the caller need to consent before the assistant continues?
- Does consent need to be stored per call?
- How should the assistant respond when the caller refuses recording or AI handling?
- How should emergency calls or emergency language be handled?

Product defaults until reviewed:

- Disclose AI assistant identity near the start of every call.
- Avoid autonomous outbound calls except user-approved test calls.
- Avoid medical, legal, financial, employment, and emergency advice.
- Keep caller-facing language natural and transparent.

## Recording And Transcription

Questions for counsel:

- Which launch states require all-party consent for call recording?
- Whether transcription/AI analysis is treated differently from audio recording.
- What retention period is appropriate for raw recordings, transcripts, summaries, and extracted facts.
- Whether external participants have deletion/export rights.

Product defaults until reviewed:

- Treat recordings, transcripts, summaries, caller memory, and topic memory as sensitive user data.
- Keep lock-screen notification payloads private.
- Avoid sharing call recaps externally without explicit user action.

## Privacy And Data Rights

Questions for counsel:

- How do state privacy laws apply to inferred facts about non-users?
- What deletion/export rights are required for users and non-user participants?
- How should data from contacts, calendar, emails, SMS, and future documents be disclosed?
- What data processors/subprocessors need to be listed?

Product defaults until reviewed:

- Sync only minimal contact identity fields in MVP.
- Store topic memory and caller memory per user.
- Avoid using one user's contact labels or memory for another user.
- Avoid telemetry containing raw communication content.

## TCPA And Outbound AI

Questions for counsel:

- Whether outbound AI calls can be included in beta.
- What approval and consent is needed for outbound AI calls or SMS follow-ups.
- Whether shared SMS/email artifacts create marketing, transactional, or mixed-message obligations.

Product defaults until reviewed:

- Outbound calls require explicit user approval.
- External sharing must be user-initiated, useful, transparent, and scoped.
- Do not send marketing/referral messages through call recap links.

## Billing And Consumer Protection

Questions for counsel:

- Required subscription disclosures.
- Required overage/spending-cap disclosures.
- Refund handling for failed calls, failed transfers, provider outages, or AI mistakes.
- Whether assistant number reservation is telecom-adjacent for tax or disclosure purposes.

Product defaults until reviewed:

- Require card and spending cap before paid infrastructure.
- Explain charges in plain language.
- Do not show raw token math in consumer billing.
- Never store raw card data.

## Launch Decision

Public launch is blocked until counsel signs off on:

- Privacy policy.
- Terms of service.
- AI and recording disclosure.
- Data retention/deletion/export.
- Billing/refund terms.
- TCPA/outbound limitations.
