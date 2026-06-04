import type {
  CreateNotificationEventInput,
  NotificationEvent,
  NotificationEventRepository
} from "../../domain/notifications/notificationEvent.js";
import { safeNotificationBody } from "../../domain/notifications/notificationEvent.js";
import type { PushDeviceTokenRepository } from "../../domain/notifications/pushDeviceToken.js";
import type {
  CreateNotificationActionAuditInput,
  NotificationActionAudit,
  NotificationActionAuditRepository
} from "../../domain/notifications/notificationActionAudit.js";
import type { NotificationDeliveryRepository } from "../../domain/notifications/notificationDelivery.js";
import type { AppLogger } from "../../shared/logger.js";
import type { PushDeliveryClient } from "./pushDeliveryClient.js";

export class NotificationService {
  constructor(
    private readonly dependencies: {
      notifications: NotificationEventRepository;
      pushDeviceTokens?: PushDeviceTokenRepository;
      actionAudits?: NotificationActionAuditRepository;
      deliveries?: NotificationDeliveryRepository;
      pushDelivery?: PushDeliveryClient;
      logger?: AppLogger;
    }
  ) {}

  list(userId: string, unreadOnly = false): Promise<NotificationEvent[]> {
    return unreadOnly
      ? this.dependencies.notifications.listUnreadForUser(userId)
      : this.dependencies.notifications.listForUser(userId);
  }

  markRead(id: string, userId: string): Promise<NotificationEvent | undefined> {
    return this.dependencies.notifications.markRead(id, userId);
  }

  dismiss(id: string, userId: string): Promise<NotificationEvent | undefined> {
    return this.dependencies.notifications.dismiss(id, userId);
  }

  dismissBySource(userId: string, sourceType: string, sourceId: string): Promise<number> {
    return this.dependencies.notifications.dismissBySource(userId, sourceType, sourceId);
  }

  recordAction(input: CreateNotificationActionAuditInput): Promise<NotificationActionAudit | undefined> {
    return this.dependencies.actionAudits?.create(input) ?? Promise.resolve(undefined);
  }

  listActionAudits(userId: string): Promise<NotificationActionAudit[]> {
    return this.dependencies.actionAudits?.listForUser(userId) ?? Promise.resolve([]);
  }

  listDeliveries(userId: string) {
    return this.dependencies.deliveries?.listForUser(userId) ?? Promise.resolve([]);
  }

  async create(input: CreateNotificationEventInput): Promise<NotificationEvent> {
    const event = await this.dependencies.notifications.create({
      ...input,
      privacy: input.privacy ?? "private"
    });
    await this.deliverPush(event);
    return event;
  }

  createTransferRequest(input: {
    userId?: string;
    approvalRequestId: string;
    callerName?: string;
    callerNumber?: string;
    reason: string;
    urgency: "unknown" | "low" | "normal" | "high" | "emergency";
    expiresAt: Date;
  }) {
    if (!input.userId) {
      return undefined;
    }
    return this.create({
      userId: input.userId,
      type: "live_transfer_request",
      priority: input.urgency === "emergency" || input.urgency === "high" ? "urgent" : "high",
      privacy: "private",
      title: "Assistant wants to transfer a call",
      body: "A caller needs live attention.",
      detailedBody: `${input.callerName || input.callerNumber || "Caller"}: ${input.reason}`,
      target: `assistant/approvals/${input.approvalRequestId}`,
      sourceType: "approval_request",
      sourceId: input.approvalRequestId,
      expiresAt: input.expiresAt,
      actions: [
        { id: "accept", label: "Accept", target: `approval_requests/${input.approvalRequestId}/accept` },
        { id: "decline", label: "Decline", target: `approval_requests/${input.approvalRequestId}/decline` }
      ]
    });
  }

  createLiveAnswerRequest(input: {
    userId?: string;
    answerRequestId: string;
    callerName?: string;
    callerNumber?: string;
    question: string;
    urgency: "unknown" | "low" | "normal" | "high" | "emergency";
    expiresAt: Date;
  }) {
    if (!input.userId) {
      return undefined;
    }
    return this.create({
      userId: input.userId,
      type: "live_answer_request",
      priority: input.urgency === "emergency" || input.urgency === "high" ? "urgent" : "high",
      privacy: "private",
      title: "Assistant needs your answer",
      body: "The assistant needs a quick reply.",
      detailedBody: `${input.callerName || input.callerNumber || "Caller"} asked: ${input.question}`,
      target: `assistant/answers/${input.answerRequestId}`,
      sourceType: "answer_request",
      sourceId: input.answerRequestId,
      expiresAt: input.expiresAt,
      actions: [
        { id: "open", label: "Reply", target: `answer_requests/${input.answerRequestId}` }
      ]
    });
  }

