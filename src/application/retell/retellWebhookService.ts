import type { CallRepository } from "../../domain/calls/callRepository.js";
import type { AgentContextPack, CallerMemoryRepository } from "../../domain/callers/callerMemory.js";
import type { CommunicationItem, CommunicationItemRepository } from "../../domain/communications/communicationItem.js";
import type { AssistantProfile, UserConfig } from "../../domain/users/userConfig.js";
import type { Contact, ContactRepository } from "../../domain/contacts/contact.js";
import type { AgentNoteService } from "../agentNotes/agentNoteService.js";
import type { BillingAccountService } from "../billing/billingAccountService.js";
import type { UsageService } from "../billing/usageService.js";
import type { NotificationService } from "../notifications/notificationService.js";
import type { TopicSuggestionService } from "../topics/topicSuggestionService.js";
import type { UserConfigService } from "../users/userConfigService.js";
import type { AppLogger } from "../../shared/logger.js";
import { HttpError, notFound } from "../../shared/httpErrors.js";
import { parseRetellCallEventWebhook, parseRetellInboundWebhook } from "../../infrastructure/retell/retellEventMapper.js";
import type { WebhookVerifier } from "../../infrastructure/retell/retellWebhookVerifier.js";
import type { WebhookEventRepository } from "../../domain/webhooks/webhookEvent.js";

export interface InboundDecision {
  call_inbound: {
    override_agent_id?: string;
    agent_override: {
      retell_llm: {
        begin_message: string;
      };
    };
    metadata: Record<string, unknown>;
    dynamic_variables: Record<string, string>;
  };
}

export class RetellWebhookService {
  private readonly memoryProcessedProviderCallIds = new Set<string>();

  constructor(
    private readonly dependencies: {
      calls: CallRepository;
      callerMemory: CallerMemoryRepository;
      contacts?: ContactRepository;
      communicationItems?: CommunicationItemRepository;
      topicSuggestions?: TopicSuggestionService;
      notifications?: NotificationService;
      users?: UserConfigService;
      billing?: BillingAccountService;
      usage?: UsageService;
      agentNotes?: AgentNoteService;
      webhookEvents?: WebhookEventRepository;
      verifier: WebhookVerifier;
      logger: AppLogger;
      defaultAgentId?: string;
    }
  ) {}

