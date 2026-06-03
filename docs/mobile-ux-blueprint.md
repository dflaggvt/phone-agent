# Mobile UX Blueprint

## Status

This is a fresh, ideal-state mobile product blueprint for Phone Agent. It is intentionally not based on the current Android implementation.

The current app should be treated as disposable scaffolding. This document defines the target consumer-grade product experience. Implementation should conform to this blueprint, not the reverse.

## Android Implementation Direction

The production Android client is Kotlin with Jetpack Compose. The previous hand-built Java view hierarchy has been retired; new UI work must use Compose screens, shared Compose components, and previewable fixture states.

Compose implementation requirements:

- Use Material 3 as the Android foundation for accessibility, state, touch targets, text fields, buttons, chips, surfaces, and theme plumbing, but wrap it in Phone Agent product components so the app does not look like stock Material.
- Use MVVM for production Android screens: Compose renders state, ViewModels expose `StateFlow`, repositories perform backend/cache work, and Activity code is limited to Android integration edges such as permissions, auth callbacks, dial intents, and browser launches.
- Use Hilt for dependency injection. Do not manually construct backend clients, repositories, or Room databases in Activities.
- Use Retrofit and OkHttp for REST calls. Do not add new app API calls through raw `HttpURLConnection`.
- Use a shared design-token layer for color, type, spacing, shape, elevation, and motion.
- Build reusable composables before adding one-off screen layouts.
- Treat the app shell, top bar, bottom nav, topic cards, call rows, review cards, assistant action rows, form fields, and empty/error states as first-class components.
- Use Room as the local source-of-display cache for authenticated state so launch, tab switches, search filters, and offline review can render from trusted last-known backend data before a network refresh completes.
- Keep screens previewable with fixture data so UI quality can be reviewed without live backend state.
- Add screenshot/golden testing after the first Compose component set stabilizes.
- Continue using connected-device screenshots for final device sanity checks, but do not rely on manual screenshots as the primary path to pixel precision.
- Do not add Java Activity UI surfaces or programmatic Android view hierarchy screens.

Initial Compose migration slice:

1. Add Kotlin and Jetpack Compose to the Android project.
2. Introduce a Compose launcher activity with the production shell: atmospheric background, header, assistant presence control, five-item bottom nav, and safe-area handling.
3. Recreate the core authenticated screens in Compose: Home, Topics, Review, Assistant, Search, topic detail, forwarding, billing entry, and first-run phone onboarding.
4. Move app state and backend orchestration into Hilt ViewModels, repositories, Retrofit/OkHttp API clients, and Room-backed data sources.
5. Keep the retired Java UI out of the production app. If a missing behavior is discovered, rebuild it in Compose rather than restoring the legacy Activity.

## Product Design Thesis

Phone Agent is not a voicemail inbox, call-screening utility, call center dashboard, or Retell control panel.

Phone Agent is a personal communication intelligence layer. It receives fragmented communications, understands what real-world situation they belong to, remembers what matters, protects the user's attention, and turns communication into decisions, tasks, calendar events, answers, and shared follow-ups.

The app should feel like the user's private chief of staff for communications:

- Calm enough to trust.
- Fast enough to use during a live call.
- Structured enough to remember months of context.
- Transparent enough that the user can correct the assistant.
- Private enough that sensitive memory never feels casual.

## Non-Negotiable Product Principles

1. The primary object is the topic thread, not the call.
2. The primary job is preserving context and reducing interruption, not displaying transcripts.
3. The user must always know what the assistant did and why.
4. The user must be able to correct memory, routing, topics, and people.
5. Live-call actions must be reachable in under `2` taps.
6. Sensitive content must never appear in notifications by default.
7. The assistant should feel helpful, not autonomous in a scary way.
8. The interface should feel consumer-premium, not enterprise-admin.
9. Provider details should be hidden unless the user is configuring a channel.
10. The app must be useful with `1` channel on day one and coherent with `7+` channels later.

## Experience North Star

When the user opens Phone Agent, they should know within `5` seconds:

- Whether the assistant is active.
- Whether anyone needs them now.
- Which topic threads changed.
- What decisions are pending.
- What the assistant handled.
- What memory or rule needs correction.

The ideal daily habit:

1. User opens Phone Agent in the morning.
2. Today shows `3-7` things that matter.
3. User clears decisions, answers, and topic suggestions in under `3` minutes.
4. User trusts that routine communication will not interrupt them.
5. User opens a thread when they need the full situation.

## Target User Context

### Primary Persona

Busy personal/professional user managing overlapping life and work logistics.

Common situations:

- Home project with contractors, spouse, architect, accountant, inspector.
- Kids sports with coaches, parents, calendar changes, documents.
- Medical appointments with doctors, family, insurance.
- Recruiting or customer calls with emails and calendar coordination.
- Car lease, insurance, travel, school, legal, finance, or household operations.

### Behavioral Assumptions

- User checks the app `2-5` times per day.
- User receives `5-30` meaningful communications per day.
- User wants interruptions reduced by at least `50%`.
- User tolerates AI answering calls only if behavior is transparent and correctable.
- User will not maintain complex rules unless defaults are excellent.
- User will not read long transcripts unless something went wrong.

## Ideal Information Architecture

The ideal mobile app uses `5` bottom navigation destinations:

1. Home
2. Topics
3. Review
4. Assistant
5. Search

Profile and Settings are reached from the assistant presence/avatar control in the header. Settings should not consume a primary bottom-nav slot.

### Why This IA

Home is the default center tab and daily command center.

Bottom navigation order:

1. Topics
2. Review
3. Home
4. Assistant
5. Search

Home is selected by default after onboarding and on normal app launch.

Topics is the durable memory product. The technical domain object may remain `TopicThread`, but consumer UI should say "Topics" and "Topic" instead of "Threads" and "Thread."

Review is the triage queue for items that need correction, organization, or user action. It is not a second call log.

Assistant is the live control and configuration surface.

Search is a first-class memory retrieval tool because the moat is cross-channel context.

### Primary Navigation Rules

- Bottom navigation must have exactly `5` items.
- Label length must be `4-9` characters.
- Each item must include an icon and label.
- Active tab target height: `56dp`.
- Bottom nav total height: `72dp`.
- The live-call dock may appear above bottom nav and must not obscure the active tab.
- Settings, account, billing, privacy, and diagnostics are not bottom-nav items.
- The assistant presence/avatar control opens Profile and Settings. It should be reachable from every authenticated primary screen.

## Global App Shell

### Layout

Every authenticated screen uses this shell:

- Top system inset + `12dp`.
- Horizontal gutter `20dp` on phones under `430dp` wide.
- Horizontal gutter `24dp` on phones `430-599dp` wide.
- Horizontal gutter `32dp` on screens `600dp+`.
- Header height `56-72dp`.
- Scrollable content area.
- Optional live-call dock.
- Bottom nav above system navigation.
- Bottom safe area = system inset + `8dp`.

Production polish rules:

- Scrollable content must include enough bottom padding that the final row/card can fully clear the bottom navigation by at least `24dp`.
- Do not repeat the current screen title inside the content area unless it introduces a materially different subsection.
- Filter chips should be compact controls, not large pill buttons; target `30-34dp` height.
- Image-card overlays must cap title, metadata, and body text so copy cannot spill past card bounds.
- Empty states on the atmospheric background must use high-contrast text or a quiet surface; never low-contrast gray directly on purple.
- Primary list rows should preserve a steady rhythm: `10-12dp` vertical gap, stable action targets, and no clipped content under nav.
- The default authenticated shell should use compact density: `16dp` horizontal gutters, `8dp` header vertical padding, `10dp` list gaps, `12dp` card padding, and `44-46dp` primary button height unless a live/approval action requires larger emphasis.

### Header

Header elements:

- Left: current section title or compact Phone Agent wordmark.
- Center: none by default.
- Right: assistant presence control.

Header numeric spec:

| Element | Value |
| --- | ---: |
| Header min height | `56dp` |
| Header max height | `72dp` |
| Title size | `24sp` |
| Title line height | `30sp` |
| Title max lines | `1` |
| Presence control height | `38dp` |
| Presence control radius | `999dp` |
| Presence control horizontal padding | `8dp` |
| Avatar size | `32dp` |
| Header element gap | `10dp` |

### Assistant Presence Control

The assistant presence control replaces the old standalone `Active` pill. It should answer: "Can my assistant protect me right now?" It combines a small state dot or ring, a human label, and the user's avatar/initials.

