# Website

## Purpose

Call Held needs a simple public website for closed testing, Google Play app-content URLs, and early-access positioning.

The website should be a calm, credible one-page product site. It should explain the user outcome, not the backend implementation. It must not mention voice-provider names, model providers, telephony vendors, or internal architecture.

## Current Scope

The first website lives in `web/` and is designed for Vercel deployment.

Included pages:

- `/`: one-page marketing landing page.
- `/privacy`: privacy policy page.
- `/terms`: terms of service page.
- `/account-deletion`: account and data deletion request instructions for Google Play. This page is intentionally not linked from the main landing page and is marked `noindex`.

The site is static and does not include analytics, cookies, or third-party scripts by default. The waitlist signup form posts directly to the Phone Agent backend so beta requests stay first-party.

## Waitlist Signup

The `Join the waitlist` flow should collect the minimum information needed to contact early testers and route them to the right platform program:

- Email address.
- Current phone platform: Android, iPhone, or other.
- Explicit consent to be contacted about beta access and acknowledgement that Call Held is pre-release.

The website posts this to `POST /v1/public/beta-signups`. The backend stores a `BetaSignup` record with normalized email, selected platform, `pending` status, source `website`, consent version, consent timestamp, and create/update timestamps. Android testers should use the email associated with Google Play so operators can add them to the closed test. The form should not ask for name, phone number, device model, use case, or notes until there is a real operational need.

The waitlist form should appear in the first hero section so motivated visitors can sign up without scrolling to the bottom of the page. The primary navigation's `Join waitlist` link should target that hero form. The hero eyebrow should stay platform-neutral because the waitlist accepts Android, iPhone, and other users; Android-specific closed-test guidance belongs in the form helper text.

Production website deployments must set `VITE_API_BASE_URL` to the backend origin. Local Vite development defaults the form API base to `http://127.0.0.1:3000`.

## Positioning

Primary user-facing name:

```text
Call Held
```

Primary promise:

```text
When you cannot answer, your assistant can.
```

Plain-language description:

```text
Call Held is an AI phone assistant that handles missed or declined forwarded calls, understands who is calling and why, summarizes what happened, and helps the user decide what needs attention next.
```

Current website copy must describe the active conditional-forwarding product honestly: the user's phone still rings first. If the user does not answer, or taps the red decline button, the carrier forwards the call to the assistant. Future unconditional forwarding can support an "assistant answers first" experience, but that should not be the main website promise until it is the default setup.

## Capability Claims

The website may describe these capabilities when phrased with clear user control and availability limits:

- The assistant can have a natural conversation with missed or declined callers to understand what they need.
- When Call Held recognizes a caller through user-approved contacts, caller history, or prior call context, it can respond with more relevant context.
- For repeat callers, the assistant can use previous call summaries, user-authored notes, relationship context, and topic memory where policy allows.
- When the user connects calendar access, the assistant can check availability, answer scheduling questions, and create meetings or reminders when appropriate.

Avoid absolute claims such as "the AI knows who is calling" or "the AI always remembers everything." Use qualified language such as "when recognized," "when connected," "when available," and "where policy allows."

## Pricing Display

The landing page should hide pricing during the waitlist-focused beta acquisition phase. Pricing remains documented internally in `docs/monetization.md` and configured through `scripts/stripe-configure-catalog.mjs`, but the public website should avoid asking waitlist visitors to make a purchase decision before they have been invited to test.

When public pricing is reintroduced, it should stay aligned with the internal monetization docs and active payment-provider catalog.

Previously validated pricing copy:

- Personal plan: `$19/mo`.
- Includes assistant number, `50` assistant-handled minutes, summaries, topic matching, and basic AI processing.
- Additional assistant call time: `$0.39/min` after included minutes.
- Default monthly spending cap: `$40/mo`.
- Paid assistant work pauses at the cap unless the user raises it.

If pricing is visible again, the website must not mention Stripe, payment-provider object IDs, lookup keys, meter event names, voice-provider pricing, model-provider pricing, or raw token details. Those belong in implementation docs and internal billing surfaces.

Pricing validation performed for this website update:

- Source-validated against `scripts/stripe-configure-catalog.mjs`: lookup key `phone_agent_personal_monthly_usd` is configured at `1900` cents monthly, and lookup key `phone_agent_personal_call_minute_overage_usd` is configured as a monthly metered graduated price with `50` minutes at `0` cents and additional usage at `39` cents per minute.
- Live Stripe API validation was not possible in the local shell because `STRIPE_SECRET_KEY` was not available and Stripe CLI was not installed/authenticated.

## Vercel Settings

Create the Vercel project from the repository with:

- Root Directory: `web`
- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

The `web/vercel.json` file enables clean URLs and conservative security headers for the static site.

## Google Play URLs

After Vercel deployment, update Google Play Console with:

- Privacy policy URL: `https://<domain>/privacy`
- Terms URL, if requested: `https://<domain>/terms`
- Account deletion URL: `https://<domain>/account-deletion`
- Website URL: `https://<domain>/`

Use the custom domain once available. The Vercel preview domain is acceptable for internal review, but public launch should use a stable owned domain.

## Legal And Support Caveats

The current privacy and terms pages are suitable for closed-test scaffolding, not final public launch. Before public release:

- Counsel should review privacy, terms, call recording/transcription, AI disclosure, consent, billing, refunds, deletion, and emergency-use language.
- Use `support@callheld.com` as the public support mailbox.
- Add the final company/legal entity name when available.
- Confirm that Google Play Data Safety answers match the website policy exactly.
