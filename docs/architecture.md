# Architecture

Phone Agent is a modular monolith initially, with service boundaries that can later become independent services. The core architectural choice is that `TopicThread` and `CommunicationItem` are domain-owned product objects. Calls are one communication channel, not the center of the model.

## High-Level System Architecture

```mermaid
flowchart LR
    subgraph Channels["Communication Channels"]
        Phone["Forwarded phone calls"]
        SMS["SMS"]
        Email["Email"]
        Calendar["Calendar events"]
        Docs["Documents / attachments"]
        Manual["Manual notes"]
        AgentMsg["Future agent messages"]
    end

    Phone --> VoiceProvider["Voice provider adapter<br/>Retell first"]
    SMS --> SmsProvider["SMS provider adapter"]
    Email --> EmailProvider["Email provider adapter"]
    Calendar --> CalendarProvider["Calendar provider adapter"]
    Docs --> DocumentProvider["Document provider adapter"]
    Manual --> ClientAPI["Client API"]
    AgentMsg --> AgentProvider["Agent-message adapter"]

    VoiceProvider --> Ingestion["Communication ingestion service"]
    SmsProvider --> Ingestion
    EmailProvider --> Ingestion
    CalendarProvider --> Ingestion
    DocumentProvider --> Ingestion
    ClientAPI --> Ingestion
    AgentProvider --> Ingestion

    Ingestion --> Items["CommunicationItem store"]
    Ingestion --> Events["Domain event outbox"]
    Events --> Classifier["Topic classification and extraction"]
    Classifier --> Topics["TopicThread service"]
    Topics --> Decisions["Decisions / questions / tasks"]
    Topics --> Permissions["Permission service"]
    Topics --> Interruption["User interruption engine"]
    Permissions --> Sharing["Permissioned sharing service"]
    Interruption --> Notifications["Notification service"]
    Notifications --> NotificationStore["NotificationEvent store"]
    Notifications --> PushAdapters["Push/local delivery adapters"]

    VoiceProvider --> VoiceRuntime["AI voice runtime<br/>Retell-managed now"]
    VoiceRuntime --> Context["Agent context service"]
    Onboarding["Account / onboarding service"] --> Identity["User identity and sessions"]
    Onboarding --> Billing["Billing account + spending cap"]
    Onboarding --> Provisioning["Voice number provisioning"]
    Billing --> Provisioning
    Billing --> UsageLedger["Usage ledger + rating"]
    UsageLedger --> BillingProvider["Payment provider<br/>Stripe first"]
    Provisioning --> VoiceProvider
    Identity --> Context
    AssistantProfile["Assistant profile service"] --> Context
    Context --> Topics
    Context --> Permissions
    Context --> Contacts["Contacts and participants"]

    Items --> DB["Durable database<br/>Firestore MVP / PostgreSQL target"]
    Topics --> DB
    Decisions --> DB
    Permissions --> DB
    Events --> DB
    Notifications --> Android["Android app<br/>Compose UI"]
    Billing --> Android
    ClientAPI --> AndroidCache["Android Room cache<br/>source-of-display only"]
    Notifications --> AndroidCache
    AndroidCache --> Android
    Sharing --> External["External participants<br/>SMS/email/web links"]
```

The Android Room cache is intentionally client-side and non-authoritative. It stores last-known provider-neutral display snapshots so the app can render quickly and remain navigable when refreshes fail. Backend APIs remain authoritative for permissions, billing gates, transfer/live-answer actions, sharing, calendar writes, topic mutations, and all paid side effects.

## Pay-As-You-Go Billing Flow

```mermaid
sequenceDiagram
    participant App as Android app
    participant Billing as Billing service
    participant Stripe as Stripe
    participant Policy as Billing policy
    participant Voice as Voice provisioning/runtime
    participant Usage as Usage ledger
    participant Rating as Rating service

    App->>Billing: Create billing setup session
    Billing->>Stripe: Create customer + hosted card collection
    Stripe-->>App: Payment collection URL/session
    Stripe->>Billing: payment_method.attached webhook
    Billing->>Billing: Mirror payment method state
    App->>Billing: Set monthly spending cap
    Billing->>Policy: Mark user active if card + cap valid
    App->>Voice: Request assistant number
    Voice->>Policy: Check billing active + cap remaining
    Policy-->>Voice: Allowed
    Voice->>Usage: Record assistant_number_month
    Voice-->>App: Assistant number assigned
    Voice->>Usage: Record call minutes / AI processing
    Usage->>Rating: Rate usage with price + cost versions
    Rating->>Stripe: Publish metered usage events
    Stripe->>Billing: invoice/payment webhooks
    Billing-->>App: Usage, cap, invoice state
```