  async handleInbound(rawBody: string, signature: string | string[] | undefined): Promise<InboundDecision> {
    await this.dependencies.verifier.verify(rawBody, signature);

    const payload = parseRetellInboundWebhook(rawBody);
    const inbound = payload.call_inbound;
    const userConfig = await this.resolveUserByRetellNumber(inbound.to_number);
    try {
      await this.dependencies.billing?.assertPaidRuntimeAllowed(userConfig.userId);
    } catch (error) {
      if (isBillingBlock(error)) {
        this.dependencies.logger.warn(
          {
            fromNumber: inbound.from_number,
            toNumber: inbound.to_number,
            userId: userConfig.userId,
            code: error.code
          },
          "retell inbound call degraded because billing blocked live assistant runtime"
        );
        return billingUnavailableDecision(
          userConfig,
          inbound.from_number,
          inbound.to_number,
          this.dependencies.defaultAgentId
        );
      }
      throw error;
    }
    const contextPack = await this.resolveCallerContext(userConfig.userId, inbound.from_number);
    const activeAgentNotes = await this.dependencies.agentNotes?.activeContextForCaller(userConfig.userId, inbound.from_number) ?? "";

    this.dependencies.logger.info(
      {
        fromNumber: inbound.from_number,
        toNumber: inbound.to_number,
        userId: userConfig.userId,
        configuredAgentId: inbound.agent_id,
        knownCaller: contextPack.knownCaller,
        relationship: contextPack.relationship
      },
      "retell inbound call decision requested"
    );

    const openingLine = buildOpeningLine(contextPack, userConfig);
    const now = new Date();
    const dateContext = buildDateContext(now);
    const dynamicVariables = {
      caller_number: inbound.from_number,
      forwarding_number: inbound.to_number,
      phone_agent_user_id: userConfig.userId,
      user_display_name: userConfig.displayName,
      assistant_name: userConfig.assistantProfile.assistantName,
      assistant_greeting_style: userConfig.assistantProfile.greetingStyle,
      assistant_disclosure_style: userConfig.assistantProfile.disclosureStyle,
      assistant_warmth: String(userConfig.assistantProfile.warmth),
      assistant_brevity: String(userConfig.assistantProfile.brevity),
      assistant_proactivity: String(userConfig.assistantProfile.proactivity),
      user_transfer_phone_number: userConfig.phoneRouting.transferPhoneNumber ?? "",
      product_name: "Phone Agent",
      ai_disclosure: "I am an AI assistant answering on behalf of this person.",
      current_date: dateContext.currentDate,
      current_time: dateContext.currentTime,
      current_datetime: dateContext.currentDateTime,
      current_timezone: dateContext.currentTimezone,
      user_timezone: dateContext.currentTimezone,
      opening_line: openingLine,
      caller_context: formatContextPack(contextPack, activeAgentNotes),
      active_agent_notes: activeAgentNotes,
      caller_known: String(contextPack.knownCaller),
      caller_identity_source: contextPack.identitySource,
      caller_name: contextPack.callerName ?? "",
      caller_relationship: contextPack.relationship,
      caller_trust_level: contextPack.trustLevel,
      routing_policy: contextPack.routingGuidance,
      tone_guidance: contextPack.suggestedTone,
      agent_behavior_contract: buildAgentBehaviorContract(userConfig.assistantProfile),
      conversation_style: buildConversationStyle(contextPack, userConfig.assistantProfile),
      disclosure_policy: buildDisclosurePolicy(userConfig),
      privacy_policy: "Use caller memory only to be helpful and natural. Do not reveal private facts, notes, calendars, or topic context unless the caller is allowed to receive that information.",
      emergency_policy: "If the caller describes an emergency or immediate danger, tell them to call emergency services directly. Then request live attention if possible.",
      tool_policy: buildToolPolicy(userConfig.assistantProfile),
      outcome_policy: "Every meaningful call should end with a clear outcome: message captured, user notified, answer requested, transfer requested, calendar action completed, or follow-up summarized.",
      memory_red_lines: contextPack.redLines.join(" ")
    };

    return {
      call_inbound: {
        override_agent_id: userConfig.phoneRouting.voiceAgentId ?? this.dependencies.defaultAgentId,
        agent_override: {
          retell_llm: {
            begin_message: openingLine
          }
        },
        metadata: {
          phone_agent_managed: true,
          user_id: userConfig.userId,
          forwarded_to_number: inbound.to_number
        },
        dynamic_variables: dynamicVariables
      }
    };
  }