Presence states:

| State | Label | Color | Trigger |
| --- | --- | --- | --- |
| Ready | Ready | Green | Assistant reachable and no urgent issue |
| Setup | Setup | Amber | Required onboarding incomplete |
| Live | Live | Amber | Assistant is on a call |
| Needs you | Needs you | Red | User action pending |
| Syncing | Syncing | Blue-gray | Refresh in progress over `700ms` |
| Offline | Offline | Gray/red | Backend unreachable for `30s` |
| Paused | Paused | Gray | User disabled assistant |

Tapping the presence control opens Profile and Settings. A future long-press may open Assistant Status directly. The old `Active` label should not be the primary visual language; use `Ready` for normal operation.

Numeric:

- Height: `38dp`.
- Status dot: `8dp`.
- Avatar: `32dp`.
- Label text: `13sp`, `700`.
- Max width: `132dp` on `360dp` screens, `160dp` on wider phones.
- If the label would overflow, hide the label and keep dot + avatar.

The presence control must not look like a call-center status badge. It should feel like a calm account and assistant affordance.

### Profile And Settings

The profile/settings surface opens from the presence control and may be a full screen or a modal sheet. For the current Android app, use a full screen so logout, billing, forwarding, privacy, and support have enough room.

Sections:

- Profile: display name, phone number, assistant name.
- Assistant: behavior, greeting, disclosure, notes, live transfer policy.
- Phone: forwarding setup, assistant number, test call.
- Billing: plan, card, spending cap, invoices.
- Calendar and connected channels.
- Privacy and notification preferences.
- Support and diagnostics.
- Logout.

Logout:

- Must be visible near the bottom.
- Must require confirmation.
- Must clear local cache and authenticated state.
- Must not delete the user's cloud data.

### Assistant Status Sheet

The status sheet, reachable later from Assistant or long-press presence, should show:

- Assistant mode.
- Phone forwarding state.
- Active channels.
- Last sync.
- Last handled communication.
- Pending setup blockers.
- Data freshness.
- Provider status only under "Technical details".

Sheet specs:

- Modal height: `50-85%` of screen.
- Drag handle: `36dp x 4dp`.
- Section gap: `20dp`.
- Close target: `44dp`.
- Max visible rows before scroll: `8`.

## Visual Design System

### Design Personality

The product should feel closer to Calm than to a productivity dashboard. The target is a serene communication OS: immersive, quiet, emotionally steady, and confident.

- Atmospheric full-screen surfaces.
- Clear hierarchy without feeling like an admin tool.
- Strong but unhurried typography.
- Minimal, intentional color.
- Useful density hidden behind calm pacing.
- A feeling that the assistant is protecting the user's peace, not adding another inbox.

The app may use one intentional atmospheric background system, inspired by Calm's meditative launch surfaces:

- Deep twilight gradients.
- Soft indigo, violet, midnight, and muted blue-green.
- Large quiet negative space.
- Light text over dark atmosphere.
- Soft elevated cards for actual work objects.

The aesthetic should be Calm-inspired, not Calm-copied. Do not reproduce Calm branding, exact gradients, copy, illustrations, or interaction patterns.

### Calm-Inspired Design Rules

- The first impression should be serenity before productivity.
- Today should feel like a quiet briefing, not a dashboard.
- Live-call urgency should be clear but not visually frantic.
- Use cards as calm containers floating over atmosphere.
- Prefer fewer visible controls per screen.
- Prefer one primary action per card.
- Let whitespace carry confidence.
- Use motion sparingly and slowly; target `180-260ms` transitions.
- Preserve trust: calm should not hide important risks, expirations, or permission boundaries.

Avoid:

- Busy dashboard grids.
- Dense CRM-style tables.
- Harsh white-on-gray admin screens.
- Generic SaaS blue/purple gradients.
- Decorative blobs, orbs, and bokeh.
- Abstract AI blobs.
- Large marketing hero sections inside the app.
- Debug/provider terminology in primary UI.
- Excessive card stacking above the fold.
- Neon colors, confetti, or playful gamification.

### Color Tokens

| Token | Hex | Usage |
| --- | ---: | --- |
| `bg.twilightTop` | `#65549B` | Upper atmospheric background |
| `bg.twilightMid` | `#352363` | Mid atmospheric background |
| `bg.twilightBottom` | `#160A2F` | Lower atmospheric background |
| `surface.card` | `#FCFAFF` | Primary work cards |
| `surface.cardSoft` | `#F5F1FF` | Quiet panels and metric tiles |
| `surface.nav` | `#FFFFFF` at `94%` opacity | Bottom navigation |
| `surface.glass` | `#FFFFFF` at `14%` opacity | Optional hero/status overlays |
| `ink.onAtmosphere` | `#FFFFFF` | Header and section text on dark background |
| `ink.primary` | `#151129` | Main text on cards |
| `ink.secondary` | `#5D5874` | Body text on cards |
| `ink.tertiary` | `#7A7392` | Metadata |
| `line.default` | `#E8E1F3` | Card and input borders |
| `line.strong` | `#D8CCE8` | Active borders |
| `brand.primary` | `#7667E8` | Primary actions |
| `brand.dark` | `#5C4EC4` | Pressed primary |
| `success` | `#087C6F` | Active/success |
| `warning` | `#B7791F` | On-call/setup |
| `critical` | `#C2413A` | Needs user/failed |
| `info` | `#4E8CCF` | Informational |
| `private` | `#8B6FE8` | Sensitive/private marker |

Contrast requirements:

- Body text contrast: at least `4.5:1`.
- Metadata contrast: at least `3.8:1`, preferred `4.5:1`.
- Primary button text: at least `4.5:1`.
- Red/green status must include text or icon, never color alone.
- Section labels over atmosphere must use at least `80%` white opacity.
- Cards over atmosphere must remain at least `92%` opaque unless all text contrast is tested.

### Typography

| Token | Size | Line Height | Weight | Usage |
| --- | ---: | ---: | ---: | --- |
| `display` | `30sp` | `36sp` | `700` | Today headline only |
| `screenTitle` | `26sp` | `32sp` | `700` | Screen title |
| `sectionTitle` | `13sp` | `18sp` | `700` | Section labels, all caps optional |
| `cardTitleLg` | `20sp` | `26sp` | `700` | Major card title |
| `cardTitle` | `18sp` | `24sp` | `700` | Standard card title |
| `bodyLg` | `17sp` | `25sp` | `400` | Important explanatory text |
| `body` | `15sp` | `22sp` | `400` | Default body |
| `bodySm` | `14sp` | `20sp` | `400` | Secondary body |
| `meta` | `12sp` | `16sp` | `600` | Badges and timestamps |
| `button` | `15sp` | `20sp` | `700` | Buttons |

Rules:

- No viewport-based font scaling.
- Support Android font scale `1.0x`, `1.15x`, and `1.3x`.
- At `1.3x`, content may grow vertically but must not overlap.
- Card title max: `2` lines.
- Card body max: `3` lines.
- Feed card preview target: `80-160` characters.
- Feed card hard preview max: `220` characters.

### Spacing

| Token | Value |
| --- | ---: |
| `space.1` | `4dp` |
| `space.2` | `8dp` |
| `space.3` | `12dp` |
| `space.4` | `16dp` |
| `space.5` | `20dp` |
| `space.6` | `24dp` |
| `space.8` | `32dp` |
| `space.10` | `40dp` |

Rules:

- Default card padding: `12dp`.
- Hero/status card padding: `14dp`.
- Section top margin: `18dp`.
- Card-to-card gap: `10dp`.
- Related row gap: `8dp`.
- Button group gap: `6-8dp`.
- Screen bottom padding above bottom nav: `108dp`.
- Adjacent cards, metric tiles, segmented choices, and action buttons must never touch. Horizontal and vertical grouped controls require at least `8dp` visible gutter between siblings.
- Layout params must preserve sibling gutters. Do not set margins inside a child view if the parent `addView(..., LayoutParams)` call will overwrite them.

### Shape

| Element | Radius |
| --- | ---: |
| Standard card | `12dp` |
| Hero card | `16dp` |
| Button | `10dp` |
| Input | `10dp` |
| Chip | `999dp` |
| Bottom nav | `18dp` |
| Modal sheet top corners | `24dp` |

No repeated feed card should exceed `16dp` radius. Avoid nested cards.

### Elevation