## Billing Domain Model

```mermaid
erDiagram
    USER ||--|| BILLING_ACCOUNT : owns
    BILLING_ACCOUNT ||--o{ PAYMENT_METHOD : has
    BILLING_ACCOUNT ||--o{ SPENDING_LIMIT : controls
    BILLING_ACCOUNT ||--o{ INVOICE_MIRROR : mirrors
    USER ||--o{ USAGE_EVENT : generates
    USAGE_EVENT ||--|| RATED_USAGE_EVENT : rates
    PRICE_PLAN ||--o{ BILLABLE_METER : defines
    COST_RATE_CARD ||--o{ RATED_USAGE_EVENT : estimates
    BILLING_ACCOUNT ||--o{ CREDIT_GRANT : receives
```

## Notification Product Flow

```mermaid
sequenceDiagram
    participant Domain as Domain service
    participant Notify as Notification service
    participant Store as NotificationEvent store
    participant Devices as PushDeviceToken store
    participant FCM as Firebase Cloud Messaging
    participant Policy as Privacy/preferences policy
    participant App as Android app
    participant User

    Domain->>Notify: User-impacting event(source object, type, urgency)
    Notify->>Policy: Resolve privacy, expiration, actions, quiet hours
    Policy-->>Notify: Safe payload + delivery decision
    Notify->>Store: Create durable NotificationEvent
    Notify->>Devices: Load active Android FCM tokens
    Notify->>FCM: Send data-only safe payload
    FCM-->>App: Push notification data
    App->>User: System notification with private-safe body
    App->>Store: Fetch fresh state on push, app launch, or notification open
    Store-->>App: Current safe notification events
    User->>App: Tap/action
    App->>Domain: Open target or perform action
    App->>Store: Mark read/dismissed
```

## Multi-User Onboarding And Retell Provisioning

```mermaid
sequenceDiagram
    participant App as Android app
    participant Firebase as Firebase Phone Auth
    participant Auth as Backend auth middleware
    participant Users as User config store
    participant Billing as Billing service
    participant Provision as Voice provisioning service
    participant Retell as Retell phone-number API
    participant Onboarding as Onboarding status

    App->>Firebase: Verify mobile number with real OTP
    Firebase-->>App: Firebase ID token
    App->>Auth: Client API request with bearer token
    Auth->>Firebase: Verify ID token and phone claim
    Auth->>Users: Get or create user config by Firebase uid
    Users-->>App: User config and onboarding state
    App->>Billing: Add card and set spending cap
    Billing-->>Users: billing_active
    App->>Provision: Request assistant number(area code optional)
    Provision->>Users: Check auth, verification, billing, existing assignment
    Provision->>Retell: Purchase/update number with inbound webhook
    Retell-->>Provision: phone number assignment
    Provision->>Users: Store Retell mapping
    App->>Onboarding: Fetch status
    Onboarding-->>App: next forwarding/test-call step
```

## Assistant Profile To Voice Provider

```mermaid
flowchart TD
    Profile["AssistantProfile<br/>name, tone, disclosure, policies"] --> Renderer["Voice context renderer"]
    CallContext["Caller + topic + notes + calendar context"] --> Renderer
    Policy["Permissions and red lines"] --> Renderer
    Renderer --> ProviderNeutral["Provider-neutral call context"]
    ProviderNeutral --> RetellAdapter["Retell adapter"]
    RetellAdapter --> Begin["begin_message"]
    RetellAdapter --> Dynamic["retell_llm_dynamic_variables"]
    RetellAdapter --> Metadata["metadata: user_id, profile_version"]
    ProviderNeutral --> FutureProvider["Future voice runtime adapter"]
```

## Inbound Forwarded Call Flow