  async handleCallEvent(rawBody: string, signature: string | string[] | undefined): Promise<void> {
    await this.dependencies.verifier.verify(rawBody, signature);

    const normalized = parseRetellCallEventWebhook(rawBody);
    const providerEventId = retellEventId(normalized.providerCallId, normalized.eventType);
    const claim = await this.dependencies.webhookEvents?.startProcessing({
      provider: "retell",
      eventId: providerEventId,
      eventType: normalized.eventType
    });
    if (claim && !claim.shouldProcess) {
      this.dependencies.logger.info(
        {
          providerCallId: normalized.providerCallId,
          eventType: normalized.eventType
        },
        "duplicate retell call event ignored"
      );
      return;
    }

    try {
    const session = await this.dependencies.calls.upsertFromProvider(normalized.upsert);
    const userConfig = await this.resolveUserByRetellNumber(session.toNumber);
    const communicationItem = await this.upsertCommunicationItem(session, userConfig.userId);
    if (communicationItem && normalized.eventType === "call_analyzed") {
      await this.dependencies.topicSuggestions?.analyzeCommunication(communicationItem);
      await this.dependencies.notifications?.createCallSummary({
        userId: userConfig.userId,
        communicationItemId: communicationItem.id,
        callerName: communicationItem.sender?.displayName
      });
    }

    if (normalized.eventType === "call_started" || normalized.eventType === "call_ended") {
      await this.dependencies.notifications?.createLiveCallState({
        userId: userConfig.userId,
        providerCallId: normalized.providerCallId,
        callerNumber: session.direction === "outbound" ? session.toNumber : session.fromNumber,
        callerName: getCallerName(session.summary?.structuredData) ?? getDynamicVariable(session, "caller_name"),
        state: normalized.eventType === "call_started" ? "started" : "ended"
      });
    }

    if (normalized.eventType === "call_analyzed" && !this.memoryProcessedProviderCallIds.has(normalized.providerCallId)) {
      this.memoryProcessedProviderCallIds.add(normalized.providerCallId);
      const contact = await this.dependencies.contacts?.findByPhoneNumber(userConfig.userId, session.fromNumber);
      await this.dependencies.callerMemory.upsertFromCall(extractMemoryInput(session, userConfig.userId, contact));
    }

    if (normalized.eventType === "call_analyzed") {
      await this.dependencies.usage?.recordCallMinutes({
        userId: userConfig.userId,
        minutes: estimateCallMinutes(session),
        sourceId: session.id,
        provider: session.provider
      });
    }

    await this.dependencies.calls.addEvent({
      callSessionId: session.id,
      type: normalized.eventType,
      provider: "retell",
      providerCallId: normalized.providerCallId,
      occurredAt: new Date(),
      payload: normalized.rawPayload
    });

    this.dependencies.logger.info(
      {
        callSessionId: session.id,
        providerCallId: normalized.providerCallId,
        eventType: normalized.eventType,
        status: session.status
      },
      "retell call event handled"
    );
      await this.dependencies.webhookEvents?.markProcessed("retell", providerEventId);
    } catch (error) {
      await this.dependencies.webhookEvents?.markFailed("retell", providerEventId, sanitizedWebhookError(error));
      throw error;
    }
  }

  private async resolveUserByRetellNumber(phoneNumber: string) {
    const byNumber = await this.dependencies.users?.getByAssistantPhoneNumber(phoneNumber);
    if (byNumber) {
      return byNumber;
    }
    throw notFound("phone_route_not_found", "No Phone Agent user is assigned to this forwarding number.");
  }

  private async resolveCallerContext(userId: string, phoneNumber: string): Promise<AgentContextPack> {
    const memoryContext = await this.dependencies.callerMemory.buildContextPack(userId, phoneNumber);
    const contact = await this.dependencies.contacts?.findByPhoneNumber(userId, phoneNumber);
    if (!contact) {
      return memoryContext;
    }

    if (memoryContext.knownCaller) {
      return {
        ...memoryContext,
        contactId: contact.id,
        identitySource: "contact",
        callerName: contact.displayName,
        redLines: [
          ...memoryContext.redLines,
          "Use the synced contact display name as the caller name for this phone number."
        ]
      };
    }

    return contextPackFromContact(contact);
  }

  private async upsertCommunicationItem(
    session: Awaited<ReturnType<CallRepository["upsertFromProvider"]>>,
    userId: string
  ): Promise<CommunicationItem | undefined> {
    if (!this.dependencies.communicationItems || !session.providerCallId) {
      return;
    }

    const contact = session.direction === "outbound"
      ? undefined
      : await this.dependencies.contacts?.findByPhoneNumber(userId, session.fromNumber);
    const displayName = contact?.displayName ?? getCallerName(session.summary?.structuredData);

    return this.dependencies.communicationItems.upsertFromProvider({
      userId,
      channel: "phone_call",
      direction: session.direction === "outbound" ? "outbound" : "inbound",
      sourceProvider: session.provider,
      providerItemId: session.providerCallId,
      sender: {
        phoneNumber: session.fromNumber,
        displayName
      },
      recipients: [{ phoneNumber: session.toNumber }],
      participants: [
        { phoneNumber: session.fromNumber, displayName },
        { phoneNumber: session.toNumber }
      ],
      occurredAt: session.startedAt ?? session.createdAt,
      receivedAt: session.createdAt,
      transcriptText: session.transcript,
      summary: session.summary?.text,
      sensitivity: "unknown",
      consentRequired: false
    });
  }
}