  createLiveCallState(input: {
    userId?: string;
    providerCallId?: string;
    callerName?: string;
    callerNumber?: string;
    state: "started" | "ended";
  }) {
    if (!input.userId) {
      return undefined;
    }
    const started = input.state === "started";
    const caller = input.callerName || input.callerNumber || "a caller";
    return this.create({
      userId: input.userId,
      type: "live_call_state",
      priority: started ? "high" : "low",
      privacy: "private",
      title: started ? "Assistant is on a call" : "Assistant call ended",
      body: started ? "The assistant is handling a call." : "The assistant call state changed.",
      detailedBody: started ? `Assistant is on a call with ${caller}.` : `Assistant finished a call with ${caller}.`,
      target: "assistant",
      sourceType: "provider_call",
      sourceId: input.providerCallId,
      actions: [{ id: "open", label: "Open", target: "assistant" }]
    });
  }

  createCalendarChange(input: {
    userId?: string;
    calendarEventRequestId: string;
    status: string;
    title: string;
  }) {
    if (!input.userId) {
      return undefined;
    }
    return this.create({
      userId: input.userId,
      type: "calendar_change",
      priority: input.status === "failed" ? "high" : "normal",
      privacy: "private",
      title: input.status === "failed" ? "Calendar action failed" : "Calendar changed",
      body: input.status === "failed" ? "The assistant could not complete a calendar action." : "The assistant changed your calendar.",
      detailedBody: `${input.title} / ${input.status}`,
      target: `assistant/calendar/${input.calendarEventRequestId}`,
      sourceType: "calendar_event_request",
      sourceId: input.calendarEventRequestId,
      actions: [{ id: "open", label: "View", target: `calendar_event_requests/${input.calendarEventRequestId}` }]
    });
  }

  createCallSummary(input: {
    userId: string;
    communicationItemId: string;
    callerName?: string;
  }) {
    return this.create({
      userId: input.userId,
      type: "call_summary",
      priority: "normal",
      privacy: "private",
      title: "Call summary ready",
      body: "The assistant summarized a call.",
      detailedBody: input.callerName ? `Call with ${input.callerName} summarized.` : "Call summarized.",
      target: `inbox/communications/${input.communicationItemId}`,
      sourceType: "communication_item",
      sourceId: input.communicationItemId,
      actions: [{ id: "open", label: "View", target: `communications/${input.communicationItemId}` }]
    });
  }

  createTopicSuggestion(input: {
    userId: string;
    suggestionId: string;
    confidence: number;
  }) {
    return this.create({
      userId: input.userId,
      type: "topic_suggestion",
      priority: input.confidence >= 0.85 ? "normal" : "low",
      privacy: "private",
      title: "Topic suggestion ready",
      body: "The assistant found a communication that may belong to a topic.",
      detailedBody: `Topic suggestion confidence ${Math.round(input.confidence * 100)}%.`,
      target: `inbox/topic-suggestions/${input.suggestionId}`,
      sourceType: "topic_suggestion",
      sourceId: input.suggestionId,
      actions: [{ id: "review", label: "Review", target: `topic_suggestions/${input.suggestionId}` }]
    });
  }

  async createBillingIssue(input: {
    userId: string;
    code: string;
    title: string;
    body: string;
  }) {
    const unread = await this.list(input.userId, true);
    const existing = unread.find((event) => event.type === "billing_issue" && event.sourceId === input.code);
    if (existing) {
      return existing;
    }

    return this.create({
      userId: input.userId,
      type: "billing_issue",
      priority: input.code === "billing_cap_reached" ? "high" : "normal",
      privacy: "private",
      title: input.title,
      body: input.body,
      target: "billing",
      sourceType: "billing_account",
      sourceId: input.code,
      actions: [{ id: "open", label: "Review billing", target: "billing" }]
    });
  }

  async registerPushDeviceToken(input: {
    userId: string;
    token: string;
    platform: "android";
    deviceId?: string;
    appVersion?: string;
  }) {
    return this.dependencies.pushDeviceTokens?.upsert(input);
  }

  private async deliverPush(event: NotificationEvent): Promise<void> {
    if (!this.dependencies.pushDeviceTokens || !this.dependencies.pushDelivery) {
      return;
    }
    const devices = await this.dependencies.pushDeviceTokens.listActiveForUser(event.userId);
    await Promise.all(devices.map(async (device) => {
      const startedAt = Date.now();
      const result = await this.dependencies.pushDelivery?.send({
        token: device.token,
        notificationId: event.id,
        type: event.type,
        priority: event.priority,
        title: event.title,
        body: safeNotificationBody({ ...event, privacy: "private" }),
        target: event.target
      });
      if (!result) {
        return;
      }
      await this.dependencies.deliveries?.create({
        userId: event.userId,
        notificationId: event.id,
        pushDeviceTokenId: device.id,
        platform: device.platform,
        provider: "fcm",
        status: result.status,
        latencyMs: Date.now() - startedAt,
        errorCode: result.errorCode,
        disableToken: result.disableToken
      });
      if (result.status === "sent") {
        await this.dependencies.pushDeviceTokens?.markDelivery(device.id, "sent");
        return;
      }
      await this.dependencies.pushDeviceTokens?.markDelivery(device.id, "failed", result.errorCode);
      if (result.disableToken) {
        await this.dependencies.pushDeviceTokens?.disable(device.id, result.errorCode);
      }
      this.dependencies.logger?.warn(
        {
          userId: event.userId,
          notificationId: event.id,
          platform: device.platform,
          errorCode: result.errorCode
        },
        "push notification delivery failed"
      );
    }));
  }
}