```mermaid
sequenceDiagram
    participant Caller
    participant Carrier
    participant Retell
    participant Webhook as Voice webhook API
    participant Ingestion
    participant Context as Agent context service
    participant Topics as Topic service
    participant Agent as AI agent
    participant Interrupt as Interruption engine
    participant App as Android app

    Caller->>Carrier: Dial user's existing number
    Carrier->>Retell: Forward to AI-controlled number
    Retell->>Webhook: inbound call webhook
    Webhook->>Ingestion: Create phone_call CommunicationItem
    Context->>Topics: Find likely related topics
    Context-->>Retell: Caller + topic-safe dynamic context
    Agent->>Caller: Disclosure, identity, intent
    Agent->>Interrupt: Urgency + topic-aware routing check
    alt User should join live
        Interrupt->>App: Transfer approval or decision card
    else Agent can resolve
        Agent->>Caller: Take message / answer / schedule
    end
    Retell->>Webhook: call analyzed + transcript
    Webhook->>Ingestion: Update CommunicationItem
    Ingestion->>Topics: Suggest or attach topic
```

## Cross-Channel Ingestion Flow

```mermaid
flowchart TD
    ProviderEvent["Provider webhook or client action"] --> Adapter["Provider adapter"]
    Adapter --> Normalized["Normalized communication event"]
    Normalized --> RawRef["Store raw content reference"]
    Normalized --> Item["Create or update CommunicationItem"]
    Item --> Extract["Extract summary, facts, tasks, decisions, questions"]
    Extract --> Classify["Classify topic match"]
    Classify --> Existing{"Existing topic?"}
    Existing -- "high confidence" --> Attach["Attach to TopicThread"]
    Existing -- "low confidence" --> Suggest["Create attachment suggestion"]
    Existing -- "no" --> Candidate["Create candidate topic"]
    Attach --> Timeline["Update topic timeline"]
    Suggest --> Inbox["Show in Communication Inbox"]
    Candidate --> Inbox
```

## Topic Classification Sequence

```mermaid
sequenceDiagram
    participant Item as CommunicationItem
    participant Classifier
    participant Topics as TopicThread store
    participant Extractor
    participant Policy as Permission/policy
    participant Outbox

    Item->>Classifier: New or updated item
    Classifier->>Topics: Retrieve candidate threads by participants, recency, and indexed metadata
    Classifier->>Extractor: Extract facts, tasks, decisions, questions, conflicts
    Extractor-->>Classifier: Structured extraction with evidence
    Classifier->>Policy: Check sensitivity and auto-attach rules
    alt High confidence and allowed
        Classifier->>Topics: Attach item and update thread state
        Classifier->>Outbox: topic.communication_attached
    else Needs review
        Classifier->>Topics: Store topic suggestion
        Classifier->>Outbox: topic.suggested
    end
```

## User Interruption Engine

```mermaid
flowchart TD
    Item["New communication"] --> Context["Build context"]
    Context --> Caller["Caller/contact rules"]
    Context --> Topic["Topic status and permissions"]
    Context --> Urgency["Urgency and deadline"]
    Context --> Decisions["Pending decisions/open questions"]
    Context --> Conflicts["Conflicts or changed facts"]
    Caller --> Policy["Interruption policy"]
    Topic --> Policy
    Urgency --> Policy
    Decisions --> Policy
    Conflicts --> Policy
    Policy --> Action{"Action"}
    Action --> Silent["Silent record"]
    Action --> Notify["Notify"]
    Action --> Answer["Live answer request"]
    Action --> DecisionCard["Decision card"]
    Action --> Transfer["Warm transfer request"]
    Action --> Audit["Audit decision"]
```

## Permissioned Sharing Flow

```mermaid
sequenceDiagram
    participant User
    participant App
    participant Sharing
    participant Permissions
    participant Artifact
    participant External as External participant
    participant Audit

    User->>App: Share recap or decision request
    App->>Sharing: Create scoped artifact
    Sharing->>Permissions: Check thread, participant, channel, sensitivity
    alt Allowed
        Sharing->>Artifact: Create link/token with scope
        Sharing->>External: Send SMS/email/web link
        Sharing->>Audit: Record artifact and recipients
        External->>Sharing: Reply/update
        Sharing->>Permissions: Validate update scope
        Sharing->>Audit: Record external update
    else Blocked or requires approval
        Permissions-->>App: Explain required approval/block
        Permissions->>Audit: Record denial
    end
```

## Agent-To-Agent Sequence