| Element | Elevation |
| --- | ---: |
| Feed card | `1dp` |
| Pressed card | `0dp` plus border |
| Bottom nav | `6dp` |
| Modal sheet | `12dp` |
| Toast/snackbar | `8dp` |

## Core Components

### Cards

All cards have:

- White surface.
- `1dp` border.
- `12dp` radius.
- `12dp` padding.
- Optional `1dp` elevation.
- Press state within `100ms`.

Card size targets:

| Card | Target Height | Max Feed Height |
| --- | ---: | ---: |
| Today priority | `132dp` | `196dp` |
| Communication | `88dp` | `132dp` |
| Thread | `116dp` | `168dp` |
| Decision | `124dp` | `180dp` |
| Live call | `160dp` | `240dp` |
| Person | `68dp` | `104dp` |
| Calendar event | `84dp` | `128dp` |
| Empty state | `112dp` | `172dp` |

### Buttons

| Button | Height | Min Width |
| --- | ---: | ---: |
| Primary | `46dp` | `120dp` |
| Secondary | `46dp` | `108dp` |
| Compact | `38dp` | `80dp` |
| Icon | `44dp` | `44dp` |
| Emergency live action | `56dp` | `160dp` |

Rules:

- At most `2` full-width buttons per row.
- At most `3` visible actions per card.
- Additional actions go into overflow.
- Destructive actions require confirmation.
- Live approval primary button is `56dp` high.

### Chips

Chip specs:

- Height `32dp`.
- Horizontal padding `12dp`.
- Gap between chips `8dp`.
- Text size `13sp`.
- Max label `18` characters.

Chip types:

- Channel.
- Status.
- Topic.
- Privacy.
- Relationship.
- Confidence.
- Due date.

### Forms

Input specs:

- Height `48dp` minimum.
- Multiline min height `112dp`.
- Label text `13sp`.
- Input text `16sp`.
- Error text `13sp`.
- Error gap to field `6dp`.

Validation:

- Required field errors show after blur or submit.
- Form submit preserves input on failure.
- Network-backed submit shows loading after `300ms`.

### Live Call Dock

The live-call dock appears globally when the assistant is on a call.

Specs:

- Height collapsed: `72dp`.
- Height expanded: `180-280dp`.
- Position: above bottom nav.
- Shows caller, topic, elapsed time, state, and primary action.
- Tapping opens Assistant live view.

Dock states:

- Listening.
- Asking intent.
- Waiting for caller.
- Needs answer.
- Transfer requested.
- Wrapping up.
- Stale.

Freshness:

- Elapsed timer updates every `1s`.
- Stale warning at `15s` since last live event.
- Auto-collapse after call end within `5s`.
- Call-start and call-end provider events must send privacy-safe FCM data refreshes so the dock and Assistant tab update without periodic polling.
- A live answer or transfer request must automatically foreground the Assistant live section when the app is open.

## Fresh Ideal Navigation

### Bottom Nav Item 3: Home

Purpose: daily control center.

Primary question: "What matters now?"

### Bottom Nav Item 2: Topics

Purpose: durable topic memory.

Primary question: "What situations am I managing?"

### Bottom Nav Item 3: Review

Purpose: triage queue for assistant uncertainty and unorganized communication.

Primary question: "What needs my review before it becomes durable memory or action?"

### Bottom Nav Item 4: Assistant

Purpose: live call control, assistant configuration, rules, notes, and channel health.

Primary question: "What is my assistant doing and how is it behaving?"

### Bottom Nav Item 5: Search

Purpose: retrieve memory across channels.

Primary question: "What do I know about this person, topic, decision, or communication?"

## Screen 1: Home

### Purpose

Home is not a dashboard of everything. It is a ranked agenda of communication outcomes, with recent calls as the primary object because calls are the first behavior users expect to review after the assistant answers.

### Above-Fold Requirement

On a `393x873dp` viewport, Home must show:

- Header.
- Horizontally scrollable topic cards.
- Recent calls with action controls.
- Priority items when present.

### Content Order

1. Horizontally scrollable topic cards.
2. Recent calls with action controls.
3. Priority queue when there are live requests or review items.

Home must not show a large generic assistant-status card such as "Assistant active." Assistant health belongs in the header status chip and Assistant tab. Home should spend first-screen space on communication objects: topics and calls.
Home must not show a generic "Latest changes" or "Today's changes" section. Cross-channel activity belongs in Review, Search, notifications, and topic detail timelines unless it is urgent enough to appear in Needs attention.

Recent call cards:

- Recent calls should render as compact rows, not large summary cards.
- Each row shows caller name, phone number, date/status, and action icons aligned right.
- The summary is not shown in the row; it belongs on the call detail screen.
- Each row has direct actions: call, details, and note.
- `Call` dials the callback number when present, otherwise the caller number.
- `Details` opens transcript and structured call details.
- `Note` opens a note composer prefilled/scoped to that caller where possible.
- Target row height: `84-108dp`.
- Action target size: `40-44dp`.

Tracked topic cards:

- Horizontal row using Calm-like large image cards.
- Card width: `220-260dp`.
- Card height target: `160-190dp`.
- Each card uses a full-bleed AI-generated bitmap image relevant to the topic category.
- Overlay text must be short and readable against the image.
- Each topic card shows title, status, count summary, and the most recent structured state when available.
- Empty state shows a single card explaining that topics appear after calls are classified or created.
4. Upcoming decisions and deadlines.
5. Recent handled communications.
6. Suggested improvements.

### Assistant State Strip

Status: not used on Home. This pattern may appear in the Assistant tab or setup/status surfaces, but Home should not show a large generic assistant-state card.

Height: `76-104dp` when used outside Home.

Content:

- Assistant mode.
- Phone forwarding state.
- Channels active count.
- Last sync.
- Main action.

Examples:

- "Active. Handling missed calls and calendar requests."
- "Needs setup. Forwarding is not verified."
- "On a call with Theresa."

Metrics:

- Channels active: `1-7`.
- Calls handled today.
- Items needing user.

### Priority Queue

Shows the top `1-5` items ranked by urgency.

Priority item types:

- Live answer.
- Transfer approval.
- Decision request.
- Open question due soon.
- Topic conflict.
- Failed calendar action.
- Sensitive sharing approval.
- Forwarding issue.

Priority score formula:

- Live call waiting: `+100`.
- Transfer approval: `+95`.
- Live answer request: `+90`.
- Emergency language detected: `+85`.
- Decision due within `24h`: `+60`.
- Conflict in active topic: `+45`.
- Known family caller issue: `+40`.
- Failed automation: `+35`.
- Low-confidence topic suggestion: `+15`.
- Informational summary: `+5`.

### Priority Card

Fields:

- Type label.
- Person/caller.
- Topic.
- What happened.
- Why it matters.
- Deadline/expiration.
- Primary action.
- Secondary action.

Numeric specs:

- Title max `48` characters.
- Reason max `160` characters.
- Topic chip max `24` characters.
- Expiration timer visible if under `5m`.
- Primary action height `50dp`.

### Today Changes

Shows `3-7` material changes from the last `24h`.

Examples:

- "Contractor asked for approval on plumbing change order."
- "Assistant created inspection event for Friday at 10 AM."
- "Unknown caller left a message about insurance quote."

Each change has:

- Channel icon.
- Topic.
- Summary.
- Outcome.
- Timestamp.

### Today's Metrics

Maximum `5` metrics:

- Needs you.
- Calls handled.
- Topic updates.
- Decisions pending.
- Calendar changes.

Metric tile:

- Height `72dp`.
- Value `24sp`.
- Label `13sp`.
- Tap target entire tile.

### Empty State

If nothing needs the user:

Title: "Quiet right now"

Body: "The assistant will surface calls, decisions, and topic changes when they need your attention."

Actions:

- "Test assistant"
- "Add note"

## Screen 2: Topics

### Purpose

Topics is the main product surface. It is where fragmented communication becomes organized reality.

### Topic List Structure

1. Compact intro and create action.
2. Needs attention section.
3. Active topics.
4. Suggested topics.
5. Archived entry.

### Topic Card

Topic cards on the Topics screen should use the same image-led visual language as Home topic cards, scaled for vertical browsing. They should feel like persistent real-world situations, not database rows or white admin panels.

### Topic Image System

Topic imagery should come from a curated, Calm-inspired category set before attempting per-topic generated images. Curated images keep the app visually coherent and avoid surprising or overly literal one-off artwork.

Initial reusable categories:

- Home projects / repairs.
- Family logistics.
- Work decisions / recruiting.
- Travel planning.
- Medical appointments.
- Finance / taxes / payments.
- Car / insurance / lease.
- School / kids activities.
- Pets.
- General conversation.

Image rules:

- Use landscape `3:2` crops for Android topic-card assets.
- Avoid readable text, logos, brand marks, people, medical alarm imagery, and clutter.
- Keep the lower third compatible with white text overlays.
- Prefer serene editorial interiors, quiet tabletops, soft natural light, and twilight shadows.
- Use deterministic keyword/category mapping until the product has a safe per-topic image generation review workflow.

Required fields:

- Topic title.
- Status.
- Latest material update.
- Participants.
- Next action.
- Counts for decisions, questions, tasks.
- Last updated.

Optional fields:

- Sensitivity flag.
- External sharing indicator.
- Confidence warning.
- Deadline.

Numeric specs:

- Target height `176dp`.
- Max height `210dp`.
- Title max `2` lines.
- Latest update max `2` lines.
- Participants visible `3`, then "+N".
- Count chips visible `3`.
- Next-action text max `80` characters.
- Card image must fill the card bounds.
- Text overlay height target `76-112dp`.
- Vertical gap between topic cards `12dp`.
- The list should not show a full create form inline when topics already exist.

### Topic Statuses

| Status | Meaning |
| --- | --- |
| Active | Normal ongoing topic |
| Waiting on me | User action required |
| Waiting on them | External participant action required |
| Scheduled | Next event is on calendar |
| Blocked | Conflict or missing information |
| Quiet | No recent changes |
| Complete | Topic resolved |
| Archived | Hidden from active list |

### Create Topic Flow

Entry points:

- Topics compact create action.
- Review topic suggestion.
- Communication detail.
- Assistant note scope.

Fields:

- Title, required, `3-60` characters.
- Description, optional, `0-500` characters.
- Participants, optional, `0-20`.
- Sensitivity, optional, default normal.
- Deadline, optional.
- Starting communication, optional.

Create screen target:

- User can create title-only topic in under `15s`.
- User can create full topic in under `90s`.

### Suggested Topics

The assistant may suggest up to `5` new topics.

Suggestion card includes:

- Suggested title.
- Why it exists.
- Source communications count.
- Confidence.
- Initial participants.

Actions:

- Create.
- Merge into existing.
- Dismiss.

Confidence thresholds:

- `0.85+`: strong suggestion.
- `0.65-0.84`: needs review.
- Under `0.65`: do not show unless user opens review queue.

## Screen 3: Topic Detail

### Purpose

Topic detail is the canonical state of a real-world situation.

### Header

Fields:

- Title.
- Status.
- Participant avatars.
- Last updated.
- Privacy/share indicators.

Actions:

- Add update.
- Share.
- More.

### Layout

Preferred mobile structure:

1. Image-led topic hero.
2. Current brief.
3. Needs attention.
4. Decision board.
5. Open questions.
6. Tasks.
7. Timeline.
8. People.
9. Documents.
10. Sharing and audit.

Use vertical sections first. Do not hide core state behind tabs until the thread has enough content to justify it.

Visual rules:

- Topic detail should inherit the same image language as the Topics list.
- Hero image should be `200-240dp` tall on phone portrait, with rounded corners and a dark overlay.
- Back should be a compact overlay chip or compact row action, not a large rectangular button above the title.
- Title max `3` lines in the hero.
- Meta line should include status and counts.
- Empty decision/question/task states must remain readable on the atmospheric background; do not use low-contrast gray body text directly on purple.
- Use compact glass rows or quiet cards for empty states.
- Timeline items should be compact rows/cards with source and summary separated.
- Bottom content padding must keep the final timeline item visible above the bottom navigation.

### Current Brief

The brief is generated and editable.

Content:

- What the topic is.
- Current state.
- Latest material change.
- Next decision/deadline.
- Known conflict.

Numeric spec:

- Target `120-220` characters.
- Hard max `360` characters.
- Regenerate after material update.
- Show "Updated X ago".
- User edit must preserve prior generated version in audit.

### Needs Attention Section

Shows `0-5` cards.

Item types:

- Decision.
- Question.
- Task due.
- Conflict.
- Approval.
- Share request.
- Missing document.

Sort:

1. Due/expiring now.
2. User-owned.
3. High impact.
4. Recently changed.

### Decision Board

Decision item fields:

- Decision title.
- Status.
- Options.
- Required approvers.
- Deadline.
- Evidence.
- Current recommendation.

Statuses:

- Proposed.
- Awaiting approval.
- Approved.
- Rejected.
- Superseded.
- Needs more info.

Numeric rules:

- Max visible decisions before collapse: `3`.
- Max options visible: `3`.
- Decision title max `80` characters.
- Evidence snippet max `160` characters.
- Required approvers max visible `3`.

### Open Questions

Fields:

- Question.
- Owner.
- Due date.
- Source.
- Suggested next action.

Rules:

- Max visible questions before collapse: `3`.
- Question max `140` characters on card.
- Overdue badge if due date passed.
- Due soon badge within `48h`.

### Tasks

Fields:

- Task.
- Assignee.
- Due date.
- Status.
- Source.

Rules:

- Max visible tasks before collapse: `5`.
- Task title max `100` characters.
- Completed tasks collapse by default after `7d`.

### Timeline

Timeline item fields:

- Channel.
- Sender.
- Timestamp.
- Summary.
- Outcome badges.
- Link to source.

Pagination:

- Initial `20` items.
- Load `20` more.
- Group by day.
- Day separator height `32dp`.

### People In Thread

Shows participants and access.

Fields:

- Name.
- Role.
- Relationship.
- Channels.
- Permission.
- Last interaction.

Permission levels:

- Owner.
- Co-owner.
- Participant.
- Viewer.
- Contributor.
- External agent.

### Documents

Document card:

- Name.
- Type.
- Source.
- Related decision/task.
- Last updated.
- Sensitivity.

Actions:

- Open.
- Share.
- Request update.
- Remove.

### Sharing And Audit

Topic detail must show active external access.

Visible rows:

- Recipient.
- Artifact.
- Scope.
- Expiration.
- Last accessed.

Default external share expiration:

- Recap link: `7d`.
- Decision request: `72h`.
- Document request: `14d`.
- Participant thread access: explicit user setting.

## Screen 4: Review

### Purpose

Review is for triage, not long-term organization and not a duplicate of Home. Home owns recent calls and calm daily overview. Review owns things that need correction, approval, topic assignment, or cleanup before they become durable memory.

### Review Sections

1. Review queue.
2. Calls to organize.
3. Calendar/action issues.
4. Archived/reviewed.

### Filters

Default filters:

- All.
- Review.
- Calls.
- Messages.
- Email.
- Calendar.
- Docs.
- Unassigned.

Filter specs:

- Chip height `36dp`.
- Max visible chips before horizontal scroll: `5`.
- Active filter persists for session only.
- Every rendered filter chip must be interactive.
- Tapping a filter must redraw the Review list within `150ms` using cached local data.
- `All` shows topic suggestions, unassigned calls, and calendar/action issues.
- `Topics` shows topic suggestions and topic attachment review only.
- `Calls` shows calls that need topic assignment, follow-up correction, or user review.
- `Calendar` shows assistant calendar activity, with failed or uncertain actions first.
- Do not render decorative or disabled filter chips that appear tappable.

### Review Queue

Review item types:

- Topic suggestion.
- Low-confidence extraction.
- Possible conflict.
- Sensitive memory.
- External share approval.
- Calendar failure.
- Unknown caller identity.

Max visible in queue: `10`, then "View all".

### Communication Row

Required fields:

- Channel.
- Sender.
- Time.
- Topic or "Unassigned".
- Secondary identifier, such as phone number, email address, or source channel.
- Action icons aligned right.

Numeric specs:

- Height target `84-108dp`.
- Summary is not shown in the row; it belongs on the communication detail screen.
- Action target size `40-44dp`.
- Visible row actions max `3`.
- Review communication rows should visually match the compact recent-call rows on Home.
- Timestamp format under `24h`: "3:42 PM".
- Timestamp format under `7d`: "Tue".
- Timestamp older: "May 29".

### Communication Detail

Sections:

1. Summary.
2. Transcript/body.
3. Extracted outcomes.
4. Topic attachment.
5. People.
6. Raw/source details.
7. Privacy and retention.

Transcript:

- Collapsed preview `12` lines.
- Expand to full.
- Search within transcript.
- Speaker labels required for calls.

Actions:

