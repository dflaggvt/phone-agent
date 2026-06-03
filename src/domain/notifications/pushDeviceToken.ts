import { createHash, randomUUID } from "node:crypto";

export type PushPlatform = "android";
export type PushDeviceTokenStatus = "active" | "disabled";

export interface PushDeviceToken {
  id: string;
  userId: string;
  token: string;
  tokenHash: string;
  platform: PushPlatform;
  deviceId?: string;
  appVersion?: string;
  status: PushDeviceTokenStatus;
  createdAt: Date;
  updatedAt: Date;
  lastSeenAt: Date;
  disabledAt?: Date;
  lastDeliveryAt?: Date;
  lastDeliveryStatus?: "sent" | "failed";
  lastDeliveryErrorCode?: string;
}

export interface RegisterPushDeviceTokenInput {
  userId: string;
  token: string;
  platform: PushPlatform;
  deviceId?: string;
  appVersion?: string;
}

export interface PushDeviceTokenRepository {
  upsert(input: RegisterPushDeviceTokenInput): Promise<PushDeviceToken>;
  listActiveForUser(userId: string): Promise<PushDeviceToken[]>;
  markDelivery(
    id: string,
    status: "sent" | "failed",
    errorCode?: string
  ): Promise<PushDeviceToken | undefined>;
  disable(id: string, reason?: string): Promise<PushDeviceToken | undefined>;
}

export function createPushDeviceToken(input: RegisterPushDeviceTokenInput, now = new Date()): PushDeviceToken {
  return {
    id: `push_device_${randomUUID()}`,
    userId: input.userId,
    token: input.token,
    tokenHash: pushTokenHash(input.token),
    platform: input.platform,
    deviceId: input.deviceId,
    appVersion: input.appVersion,
    status: "active",
    createdAt: now,
    updatedAt: now,
    lastSeenAt: now
  };
}

export function pushTokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
