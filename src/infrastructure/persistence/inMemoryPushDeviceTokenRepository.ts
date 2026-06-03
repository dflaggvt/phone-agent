import {
  createPushDeviceToken,
  pushTokenHash,
  type PushDeviceToken,
  type PushDeviceTokenRepository,
  type RegisterPushDeviceTokenInput
} from "../../domain/notifications/pushDeviceToken.js";

export class InMemoryPushDeviceTokenRepository implements PushDeviceTokenRepository {
  private readonly tokens = new Map<string, PushDeviceToken>();

  async upsert(input: RegisterPushDeviceTokenInput): Promise<PushDeviceToken> {
    const tokenHash = pushTokenHash(input.token);
    const existing = [...this.tokens.values()].find((token) => token.userId === input.userId && token.tokenHash === tokenHash);
    const now = new Date();
    const next: PushDeviceToken = existing
      ? {
        ...existing,
        token: input.token,
        platform: input.platform,
        deviceId: input.deviceId,
        appVersion: input.appVersion,
        status: "active",
        updatedAt: now,
        lastSeenAt: now,
        disabledAt: undefined
      }
      : createPushDeviceToken(input, now);
    this.tokens.set(next.id, next);
    return next;
  }

  async listActiveForUser(userId: string): Promise<PushDeviceToken[]> {
    return [...this.tokens.values()]
      .filter((token) => token.userId === userId && token.status === "active")
      .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime());
  }

  async markDelivery(id: string, status: "sent" | "failed", errorCode?: string): Promise<PushDeviceToken | undefined> {
    const existing = this.tokens.get(id);
    if (!existing) {
      return undefined;
    }
    const next: PushDeviceToken = {
      ...existing,
      lastDeliveryAt: new Date(),
      lastDeliveryStatus: status,
      lastDeliveryErrorCode: errorCode,
      updatedAt: new Date()
    };
    this.tokens.set(id, next);
    return next;
  }

  async disable(id: string, reason?: string): Promise<PushDeviceToken | undefined> {
    const existing = this.tokens.get(id);
    if (!existing) {
      return undefined;
    }
    const next: PushDeviceToken = {
      ...existing,
      status: "disabled",
      disabledAt: new Date(),
      updatedAt: new Date(),
      lastDeliveryStatus: "failed",
      lastDeliveryErrorCode: reason
    };
    this.tokens.set(id, next);
    return next;
  }
}