- Attach/change topic.
- Create task.
- Create decision.
- Add note.
- Mark reviewed.
- Delete/request deletion.

### Call Detail Treatment

Call detail is a focused child screen, not another tab. It must hide the bottom navigation while open and provide a single back control in the content area.

Layout specs:

- Header title: `Call detail`.
- Bottom navigation: hidden.
- Back control: `44dp` high, max `96dp` wide, aligned left, label `Back`.
- Top summary card padding: `18dp`.
- Caller title size: `24sp`, semibold/bold.
- Caller metadata size: `13sp`.
- Primary summary size: `16sp`, line spacing `3dp`.
- Action buttons: `50dp` high, `8dp` gap, max `2` buttons per row.
- Outcome rows: each value must be inside a card or row with light background; never place dark text directly on the atmospheric background.
- Transcript card: light background, `18dp` padding, speaker labels `12sp` uppercase, utterance text `15sp`, line spacing `3dp`.
- Transcript preview can show full text for MVP, but it must have at least `120dp` clearance above the system navigation area or app bottom navigation.

Acceptance criteria:

- No black or muted text directly on the purple background except inside light cards.
- Transcript remains readable at `360dp`, `390dp`, and `430dp` wide devices.
- Bottom content is not hidden behind app navigation or Android system navigation.
- Opening from Home or Review returns to the same tab.
- Empty summary, intent, follow-up, or transcript states show calm placeholder copy instead of disappearing into blank space.

## Screen 5: Assistant

### Purpose

Assistant is where the user controls the AI layer.

It combines:

- Live activity.
- Assistant mode.
- Rules.
- Notes.
- Channels.
- Voice behavior.
- Health.

### Assistant Screen Sections

1. Assistant status summary.
2. Live needs when present.
3. Quick actions.
4. Connected channels.
5. Memory, rules, and billing.
6. Voice/personality summary.

The Assistant tab should not feel like a diagnostic dashboard. Technical URLs, webhook status, provider names, and model/provider implementation details belong in Settings, Status, or internal diagnostics, not the main Assistant tab.

### Current Assistant Cleanup

The current native Android Assistant tab should use this hierarchy:

- Top command card: assistant name, active/setup/live chip, one plain-language explanation, and exactly `3` compact metric pills in one horizontal row.
- Live needs: show only active calls, transfer approvals, answer requests, or live notifications. If none exist, use a slim inline strip under the command card, not a full panel.
- Primary actions: `Add note`, `Test call`, `Forwarding`, and `Calendar` in a compact `2x2` grid immediately after live needs.
- Voice behavior: compact row below primary actions with assistant name/style and a single `Customize` affordance.
- Connected channels: Phone and Calendar first in dense rows. Future channels may appear only as muted `Soon` rows and must not dominate the first screen.
- Memory and controls: Notifications, People memory, Phone contacts, Rules, Billing in dense rows.

Acceptance criteria:

- No backend URL, webhook verification, or AI provider/model copy on the primary Assistant tab.
- No more than `3` section headers visible before scrolling on a `393x873dp` viewport.
- Live transfer and answer requests remain above non-urgent settings.
- Live answer composers render above generic active-call status because they are the fastest-expiring user action.
- `Add note` and `Test call` are reachable without scrolling on common phones.
- The first viewport should not show more than `2` large white containers before the action grid.
- Empty live state height must stay under `52dp`.
- Channel/control rows should be `56-68dp` tall, not card-sized.
- Channel rows use user-facing labels: `Phone`, `Calendar`, `SMS`, `Email`, `Documents`.
- The Android app must not run periodic polling for live calls, approvals, answer requests, notifications, or calendar activity. FCM data messages, notification action results, notification deep links, app launch, and explicit user refresh/navigation are the allowed refresh triggers. Only explicit navigation to a screen should reset scroll to top.
- Live answer requests expire after `90s` by default unless a stricter production policy is explicitly configured.

### Live Activity

If active call exists, this section is first.

Active call card:

- Caller.
- Phone.
- Relationship.
- Topic.
- Intent.
- State.
- Elapsed time.
- What assistant is doing.

Actions:

- Send answer.
- Approve transfer.
- Decline transfer.
- Take over.
- Tell assistant to take message.

Numeric specs:

- Elapsed timer updates every `1s`.
- Stale at `15s`.
- Transfer approval expires at `60s`.
- Live answer expires at `90s`.
- Primary action height `56dp`.

### Assistant Mode

Modes:

- Active.
- Quiet.
- Screen only.
- Do not disturb.
- Paused.

Mode row:

- Mode name.
- Explanation.
- Duration.
- Next automatic change.

Temporary pause options:

- `30m`.
- `1h`.
- `4h`.
- Until tomorrow.
- Custom.

### Quick Notes

Assistant notes are temporary context.

Fields:

- Note.
- Scope.
- Expiration.
- Relay permission.
- Sensitivity.

Default expiration:

- End of day.

Scope options:

- Everyone.
- One person.
- Relationship group.
- Topic.
- Channel.
- Time window.

Note max:

- Soft target `40-240` characters.
- Hard max `1000` characters.

### Rules

Rule categories:

- People.
- Topics.
- Time.
- Urgency.
- Calendar.
- Unknown callers.
- Sensitive topics.

Rule examples:

- Family can interrupt unless Do Not Disturb.
- Unknown callers are screened.
- Basement Project changes over `$1,000` require both approvers.
- Medical topics never share externally without approval.

Rule card:

- Trigger.
- Behavior.
- Exceptions.
- Last used.

### Channels

Channel cards:

- Phone.
- SMS.
- Email.
- Calendar.
- Documents.
- Agent messages.

Each card shows:

- Connected state.
- Permissions.
- Last sync.
- Last successful action.
- Problems.

### Voice Behavior

Controls:

- Greeting style.
- Disclosure level.
- Caller familiarity.
- Brevity.
- Transfer policy.
- Emergency handling.

Sliders/toggles:

- Brevity: `1-5`.
- Warmth: `1-5`.
- Proactivity: `1-5`.

The app should not expose model/provider names in normal voice behavior controls.

## Screen 6: Search

### Purpose

Search is a first-class memory interface.

### Search Scope

Search across:

- Topics.
- Communications.
- People.
- Decisions.
- Questions.
- Tasks.
- Documents.
- Calendar events.
- Notes.

### Search UI

Search field:

- Height `52dp`.
- Do not auto-open the keyboard on tab entry; focus only after the user taps the field.
- Placeholder: "Search people, topics, decisions..."
- Search should feel quiet by default. Do not render dashboard-style suggestion cards, stats, or multiple result groups before the user types.

Filters:

- All.
- Topics.
- People.
- Calls.

MVP behavior:

- `All`, `Topics`, `People`, and `Calls` must be interactive segmented filters.
- Tapping a filter must redraw the visible result list within `150ms` for cached local data.
- The selected filter must be visually distinct from unselected filters.
- Do not render decorative or disabled filter chips that appear tappable.
- The search field must filter cached local people, topics, calls, and communication results as the user types.
- Suggested search rows with an `Open` action must navigate to a real filtered result set or product surface.
- Filter chips should appear only when there is a query or when the user has focused the search field. The default empty state may show at most `3` compact quick-find chips.
- The default `All` query result must render as one compact stream labeled `Results`, not as separate dashboard sections for every object type.
- Explicit filters may show one matching result group with a quiet empty state.

Result ranking:

- Exact title/name match: `+100`.
- Active thread: `+30`.
- Recent item within `7d`: `+20`.
- Pending decision/question: `+25`.
- High participant overlap: `+20`.
- Archived item: `-30`.

### Result Row

Fields:

- Type.
- Title.
- Snippet.
- Topic.
- Date.
- Source.

Numeric specs:

- Initial `All` results `6`.
- Filter-specific initial results `20`.
- Load more `20`.
- Snippet max `96` characters.
- Search results should use compact lookup rows, not Home/Review action rows, unless the result is a topic image card opened from Topics.
- Search result rows should expose one primary open/details affordance; call-back, note, attach, and workflow actions belong on the destination screen.
- Search response target under `700ms` cached, `1800ms` network.

### Suggested Searches

Before query:

- Show a single quiet empty panel and at most `3` compact quick-find chips.
- Recommended quick-find chips: `Topics`, `People`, `Calls`.
- Do not show counts, dashboards, recent-call lists, or calendar summaries before the user searches.
- Do not show future integration categories until they contain real connected data and working navigation.

## Onboarding Blueprint

