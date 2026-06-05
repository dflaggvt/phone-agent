# Closed Test 0.1.2

Closed testing build 0.1.2.

- Adds the production Home, Assistant, and Profile navigation model.
- Simplifies topic cards and topic lists to focus on topic names and unread/new state.
- Improves onboarding with Google sign-in, protected-number verification, assistant naming, and forwarding setup.
- Adds billing setup, monthly spending caps, and usage-aware paid-action gates.
- Adds privacy-safe push notifications for call summaries, live answer requests, transfer requests, billing issues, and calendar changes.
- Adds Google Calendar free/busy and assistant-created event support when connected.
- Adds synced phone-contact recognition so known callers can be greeted by contact name.
- Fixes repeat-caller identity drift so contact names and existing caller identities are not overwritten by later call analysis.
- Fixes Android 14+ internal receiver export handling for push-triggered refreshes.
- Includes crash reporting, release minification, backend production monitoring, and production Cloud Run connectivity.

Known limits for closed testers:

- Call forwarding setup depends on carrier support and may require manual carrier-specific setup.
- The assistant can handle calls only after onboarding, billing setup, assistant number assignment, and call forwarding are complete.
- Calendar access is optional and limited to free/busy plus assistant-created event management.
- Contact sync is optional and only uploads names and phone numbers after permission is granted.
- The product is still in closed testing and may require operator support.