```mermaid
sequenceDiagram
    participant ExternalAgent
    participant Gateway as Agent message gateway
    participant Permissions
    participant Topic as TopicThread
    participant User as User approval
    participant Audit

    ExternalAgent->>Gateway: Structured topic-scoped request
    Gateway->>Permissions: Verify identity, thread scope, intent
    alt Authorized
        Gateway->>Topic: Add agent message CommunicationItem
        Topic->>Topic: Extract requested decision/task/question
        alt Human approval required
            Topic->>User: Create decision request
            User-->>Gateway: Approve/decline
        end
        Gateway-->>ExternalAgent: Structured response
        Gateway->>Audit: Log request/response
    else Unauthorized
        Gateway-->>ExternalAgent: Denied
        Gateway->>Audit: Log denial
    end
```

## Data Model / Entity Relationship Diagram

```mermaid
erDiagram
    USER ||--o{ TOPIC_THREAD : owns
    USER ||--o{ COMMUNICATION_ITEM : owns
    USER ||--o{ CONTACT : owns
    USER ||--o{ PARTICIPANT : defines
    USER ||--o{ AUDIT_LOG : has

    TOPIC_THREAD ||--o{ TOPIC_PARTICIPANT : grants
    TOPIC_THREAD ||--o{ TOPIC_COMMUNICATION : contains
    TOPIC_THREAD ||--o{ DECISION : tracks
    TOPIC_THREAD ||--o{ OPEN_QUESTION : tracks
    TOPIC_THREAD ||--o{ TASK : tracks
    TOPIC_THREAD ||--o{ DOCUMENT_REFERENCE : references
    TOPIC_THREAD ||--o{ TOPIC_SHARE : shares
    TOPIC_THREAD ||--o{ AUDIT_LOG : audits

    COMMUNICATION_ITEM ||--o{ COMMUNICATION_PARTICIPANT : includes
    COMMUNICATION_ITEM ||--o{ TOPIC_COMMUNICATION : attaches
    COMMUNICATION_ITEM ||--o{ DECISION : evidences
    COMMUNICATION_ITEM ||--o{ OPEN_QUESTION : evidences
    COMMUNICATION_ITEM ||--o{ TASK : evidences
    COMMUNICATION_ITEM ||--o{ RAW_CONTENT_REF : stores

    PARTICIPANT ||--o{ TOPIC_PARTICIPANT : participates
    CONTACT ||--o| PARTICIPANT : may_map_to

    COMMUNICATION_ITEM ||--o| CALL_SESSION : may_represent
    CALL_SESSION ||--o{ CALL_EVENT : records
    CALL_SESSION ||--o{ TRANSCRIPT_SEGMENT : contains
```

## Topic Thread As Security Boundary

```mermaid
flowchart LR
    Contractor["Contractor"] --> BasementAccess["Basement Project<br/>participant"]
    BasementAccess --> Recap["Shared recap"]
    BasementAccess --> Decision["Change-order decision"]
    BasementAccess -. denied .-> Family["Family Medical thread"]
    BasementAccess -. denied .-> Work["Work Recruiting thread"]
    BasementAccess -. denied .-> Car["Car Lease thread"]
    Policy["Permission service"] --> BasementAccess
    Policy --> Audit["Audit log"]
```

## Provider Abstraction Model

```mermaid
classDiagram
    class CommunicationProvider {
        <<interface>>
        +normalizeEvent(raw)
        +verifyWebhook(raw, headers)
        +providerName
    }

    class VoiceProvider {
        <<interface>>
        +normalizeCallEvent(raw)
        +provideInboundContext(request)
        +bridgeToUser(callId, destination)
        +getCallDetail(providerCallId)
    }

    class RetellVoiceProvider {
        +normalizeCallEvent(raw)
        +provideInboundContext(request)
        +bridgeToUser(callId, destination)
    }

    class EmailProvider {
        <<interface>>
        +normalizeEmail(raw)
    }

    class SmsProvider {
        <<interface>>
        +normalizeMessage(raw)
    }

    class CalendarProvider {
        <<interface>>
        +normalizeCalendarEvent(raw)
        +checkFreeBusy(request)
    }

    class CommunicationItem {
        +channel
        +sourceProvider
        +providerItemId
        +summary
        +topicAssociations
    }

    CommunicationProvider <|-- VoiceProvider
    VoiceProvider <|.. RetellVoiceProvider
    CommunicationProvider <|-- EmailProvider
    CommunicationProvider <|-- SmsProvider
    CommunicationProvider <|-- CalendarProvider
    CommunicationProvider --> CommunicationItem
```
