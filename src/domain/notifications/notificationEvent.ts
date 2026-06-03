import { randomUUID } from "node:crypto";

export type NotificationType =
  | "live_transfer_request"
  | "live_answer_request"
  | "live_call_state"
  | "call_summary"
  | "topic_suggestion"
  | "decision_pending"
  | "calendar_change"
  | "billing_issue"
  | "setup_issue"
  | "provider_issue"
  | "privacy_review";

export type NotificationPriority = "low" | "normal" | "high" | "urgent";
export type NotificationPrivacy = "private" | "summary" | "detailed";
export type NotificationStatus = "unread" | "read" | "dismissed" | "expired";

export interface NotificationAction {
  id: string;
  label: string;
  target: string;
}

export interface NotificationEvent {
  id: string;
  userId: string;
  type: NotificationType;
  priority: NotificationPriority;
  privacy: NotificationPrivacy;
  title: string;
  body: string;
  detailedBody?: string;
  target: string;
  sourceType?: string;
  sourceId?: string;
  actions: NotificationAction[];
  status: NotificationStatus;
  expiresAt?: Date;
  createdAt: Date;
  readAt?: Date;
  dismissedAt?: Date;
}

export interface CreateNotificationEventInput {
  userId: string;
  type: NotificationType;
  priority?: NotificationPriority;
  privacy?: NotificationPrivacy;
  title: string;
  body: string;
  detailedBody?: string;
  target: string;
  sourceType?: string;
  sourceId?: string;
  actions?: NotificationAction[];
  expiresAt?: Date;
}

export interface NotificationEventRepository {
  create(input: CreateNotificationEventInput): Promise<NotificationEvent>;
  listForUser(userId: string, limit?: number): Promise<NotificationEvent[]>;
  listUnreadForUser(userId: string, limit?: number): Promise<NotificationEvent[]>;
  markRead(id: string, userId: string): Promise<NotificationEvent | undefined>;
  dismiss(id: string, userId: string): Promise<NotificationEvent | undefined>;
  dismissBySource(userId: string, sourceType: string, sourceId: string): Promise<number>;
  expireDue(now?: Date): Promise<number>;
}

export function createNotificationEvent(input: CreateNotificationEventInput, now = new Date()): NotificationEvent {
  return {
    id: `notification_${randomUUID()}`,
    userId: input.userId,
    type: input.type,
    priority: input.priority ?? "normal",
    privacy: input.privacy ?? "private",
    title: input.title,
    body: input.body,
    detailedBody: input.detailedBody,
    target: input.target,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    actions: input.actions ?? [],
    status: "unread",
    expiresAt: input.expiresAt,
    createdAt: now
  };
}

export function safeNotificationBody(event: NotificationEvent): string {
  if (event.privacy === "private") {
    return event.body;
  }
  return event.detailedBody ?? event.body;
}
