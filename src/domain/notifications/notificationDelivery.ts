import { randomUUID } from "node:crypto";

export type NotificationDeliveryPlatform = "android";
export type NotificationDeliveryProvider = "fcm";
export type NotificationDeliveryStatus = "sent" | "failed";

export interface NotificationDelivery {
  id: string;
  userId: string;
  notificationId: string;
  pushDeviceTokenId: string;
  platform: NotificationDeliveryPlatform;
  provider: NotificationDeliveryProvider;
  status: NotificationDeliveryStatus;
  latencyMs?: number;
  errorCode?: string;
  disableToken?: boolean;
  createdAt: Date;
}

export interface CreateNotificationDeliveryInput {
  userId: string;
  notificationId: string;
  pushDeviceTokenId: string;
  platform: NotificationDeliveryPlatform;
  provider?: NotificationDeliveryProvider;
  status: NotificationDeliveryStatus;
  latencyMs?: number;
  errorCode?: string;
  disableToken?: boolean;
}

export interface NotificationDeliveryRepository {
  create(input: CreateNotificationDeliveryInput): Promise<NotificationDelivery>;
  listForUser(userId: string, limit?: number): Promise<NotificationDelivery[]>;
}

export function createNotificationDelivery(
  input: CreateNotificationDeliveryInput,
  now = new Date()
): NotificationDelivery {
  return {
    id: `notification_delivery_${randomUUID()}`,
    userId: input.userId,
    notificationId: input.notificationId,
    pushDeviceTokenId: input.pushDeviceTokenId,
    platform: input.platform,
    provider: input.provider ?? "fcm",
    status: input.status,
    latencyMs: input.latencyMs,
    errorCode: input.errorCode,
    disableToken: input.disableToken,
    createdAt: now
  };
}
