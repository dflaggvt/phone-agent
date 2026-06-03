# Google Play Store Listing Draft

## App Identity

- App name: Phone Agent.
- Package name: `com.phoneagent.app`.
- Category: Productivity.
- Track for first release: Internal testing.
- Target audience: adults.
- Ads: no ads.
- Login required: yes, phone-number sign-in.
- Paid features: yes, pay-as-you-go assistant usage with a spending cap.

## Short Description

An AI phone assistant that answers first, organizes calls, and helps decide what needs your attention.

## Full Description

Phone Agent is an AI-native communication assistant for your existing phone number.

Forward calls to your assistant, then let it identify who is calling, understand why they are calling, capture the outcome, and notify you when something needs attention. The app helps you review recent calls, caller requests, summaries, topic threads, assistant notes, calendar actions, billing controls, and live call actions.

Phone Agent is designed for people who want fewer interruptions and better follow-through from everyday calls. Your assistant can take messages, summarize calls, remember prior caller context, ask you a live question by notification, and help with calendar availability when connected.

The product is currently in private/internal testing. Some features may require manual setup, carrier call forwarding, and an active payment method before paid assistant usage is enabled.

## Release Notes For Internal Test

Use the release notes in:

```text
docs/play-release-notes/internal-test-v0.1.1.md
```

## App Access Instructions For Review/Testers

Phone Agent requires phone-number sign-in. Internal testers should:

1. Install the internal test build.
2. Sign in with their mobile phone number.
3. Complete guided onboarding.
4. Add a test payment method when prompted.
5. Follow the in-app forwarding instructions.
6. Place a test call to the assigned assistant number.

If Google review requires access without a personal phone number, create a dedicated reviewer test phone number in Firebase Authentication and document it in the Play Console app access field. Do not include reviewer credentials in source control.

## Data Safety Draft

This section is a draft for Play Console and counsel review. It must be validated before public launch.

### Data Collected

Personal info:

- Phone number: used for sign-in, account identity, call routing, and user-owned assistant setup.
- Name: used to personalize the assistant and account display.
- Email address: may be used for support, billing, Google Calendar connection, or future account recovery.

Contacts:

- Optional contact names and phone numbers: used to recognize known callers and tailor assistant behavior.

Audio and communications:

- Call metadata, transcripts, summaries, caller identity, intent, urgency, outcomes, and follow-up actions.
- User-authored assistant notes.
- Calendar free/busy data and assistant-created calendar event metadata when the user connects Google Calendar.

App activity:

- Onboarding state, app actions, notification actions, billing setup status, usage events, and crash diagnostics.

Financial info:

- Payment method setup and subscription/payment state are handled by Stripe. Phone Agent must not store raw card numbers, CVC, or full payment credentials.

Device or other IDs:

- Firebase installation and FCM token for push notifications.
- Crash diagnostics identifiers through Firebase Crashlytics.

### Data Sharing

Data may be shared with service providers necessary to operate the app:

- Cloud hosting, authentication, database, crash reporting, notification delivery, payment processing, voice runtime, AI processing, and calendar integration providers.

Phone Agent should not sell user data. External sharing of call recaps, decision requests, or thread artifacts must be user-permissioned and scoped to the selected recipient/thread.

### Security Practices

- Data encrypted in transit.
- Managed cloud storage with provider encryption at rest.
- Provider secrets stored in managed secret storage.
- Raw card details are not stored by Phone Agent.
- Notifications default to privacy-safe payloads.
- User-owned data boundaries and thread-level permissions are product requirements.

### Deletion

Before public launch, the product must provide a user-accessible data deletion request path and documented retention policy. For internal testing, deletion requests are handled manually by the operator until automated deletion/export endpoints are complete.

## Content Ratings And Policy Notes

- Not designed for children.
- No user-generated public content feed.
- No ads.
- Contains AI-generated/AI-mediated communication behavior.
- Requires disclosure and consent review for call recording/transcription and AI answering behavior.
- Does not provide emergency services; callers should contact emergency services directly for emergencies.

## Store Assets Needed

Before closed or public release:

- App icon at Play Console required sizes.
- Feature graphic.
- Phone screenshots for onboarding, home, call detail, assistant, billing, and topics.
- Privacy policy URL.
- Support email.
- Terms of service URL.