### Onboarding Goal

Get the user to a successful assistant-handled call in under `10` minutes.

Onboarding must be a traditional first-run sequence, not a module embedded in the authenticated Today tab. A new user should experience a focused setup flow with the bottom navigation hidden until the core setup path is complete or explicitly dismissed at the final test-call step.

### Steps

1. Welcome.
2. Account and phone verification.
3. Name assistant.
4. Assistant number assigned.
5. Explain call forwarding.
6. Configure forwarding.
7. Test call.
8. Review first call outcome.

Optional setup after activation:

- Tune assistant style.
- Add first note.
- Connect calendar.
- Add trusted contacts.
- Create first topic thread.

### Google Play First-Run Flow

The first-run flow must assume the user is not Daryl, has no Retell number, has no forwarding configuration, and has not decided how their assistant should behave.

Required screens:

1. Value promise.
2. Create account.
3. Verify mobile number.
4. Name assistant.
5. Assign assistant number.
6. Configure forwarding.
7. Test assistant.
8. First handled call review.

Do not show the main authenticated shell until account bootstrap succeeds. If backend auth is unavailable, show a recoverable setup error rather than a fake demo account.

After account bootstrap succeeds, users with incomplete setup must be routed to dedicated onboarding screens on app launch. Do not use the Today tab as the primary place to complete activation. Today may show assistant readiness after onboarding, but it must not contain a checklist-style onboarding module.

Onboarding screen behavior:

- Hide bottom navigation on all required onboarding screens.
- Use a clear screen title and one primary action per screen.
- Show at most `1` secondary action on any onboarding screen.
- Keep each screen to `1` decision or task.
- Show setup progress in copy or compact status text, not as a dense checklist.
- Route back into onboarding after reloads until core setup is complete.
- The final test-call screen may offer `Open app` after forwarding instructions have been viewed, because the first real handled call depends on carrier behavior and user action outside the app.
- Authenticated app startup must not show onboarding failure UI while refreshing existing user state. Signed-in users should see a neutral Home sync state first; setup failure screens are only for actual first-run setup blockers.
- Transient startup refresh failures should retry once quietly before showing an error. Persistent authenticated refresh failures should show a Home sync issue, not "Could not finish setup."

Core setup gate:

- Account created.
- Mobile phone verified.
- Assistant named.
- Assistant forwarding number assigned.
- Forwarding instructions viewed.

The app shell can open after the core setup gate is complete. The app should still encourage a test call and first useful handled-call review as post-onboarding activation tasks.

### Name Assistant Screen

Goal:

- Give the assistant a user-facing identity with one lightweight decision.
- Target completion under `15s`.
- Do not ask for tone, personality, escalation rules, contacts, calendar, or topics on this screen.

Fields:

- Assistant name, default `Assistant`.
- Suggested name chips: `Maya`, `Ava`, `Jordan`, `Alex`.

Primary button:

- `Continue`

Behavior:

- If the field is empty, save `Assistant`.
- Save provider-neutral assistant profile defaults in the backend.
- Continue directly to assistant number assignment or forwarding setup.
- The user can change the name later from the Assistant tab.

Acceptance criteria:

- One text field only.
- Maximum `4` suggested chips.
- No more than `2` rows of chips at `360dp` width.
- No provider names or implementation details.
- Save target: under `800ms` cached/local, under `2500ms` network.

### Full Assistant Settings Screen

This is not required during onboarding. It belongs in the Assistant tab after activation.

### Phone Contacts

Contacts are optional after core onboarding. The Assistant tab must include a `Phone contacts` channel/control that:

- Explains that contacts let the assistant recognize first-time callers already in the user's address book.
- Requests Android `READ_CONTACTS` only when the user taps sync.
- Syncs minimal identity data only: contact display name, phone numbers, phone labels, source contact ID, and sync timestamp.
- Shows success with synced contact count.
- Exists in the production Compose launcher.
- Is reachable from both Assistant and Profile/Settings.
- Shows clear empty, permission denied, syncing, success, and failure states.
- Uses privacy-safe copy: contacts are identity hints, not conversation memory.

Numeric specs:

- Primary sync CTA height: `46dp`.
- Status rows: `52-68dp`.
- Body copy line height: `19-21sp`.
- Permission denial recovery must be visible without scrolling on a `360x780dp` viewport.
- Sync completion toast/snackbar copy: max `44` characters.

Acceptance criteria:

- The permission prompt appears only after the user taps sync.
- A denied permission does not block the rest of the app.
- Sync uploads no contact emails, addresses, birthdays, notes, photos, groups, organizations, or raw contact payloads.
- The Assistant tab updates the Phone contacts row count after a successful sync.
- First-time callers in synced contacts are greeted by contact name without "again" or prior-history language.
- Shows a permission-denied state with a clear path to try again.
- Does not upload notes, email addresses, addresses, birthdays, photos, or unrelated contact fields in the MVP.

Fields:

- Assistant name, default "Assistant".
- Greeting style segmented control: concise, warm, formal, protective.
- Disclosure style segmented control: standard, explicit.
- Warmth slider `1-5`.
- Brevity slider `1-5`.
- Proactivity slider `1-5`.
- Unknown caller handling: screen, message only, ring me.
- Family/trusted callers: can interrupt, ask first, message only.

Save target: under `800ms` cached/local, under `2500ms` network.

### Verify Mobile Number Screen

User-facing copy must not mention internal voice, telephony, webhook, or provider names.

Production behavior:

- The app uses Firebase Phone Auth to send a real SMS or voice OTP.
- The verification code is never returned by the Phone Agent backend.
- The setup code must not be displayed in production.
- The button label is `Send code`.
- If Firebase configuration is missing, show a blocking setup error for the build rather than a fake verification path.

Retell/provider details must not be visible on this screen. The app should explain behavior in user language.

### Assistant Number Assignment

Before assignment:

- Explain that the user keeps their existing number.
- Explain that calls forward to an assistant number.
- Show that number assignment may create provider cost and may require a verified phone/account.

After assignment:

- Show assigned assistant number in E.164 and formatted display form.
- Show carrier forwarding steps.
- Offer copy/share/dial-code actions.

Failure states:

- Phone not verified.
- Billing/plan required.
- Provider unavailable.
- Area code unavailable.
- Number already assigned.

### Completion Targets

- Account: under `60s`.
- Phone verification: under `90s`.
- Forwarding setup: under `4m`.
- Test call: under `2m`.
- Review first outcome: under `90s`.

### Welcome Screen

Title:

"Your phone should only ring when it should."

Body target:

`120-180` characters.

Primary button:

"Get started"

Secondary:

"I have an account"

### Forwarding Education

Explain `2` modes:

- Missed-call forwarding: recommended first.
- Full forwarding: advanced, can affect live transfer.

The user should never see more than `3` setup choices at once.

### Forward Calls Screen

Purpose:

- Help the user route calls to the assistant number with the least possible uncertainty.
- Use user-facing language only: `assistant number`, `missed-call forwarding`, `full forwarding`, and `turn forwarding off`.
- Do not mention provider names, webhooks, backend numbers, or implementation details.

Layout:

- Screen title: `Forward calls`.
- Preferred pattern: command layout on the atmospheric background, not stacked white cards.
- Primary command area: compact recommended missed-call forwarding row, carrier chip, forwarding code, assistant number as metadata, primary `Dial code`, compact `Copy number` / `Copy code` actions.
- Secondary codes: full forwarding and turn-off forwarding as lightweight command rows with dividers or subtle glass surfaces, not large cards.
- Onboarding continuation card may appear below the forwarding choices only.

Numeric specs:

- Primary command area target height under `180dp`; absolute max `200dp` on small phones.
- Secondary command area target height under `180dp`.
- Advanced rows target height `64-80dp`.
- The initial viewport should show the entire primary setup, both secondary codes, and at least `120dp` of atmospheric breathing room on a `360dp x 800dp` phone.
- Forwarding code display size should be `24-26sp`, not hero scale.
- Avoid large white containers on this screen. Use direct atmosphere, subtle glass, dividers, and compact chips.
- Primary dial button height `42-46dp`.
- Copy actions may be compact text buttons or chips.

Content rules:

- Recommended mode should be presented first.
- Full forwarding must warn that it can interfere with transferring calls back to the same mobile line.
- Turn-off forwarding must always be visible on the screen or reachable with one scroll.
- If a carrier-specific code is known, show it plainly. If carrier is unknown, the screen should eventually branch by carrier rather than pretending the code is universal.