function retellEventId(providerCallId: string, eventType: string): string {
  return `${providerCallId}:${eventType}`;
}

function sanitizedWebhookError(error: unknown) {
  const candidate = error as { code?: unknown; statusCode?: unknown; message?: unknown };
  const code = typeof candidate?.code === "string"
    ? candidate.code
    : typeof candidate?.statusCode === "number"
      ? `status_${candidate.statusCode}`
      : "retell_webhook_processing_failed";
  const message = typeof candidate?.message === "string" && candidate.message.length > 0
    ? candidate.message.slice(0, 500)
    : "Retell webhook processing failed.";
  return { code, message };
}

function estimateCallMinutes(session: Awaited<ReturnType<CallRepository["upsertFromProvider"]>>): number {
  const start = session.startedAt?.getTime();
  const end = session.endedAt?.getTime();
  if (!start || !end || end <= start) {
    return 1;
  }
  return Math.max(1, Math.ceil((end - start) / 60_000));
}

function isBillingBlock(error: unknown): error is HttpError {
  return error instanceof HttpError && (error.code === "billing_payment_required" || error.code === "billing_cap_reached");
}

function billingUnavailableDecision(
  user: UserConfig,
  callerNumber: string,
  forwardingNumber: string,
  defaultAgentId?: string
): InboundDecision {
  const owner = user.displayName || "this person";
  const assistant = user.assistantProfile.assistantName || "Assistant";
  const openingLine = `${owner}'s assistant is currently unavailable. Please try again later.`;
  return {
    call_inbound: {
      override_agent_id: user.phoneRouting.voiceAgentId ?? defaultAgentId,
      agent_override: {
        retell_llm: {
          begin_message: openingLine
        }
      },
      metadata: {
        phone_agent_managed: true,
        user_id: user.userId,
        forwarded_to_number: forwardingNumber,
        billing_blocked: true
      },
      dynamic_variables: {
        caller_number: callerNumber,
        forwarding_number: forwardingNumber,
        phone_agent_user_id: user.userId,
        user_display_name: owner,
        assistant_name: assistant,
        product_name: "Phone Agent",
        paid_runtime_allowed: "false",
        opening_line: openingLine,
        caller_known: "false",
        caller_context: "",
        active_agent_notes: "",
        privacy_policy: "Do not disclose or use caller memory, topic context, calendar context, user notes, or private user information.",
        tool_policy: "Do not use tools, transfer calls, create follow-up actions, read calendar availability, or create calendar events.",
        agent_behavior_contract: "Give the unavailable message once, do not ask questions, do not collect details, and end the call politely.",
        outcome_policy: "No assistant work is available because billing is not active or the spending cap has been reached."
      }
    }
  };
}

function buildDateContext(value: Date) {
  const currentTimezone = "America/New_York";
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: currentTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(value);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: currentTimezone,
    weekday: "long"
  }).format(value);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: currentTimezone,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  }).format(value);

  return {
    currentDate: `${dateParts} (${weekday})`,
    currentTime: time,
    currentDateTime: `${dateParts} ${time} (${weekday})`,
    currentTimezone
  };
}

