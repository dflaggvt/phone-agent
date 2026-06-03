# Open Questions

This document tracks unresolved product, technical, legal, and business questions. The default posture is aggressive: design for the larger cross-channel communication layer, then validate with constrained implementation and clear reversibility.

## Strategic Questions

- Can Phone Agent own the cross-channel topic memory layer without becoming a bloated personal CRM?
- Which early use case proves topic threads fastest: home projects, family logistics, solo professional work, or small business operations?
- How much value must the phone-only product deliver before cross-channel ingestion is introduced?
- What is the minimum topic thread UX that clearly beats call history, email search, and SMS threads?
- How do we keep Retell replaceable while still moving quickly with Retell-specific live-call capabilities?

## Product Questions

- How should users create, merge, split, and archive topic threads?
- What should happen when the assistant attaches a communication to the wrong topic?
- When should low-confidence topic suggestions be auto-attached versus review-only?
- What thread state should be displayed first: latest update, decisions, open questions, tasks, documents, or timeline?
- How should topic threads handle overlapping real-world situations, such as Home Repairs and Basement Project?
- How should family members or partners co-own a topic thread?
- What is the right balance between "executive brief" and raw timeline?
- How should the assistant communicate prior thread context naturally without sounding invasive?
- Which actions should be direct by default, and which should require approval?
- Should calendar creates/updates remain direct for assistant-owned events? Current default: yes, notify every change, and update only events created by Phone Agent.

## Topic Memory Questions

- What facts become durable topic memory automatically?
- Which facts require user approval because they are sensitive, private, or high-impact?
- How should stale topic facts expire or be revalidated?
- How should conflicts be represented when two participants disagree?
- How much evidence should be shown for each decision, task, or open question?
- Should thread summaries be regenerated after every communication or only when the thread is opened?

## Cross-Channel Ingestion Questions

- Which channel should follow phone calls: SMS, email, calendar, or documents?
- Should email ingestion use Gmail API labels, forwarding, or user-selected messages first?
- Should SMS ingestion start with app notification access, carrier APIs, Twilio numbers, or manual import?
- How should document ingestion handle PDFs, images, email attachments, and cloud-drive links?
- How should raw content references be retained, encrypted, and deleted?
- What provider scopes are least-privilege enough for trust but useful enough for automation?

## Permission And Sharing Questions

- What exact roles should a topic participant have: viewer, commenter, contributor, approver, external agent?
- What can an external participant update through a shared link?
- When is user approval required before sharing a recap, task list, decision request, or document request?
- How should shared links expire and be revoked?
- How should the product verify an external participant's identity without forcing app installation?
- What sensitive information should never be included in shared artifacts by default?
- How should audit logs be exposed to the user in a simple way?

## Agent-To-Agent Questions

- What agent message schema should be used before open standards stabilize?
- How should agent identity, authorization, and signatures work?
- How does an external agent prove it represents a contractor, school, doctor, or business?
- How should topic-scoped handshakes prevent data leakage?
- What requests must always require human approval?
- How should incompatible or untrusted agents fall back to email/SMS/web forms?

## Interruption Engine Questions

- How should topic urgency combine with caller urgency?
- Should pending decisions above a user-defined dollar threshold escalate differently?
- Should conflicts trigger notification even when the latest message is low urgency?
- How should quiet hours interact with family, deadlines, and topic-specific rules?
- What is an acceptable false-negative rate for urgent calls or decisions?
- How should emergency language be handled when the communication is not a phone call?

## Technical Questions

- Which account recovery, device transfer, and support escalation policies do we need on top of Firebase Phone Auth?
- What Firebase Phone Auth account recovery, abuse prevention, quota, and support policies are required before public launch?
- Should Retell numbers be purchased on demand, pre-pooled by area code, or assigned manually during beta?
- What user state is required before paid Retell resources can be provisioned: phone verified, payment method, invite code, or all three?
- Should the default Retell architecture be one shared agent template with per-call dynamic variables, or one Retell agent per user for customization isolation?
- Should Firestore remain the MVP store for topic threads, or should PostgreSQL be introduced before topic-heavy work?
- What indexing strategy supports topic candidates by participants, embeddings, recency, and other non-keyword metadata?
- Should topic classification use embeddings, structured LLM classification, rules, or a hybrid?
- Where should embeddings live, and what deletion guarantees are required?
- What is the domain event/outbox implementation for reliable cross-channel ingestion?
- How should idempotency keys be generated across providers?
- How should provider raw payloads be stored without leaking vendor assumptions into domain models?
- How should communication item and topic schemas be versioned?
- What is the migration strategy from call-centric records to communication items?

## Legal And Compliance Questions

- What consent is required to analyze emails, SMS, documents, and third-party participant messages?
- How do recording consent and AI disclosure change when call summaries are shared externally?
- What privacy obligations apply to non-user participants whose facts are stored in topic memory?
- How do CCPA/CPRA and state privacy laws apply to inferred third-party data?
- What deletion/export rights should external participants have?
- What TCPA and AI voice rules apply to outbound follow-ups or shared SMS links?
- How should healthcare, legal, financial, employment, and school-related topics be restricted?
- What disclaimers are required for emergency, medical, legal, or financial topics?

## Business Questions

- Which initial segment values topic memory enough to pay early?
- Is the product sold as personal executive assistant, AI phone layer, family coordination tool, or solo-business communication OS?
- Does the viral loop come from shared recaps, decision requests, document requests, or agent-to-agent interactions?
- How should pricing account for voice minutes, provider fees, storage, email/SMS volume, document processing, and AI classification? Current working answer: launch with Phone Agent Personal at `$19/mo`, 50 included assistant minutes, `$0.39/min` overage, and internal AI/provider cost tracking.
- What is the acceptable cost per active topic thread?
- What default spending cap maximizes trust and conversion above the `$19/mo` base plan: `$40`, `$75`, `$100`, or user-selected during onboarding?
- Should public beta include a small usage credit after card attachment, or should every handled minute be paid from the first call?
- Should the first paid plan include any launch credit or trial period, or should every public user start with paid Personal immediately after card attachment?
- What gross margin target is required before introducing cheaper bundles or subscriptions?
- How should refunds be handled for failed transfers, bad call experiences, provider outages, or mistaken AI actions?
- Which billing details can appear on invoices without exposing sensitive caller, topic, transcript, or calendar information?

## Current Working Assumptions

- `TopicThread` is the core product object.
- `CommunicationItem` is the generic ingestion object.
- Calls are one type of communication item.
- Retell remains the initial voice provider but is replaceable infrastructure.
- Android remains first client; backend APIs remain client-agnostic.
- Topic threads are permission boundaries.
- Sharing must be useful, transparent, scoped, revocable, and audited.
- Agent-to-agent communication is future-facing but should shape the domain model now.
- Do not build fake cross-channel integrations before the domain skeleton and topic UX exist.
- Public monetization should start as a base subscription with card-on-file, monthly spending caps, overage warnings, and plain-language billing categories.
- Stripe is the preferred first payment provider, but Phone Agent must own the usage ledger, rating logic, billing gates, and local invoice/payment state mirror.
- Customer-facing billing should not expose backend provider names, raw token counts, or model names by default.