### First Success Screen

Shown after first handled call.

Content:

- Caller.
- Summary.
- Topic suggestion.
- What assistant did.
- Ask: "Did the assistant handle this correctly?"

Actions:

- Looks good.
- Fix summary.
- Change topic.
- Adjust assistant.

## People Blueprint

People is reachable from Search, Topics, Assistant, and Settings. It does not need a bottom-nav tab.

### People List

Sections:

- Family and close contacts.
- Frequent contacts.
- Vendors and services.
- Unknown callers.
- Low-value/spam.

Person row:

- Name.
- Relationship.
- Last interaction.
- Linked topics count.
- Trust level.

Numeric:

- Row height `76dp`.
- Avatar `44dp`.
- Initial page `30`.

### Person Detail

Sections:

1. Identity.
2. Relationship and trust.
3. Memory.
4. Linked topics.
5. Recent communications.
6. Permissions.

Memory item must show:

- Fact.
- Source.
- Confidence.
- Safe-to-reveal flag.

Memory controls:

- Edit.
- Forget.
- Mark private.
- Mark safe to use.

## Calendar Blueprint

Calendar is a channel screen under Assistant and Settings.

### Calendar Status

Fields:

- Connected account.
- Permission scopes.
- Free/busy available.
- Event creation allowed.
- Last sync.
- Last assistant-created event.

### Calendar Rules

- Agent may check free/busy.
- Agent may create events when policy allows.
- Agent may update only Phone Agent-created events.
- User gets notification for every create/update/delete.

### Calendar Activity

Initial list `20`.

Each row:

- Event title.
- Action.
- Time.
- Topic.
- Source communication.
- Result.

Failure row must include:

- Reason.
- Retry action if safe.
- Manual instructions if not safe.

## Privacy, Consent, And Trust UX

### Privacy Center

Reachable from profile/avatar.

Sections:

- AI disclosure.
- Recording consent.
- Sensitive topics.
- Data retention.
- External sharing.
- Connected channels.
- Audit log.

### Default Privacy Settings

- Lock-screen content: private.
- External sharing: approval required.
- Sensitive topics: strict.
- Recordings: retain `30d` by default.
- Transcripts: retain until user deletion by default.
- Assistant notes: expire end of day by default.
- Raw provider payloads: retain `14d` unless needed for audit.

### Sensitive Topic Categories

- Medical.
- Legal.
- Financial.
- Employment.
- Family/private.
- Children/school.
- Emergency.

Sensitive topic behavior:

- Do not share externally by default.
- Do not show detailed notification content.
- Require explicit user confirmation before durable memory promotion.

## Notifications Blueprint

### Notification Types

| Type | Target Delivery | Expiration | Default Privacy |
| --- | ---: | ---: | --- |
| Transfer approval | under `3s` | `60s` | Generic |
| Live answer | under `3s` | `90s` | Generic |
| Decision due | under `30s` | none | Topic/title only |
| Call summary | under `15s` | none | Caller optional |
| Calendar change | under `10s` | none | Event title optional |
| Topic suggestion | under `30s` | none | Generic |
| Sharing approval | under `30s` | `24h` | Generic |

### Notification Actions

Production Android push notifications must deep link to the most specific app surface available. Live transfer notifications open the exact approval card and expose `Accept` and `Decline` actions. Live answer notifications open the exact answer composer and expose a `Reply` action. Call summaries open the relevant call/communication detail, topic suggestions open the review queue, billing issues open Billing, and calendar changes open Calendar activity. Notification action labels must stay short enough for Android collapsed notification UI: `Accept`, `Decline`, `Reply`, `Open`.

FCM payloads remain privacy-safe. Action routing may include object IDs and target paths, but must not include transcripts, detailed caller notes, topic memory, calendar descriptions, or assistant notes.

Transfer:

- Approve.
- Decline.
- Open.

Live answer:

- Reply inline from the notification shade.
- Open answer composer.
- Decline from the in-app composer.

Decision:

- Review.

Calendar:

- View.

Rules:

- No notification should expose transcript text by default.
- Live notification actions must deep link to the relevant live card.
- Expired actions must show expired state, not fail silently.
- Notification actions must work when the app is backgrounded or killed.
- After a successful action, the original notification must be dismissed or replaced within `1s`.
- If an action fails, show a privacy-safe result notification with one recovery action: `Open`.
- Double taps within `5s` must not create duplicate transfer decisions or duplicate live answers.
- Completing a live notification action must remove the corresponding item from the unread notification center after the next sync.
- Action telemetry must record result and latency without recording answer text or communication content.

### Expired Live Request State

If the user opens a transfer or answer request after its expiration:

- Screen title: `Request expired`.
- Body max: `140` characters.
- Primary action: `Back to Assistant`.
- Secondary action optional: `View notifications`.
- Do not show Accept, Decline, Reply, or Send controls.
- Do not show raw HTTP status codes.

Notification shade copy:

- Title: `Request expired`
- Body: `The assistant no longer needs this action.`

## External Sharing Blueprint

### Shareable Artifacts

- Call recap.
- Thread summary.
- Decision request.
- Task list.
- Document request.
- Approval request.
- Meeting recap.

### Share Flow

1. Choose artifact.
2. Choose recipient.
3. Preview exact content.
4. Choose scope.
5. Choose expiration.
6. Confirm send.
7. Show active share.

### Sharing Scope

Options:

- Single artifact.
- Single decision.
- Single task list.
- Thread summary only.
- Contributor access to thread.

Default:

- Single artifact.

Expiration defaults:

- Recap: `7d`.
- Decision request: `72h`.
- Document request: `14d`.
- Contributor access: no default; user must choose.

## Billing UX Blueprint

Billing is a trust surface. It should explain the Personal plan, included usage, and capped overage without exposing backend model/provider details.

### Billing Onboarding Screen

Placement:

- After phone verification and assistant naming.
- Before assistant number assignment when `/v1/onboarding/status` returns an incomplete `billing` step.
- Skippable only for explicit private beta/internal accounts.
- Omit from first-run onboarding when the backend says billing is not required; keep billing controls in Assistant settings.

Screen specs:

- Header title: `Choose your spending limit`.
- Body max: `220` characters.
- Primary card padding: `18dp`.
- Default cap: `$40/mo`.
- Preset cap buttons: `$25`, `$40`, `$75`, `$100`.
- Custom cap minimum: `$5`.
- Cap selector height: `48dp`.
- Primary action height: `56dp`.
- Secondary explanation link height: `44dp`.

Required copy:

- "Phone Agent Personal is $19/month and includes your assistant number and 50 assistant minutes."
- "You can change or pause this anytime."
- "Set the most you want to spend this month if usage goes above the included minutes."

Primary action:

- `Add card`

Secondary action:

- `How usage is billed`
- `Check billing status` after the user opens hosted card setup and returns to the app.

Acceptance criteria:

- User must understand the cap before adding a card.
- User may set the cap before or after adding a card.
- The screen must not mention backend provider names or model names.
- The screen must not imply unlimited usage.
- Failed payment setup returns to the same screen with recoverable error copy.
- Returning from the browser does not trap the user; the screen offers an explicit refresh/retry path.

### Billing Settings Screen

Entry point:

- Profile/settings.

Sections:

1. Current month.
2. Spending cap.
3. Payment method.
4. Usage categories.
5. Invoices.
6. Paid usage controls.

Current month card:

- Current spend.
- Spending cap.
- Progress bar.
- Reset date.
- Warning state if over `50%`, `80%`, or `100%`.

Usage categories:

- Assistant call time.
- AI processing.
- Assistant number.
- Messages.
- Documents.
- Storage.

Rules:

- No raw token counts in default view.
- No caller names, transcripts, topic names, or calendar descriptions in invoice previews.
- Show provider/model details only in internal diagnostics, not consumer UI.
- If cap is reached, show one primary action: `Increase cap`.
- If payment is past due, show one primary action: `Update card`.

### Billing Error States

Errors:

- Card setup failed.
- Payment method expired.
- Payment past due.
- Spending cap reached.
- Billing provider unavailable.
- Usage details stale.

Copy rules:

- Do not show raw payment-provider errors without translation.
- Explain whether assistant call handling is paused.
- Keep history, settings, and cancellation controls accessible even when billing is blocked.

### Billing Notifications

Notification types:

- `50%` cap reached.
- `80%` cap reached.
- Cap reached.
- Payment failed.
- Assistant number billing issue.

Default privacy:

- Generic; no call, topic, transcript, or calendar details.

## Agent-To-Agent Future UX

Agent-to-agent must be invisible until useful and explicit when active.

### Agent Request Card

Fields:

- External agent identity.
- Organization/person represented.
- Topic.
- Requested action.
- Data requested.
- Deadline.
- Trust level.

Actions:

- Allow once.
- Deny.
- Set rule.
- View details.

### Agent Permission Rule

Fields:

- Agent identity.
- Allowed thread.
- Allowed actions.
- Expiration.
- Audit visibility.

Default expiration:

- `30d`.

## Error, Loading, And Empty States

### Loading

Use skeletons, not only spinners.

Skeleton timing:

- Show immediately for cold loads.
- For refreshes under `300ms`, do not flash skeleton.
- Show inline loading after `300ms`.
- Show retry after `3000ms`.

### Offline

Offline behavior:

- Show cached data.
- Disable live actions.
- Allow local navigation.
- Queue safe drafts locally.
- Retry automatically every `30s` for `5m`, then every `5m`.

Android cache behavior:

- Cached state comes from Room and must be labeled stale when the last successful backend refresh is older than `5m` for live surfaces or `30m` for historical surfaces.
- Startup should render cached Home, Topics, Review, Assistant, and Search data in under `500ms` when a signed-in user has previous data.
- A failed startup refresh must not replace a useful cached app shell with a setup failure screen. The user should stay in the app with a recoverable stale/offline message.
- Live transfer approval, live answer, billing activation, calendar writes, sharing, and paid-resource provisioning cannot execute from cache; those actions require a fresh authenticated backend response.

### Empty States

Empty states must include:

- Title.
- One-sentence explanation.
- One primary action.
- Optional secondary action.

Max empty body:

- `180` characters.

### Error States

Error states must include:

- What failed.
- Whether data is stale.
- What user can do.
- Retry.

Do not show raw HTTP codes in primary UI.

## Accessibility

Requirements:

- Touch target minimum `44dp x 44dp`.
- Preferred target `48dp x 48dp`.
- Text contrast at least `4.5:1`.
- Font scale support through `1.3x`.
- Icon-only controls have labels.
- Screen reader order follows visual order.
- Live timers have accessible labels but do not announce every second.
- Animation max `300ms`.
- Reduced motion disables nonessential motion.

## Analytics

Track without raw communication content.

Events:

- App opened.
- Today priority viewed.
- Priority action taken.
- Thread opened.
- Thread created.
- Communication opened.
- Topic suggestion accepted.
- Topic suggestion dismissed.
- Live answer sent.
- Transfer approved.
- Transfer declined.
- Note created.
- Rule changed.
- Search performed.
- Share sent.
- Permission denied.

Every event includes:

- `screen`.
- `action`.
- `result`.
- `latencyMs` when network-backed.
- `objectType`.
- `objectId`.

Never include:

- Transcript text.
- Assistant note text.
- Email body.
- SMS body.
- Calendar description.
- Search query if it may contain sensitive content, unless privacy policy explicitly allows sanitized query analytics.

### Crash Reporting

Android should use crash reporting before beta distribution.

Allowed crash metadata:

- App version/build type.
- Device model class.
- Android version.
- Last non-sensitive screen/action name.
- Network/API status category.

Never include:

- Caller names or phone numbers.
- Transcript or answer text.
- Assistant notes.
- Topic memory.
- Calendar event titles/descriptions.
- Payment details.
- Provider payloads or secrets.

## Performance Budgets

| Interaction | Target | Max |
| --- | ---: | ---: |
| Cold launch to shell | `1200ms` | `2500ms` |
| Tab switch | `100ms` | `250ms` |
| Today data load | `800ms` | `2500ms` |
| Topic detail cached | `500ms` | `1200ms` |
| Topic detail network | `1200ms` | `3000ms` |
| Search cached | `700ms` | `1500ms` |
| Search network | `1800ms` | `3000ms` |
| Send live answer | `500ms` | `1500ms` |
| Approve transfer | `500ms` | `1500ms` |
| Create topic | `800ms` | `2500ms` |
| Save note | `800ms` | `2500ms` |

## QA Matrix

### Required Viewports

- `360x740dp`.
- `393x873dp`.
- `412x915dp`.
- `480x960dp`.
- `600x960dp`.

### Required Font Scales

- `1.0x`.
- `1.15x`.
- `1.3x`.

### Required Screenshots

Minimum: `120` screenshots.

Formula:

- `10` core screens.
- `4` states each.
- `3` viewport/font combinations.

Core screens:

1. Today.
2. Topics.
3. Topic detail.
4. Review.
5. Communication detail.
6. Assistant.
7. Live call state.
8. Search.
9. Onboarding/forwarding.
10. Privacy/settings.

### Zero-Tolerance Failures

- `0` crashes.
- `0` text overlaps.
- `0` primary actions hidden behind nav.
- `0` status/header overlap with system bars.
- `0` raw transcripts in logs.
- `0` destructive actions without confirmation.
- `0` expired live actions that appear actionable.

## Implementation Sequence

This is an ideal design sequence, not a reflection of current implementation.

### Current Facelift Slice

The next Android UI pass should prioritize first-impression trust over feature breadth.

Scope:

- Onboarding must be consumer-safe. It must not show stored crash text, HTTP details, provider names, stack traces, or internal setup diagnostics on the welcome screen.
- Bottom navigation must include an icon and label for each destination. The visual target remains `56dp` high per item inside a `72dp` nav.
- Placeholder letter icons such as `[T]`, `[I]`, or single-letter call actions are not acceptable in consumer builds.
- Home stays centered as the default tab and keeps first-screen focus on topic image cards, compact recent calls, and needs-attention items.
- Empty topic cards should be visually inviting but shorter than populated topic cards so Home can show recent calls and the first attention item on common phone screens.
- Call detail must read as a calm record, not a transcript dump. Summary, outcomes, and transcript should be separated into clear cards with high-contrast text on card surfaces.
- Call detail keeps bottom navigation hidden while the detail is open, but the back action must return to the originating tab without losing the app shell.
- Icon-only call-row actions must have content descriptions and `40-44dp` touch targets.

Acceptance criteria:

- No raw crash/signup diagnostic panels on first-run welcome.
- No backend provider names in onboarding copy.
- Bottom nav labels remain visible at `360dp` width.
- Bottom nav and recent-call actions use actual vector icons or clear text labels with content descriptions.
- Call detail body text uses card-surface colors, not dark-on-dark atmospheric colors.
- The recent call row remains compact and does not show the summary preview.
- Android release/debug builds pass after the facelift.

### Phase A: Product Shell

Build:

- Today.
- Topics.
- Review.
- Assistant.
- Search.
- Profile/settings entry.
- Global status pill.
- Live call dock.

Exit:

- `5` bottom-nav destinations work.
- Status pill opens health sheet.
- Live dock can appear on all screens.

### Phase B: Core Objects

Build:

- Topic card.
- Communication card.
- Person row.
- Decision card.
- Question card.
- Task card.
- Event row.
- Review card.

Exit:

- Feeds use consistent components.
- No nested cards.
- All components meet dimensions in this spec.

### Phase C: Primary Flows

Build:

- First onboarding.
- Forwarding setup.
- Test call.
- Topic suggestion review.
- Attach communication to topic.
- Create topic.
- Send live answer.
- Approve/decline transfer.

Exit:

- User can reach first successful handled call.
- Live actions succeed or show recoverable error.

### Phase D: Memory And Trust

Build:

- Topic detail.
- People memory.
- Assistant notes.
- Rules.
- Privacy center.
- Audit log.

Exit:

- User can inspect and correct assistant memory.
- Sensitive content has visible controls.

### Phase E: Polish And QA

Build:

- Skeletons.
- Offline states.
- Empty states.
- Error states.
- Accessibility labels.
- Screenshot automation.
- Performance instrumentation.

Exit:

- Pass `120` screenshot matrix.
- Pass zero-tolerance failures.
- Pass p95 performance targets.

## Estimated Effort

For a serious production-quality Android redesign:

| Phase | Estimate |
| --- | ---: |
| Product shell | `4-6` engineering days |
| Core components | `5-8` engineering days |
| Primary flows | `8-12` engineering days |
| Memory/trust surfaces | `8-14` engineering days |
| Polish and QA | `5-8` engineering days |

Total realistic range: `30-48` engineering days.

Anything under `15` engineering days should be considered a facelift, not a production redesign.