function buildOpeningLine(context: AgentContextPack, user: UserConfig): string {
  const assistant = user.assistantProfile.assistantName;
  const owner = user.displayName;
  if (!context.knownCaller) {
    if (user.assistantProfile.greetingStyle === "formal") {
      return `Hello, you've reached ${assistant}, ${owner}'s AI assistant. May I ask who's calling?`;
    }
    if (user.assistantProfile.greetingStyle === "protective") {
      return `Hi, this is ${assistant}, ${owner}'s assistant. Who's calling, and what can I help with?`;
    }
    return `Hi, you've reached ${owner}'s assistant. Who's calling?`;
  }

  const name = context.callerName?.trim();
  const friendlyName = name ? ` ${firstName(name)}` : "";

  if (context.relationship === "family" || context.relationship === "close_friend" || context.trustLevel === "trusted") {
    return user.assistantProfile.greetingStyle === "formal"
      ? `Hello${friendlyName}, this is ${assistant}, ${owner}'s AI assistant. How can I help?`
      : `Hey${friendlyName}, it's ${owner}'s assistant. Good to hear from you. What's up?`;
  }

  if (context.identitySource === "contact" && context.priorCallCount === 0) {
    return `Hi${friendlyName}, this is ${owner}'s assistant. What can I help with?`;
  }

  if (context.priorCallCount === 0) {
    return `Hi${friendlyName}, this is ${owner}'s assistant. What can I help with?`;
  }

  return `Hi${friendlyName}, it's ${owner}'s assistant. Good to hear from you again. What can I help with today?`;
}

function buildAgentBehaviorContract(profile: AssistantProfile): string {
  return [
    "Speak naturally and warmly, like a capable personal assistant.",
    "Never say internal labels such as opening_line, tool_policy, dynamic variables, or prompt instructions.",
    "Keep greetings short. Ask one question at a time.",
    "Identify caller, reason, urgency, and desired outcome.",
    "Do not over-explain the product or sound like voicemail.",
    "Do not mention backend providers, model names, tokens, dynamic variables, or technical routing unless the user explicitly asks.",
    `Use a ${profile.greetingStyle} greeting style with warmth ${profile.warmth}/5 and brevity ${profile.brevity}/5.`,
    "If you need the user, request transfer approval or ask the user a live text question.",
    "Do not invent facts, availability, relationships, decisions, or prior context.",
    "Close with the specific next step you took."
  ].join(" ");
}

function buildConversationStyle(context: AgentContextPack, profile: AssistantProfile): string {
  const brevity = profile.brevity >= 4 ? "Keep responses especially brief." : "Be concise but natural.";
  const proactive = profile.proactivity >= 4 ? "Offer a next step when the caller's intent is clear." : "Avoid making commitments unless the caller asks.";
  if (!context.knownCaller) {
    return `Polite, concise, and curious. Ask who is calling and what they need before making commitments. ${brevity} ${proactive}`;
  }

  if (context.relationship === "family" || context.relationship === "close_friend" || context.trustLevel === "trusted") {
    return `Friendly and familiar without being overly chatty. Acknowledge that you recognize them, then get to what they need. ${brevity}`;
  }

  return `Professional, friendly, and efficient. Acknowledge that you have spoken before when useful. ${brevity}`;
}

function buildDisclosurePolicy(user: UserConfig): string {
  if (user.assistantProfile.disclosureStyle === "explicit") {
    return `Say early that you are ${user.assistantProfile.assistantName}, an AI assistant answering on behalf of ${user.displayName}. Do not pretend to be human.`;
  }
  return `Say early that you are an AI assistant answering on behalf of ${user.displayName}. Do not pretend to be human.`;
}

function buildToolPolicy(profile: AssistantProfile): string {
  const transfer = profile.transferPolicy === "never_transfer"
    ? "Do not request live transfer; take a message or request a text answer instead."
    : profile.transferPolicy === "trusted_can_transfer"
      ? "Request live transfer approval for important calls; trusted callers may be prioritized."
      : "Request live transfer approval before trying to reach the user live.";
  const calendar = profile.calendarPolicy === "disabled"
    ? "Do not check or create calendar events."
    : profile.calendarPolicy === "free_busy_only"
      ? "You may check free/busy if available, but do not create calendar events."
      : "You may check free/busy and create calendar events when policy allows; only update events the assistant previously created.";
  return `Use tools only for their intended purpose. ${transfer} Request a user answer when a caller needs a fact you do not know. ${calendar}`;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name.trim();
}

