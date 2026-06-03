import { randomUUID } from "node:crypto";

export type NotificationActionSurface = "notification_action" | "app_screen" | "api";
export type NotificationActionResult = "accepted" | "declined" | "answered" | "expired" | "failed";

export interface NotificationActionAudit {
  id: string;
  userId: string;
  sourceType: string;
  sourceId: string;
  action: string;
  surface: NotificationActionSurface;
  result: NotificationActionResult;
  latencyMs?: number;
  errorCode?: string;
  createdAt: Date;
}

export interface CreateNotificationActionAuditInput {
  userId: string;
  sourceType: string;
  sourceId: string;
  action: string;
  surface?: NotificationActionSurface;
  result: NotificationActionResult;
  latencyMs?: number;
  errorCode?: string;
}

export interface NotificationActionAuditRepository {
  create(input: CreateNotificationActionAuditInput): Promise<NotificationActionAudit>;
  listForUser(userId: string, limit?: number): Promise<NotificationActionAudit[]>;
}

export function createNotificationActionAudit(
  input: CreateNotificationActionAuditInput,
  now = new Date()
): NotificationActionAudit {
  return {
    id: `notification_action_${randomUUID()}`,
    userId: input.userId,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    action: input.action,
    surface: input.surface ?? "api",
    result: input.result,
    latencyMs: input.latencyMs,
    errorCode: input.errorCode,
    createdAt: now
  };
}
