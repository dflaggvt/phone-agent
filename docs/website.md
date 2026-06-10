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

The site is static and does not call the Phone Agent backend. It does not include analytics, cookies, lead capture storage, or third-party scripts by default.

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