function formatContextPack(context: AgentContextPack, activeAgentNotes = ""): string {
  if (!context.knownCaller) {
    const parts = [
      "Caller is not recognized yet.",
      context.routingGuidance,
      "Ask for name, organization if relevant, reason for calling, and urgency."
    ];
    if (activeAgentNotes.length > 0) {
      parts.push(`Active user notes: ${activeAgentNotes}`);
    }
    return parts.join(" ");
  }

  const parts = [
    `Known caller: ${context.callerName || "name unknown"}.`,
    `Identity source: ${context.identitySource}.`,
    `Relationship: ${context.relationship}.`,
    `Trust level: ${context.trustLevel}.`,
    `Prior calls: ${context.priorCallCount}.`
  ];

  if (context.organization) {
    parts.push(`Organization: ${context.organization}.`);
  }

  if (context.lastCallSummary) {
    parts.push(`Last call summary: ${context.lastCallSummary}`);
  }

  if (context.lastIntent) {
    parts.push(`Last known intent: ${context.lastIntent}.`);
  }

  if (context.approvedFacts.length > 0) {
    parts.push(`Approved facts: ${context.approvedFacts.join(" | ")}.`);
  }

  if (context.openFollowUps.length > 0) {
    parts.push(`Open follow-ups: ${context.openFollowUps.join(" | ")}.`);
  }

  if (activeAgentNotes.length > 0) {
    parts.push(`Active user notes: ${activeAgentNotes}`);
  }

  parts.push(`Tone: ${context.suggestedTone}`);
  parts.push(`Routing: ${context.routingGuidance}`);
  parts.push(`Limits: ${context.redLines.join(" ")}`);
  return parts.join(" ");
}

function contextPackFromContact(contact: Contact): AgentContextPack {
  return {
    contactId: contact.id,
    identitySource: "contact",
    knownCaller: true,
    callerName: contact.displayName,
    relationship: "unknown",
    trustLevel: "standard",
    priorCallCount: 0,
    approvedFacts: [],
    openFollowUps: [],
    suggestedTone: "Friendly, concise, and respectful. Recognize the caller by contact name but do not imply prior assistant history.",
    routingGuidance: "This caller is in the user's contacts but has no assistant call history yet. Confirm intent and urgency before escalating.",
    redLines: [
      "Do not claim to remember prior calls with this caller.",
      "Do not reveal private user information.",
      "If the contact name seems wrong, ask a clarifying question."
    ]
  };
}

function extractMemoryInput(
  session: Awaited<ReturnType<CallRepository["upsertFromProvider"]>>,
  userId: string,
  contact?: Contact
) {
  const structured = session.summary?.structuredData;
  const custom = getRecord(structured?.custom_analysis_data);
  const callerName = getString(custom, "caller_name");
  const organization = getString(custom, "caller_organization");
  const intent = getString(custom, "caller_intent");
  const followUp = getString(custom, "requested_follow_up");
  const callbackNumber = getString(custom, "callback_number");
  const urgency = getString(custom, "urgency");
  const displayNameSource = contact ? "contact" as const : callerName ? "analysis" as const : undefined;
  const facts: string[] = [];

  if (organization) {
    facts.push(`Caller organization is ${organization}.`);
  }
  if (callbackNumber) {
    facts.push(`Preferred callback number is ${callbackNumber}.`);
  }
  if (intent) {
    facts.push(`Recent reason for calling: ${intent}.`);
  }
  if (urgency) {
    facts.push(`Last observed urgency was ${urgency}.`);
  }

  return {
    userId,
    phoneNumber: session.fromNumber,
    displayName: contact?.displayName ?? callerName,
    displayNameSource,
    organization,
    lastIntent: intent,
    lastCallSummary: session.summary?.text,
    lastCallAt: session.endedAt ?? session.startedAt,
    sourceCallId: session.id,
    facts,
    openFollowUps: followUp ? [followUp] : []
  };
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;
}

function getString(record: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function getCallerName(structuredData: Record<string, unknown> | undefined): string | undefined {
  return getString(getRecord(structuredData?.custom_analysis_data), "caller_name");
}

function getDynamicVariable(session: Awaited<ReturnType<CallRepository["upsertFromProvider"]>>, key: string): string | undefined {
  return getString(getRecord(session.metadata.retell_dynamic_variables), key);
}
