import { randomUUID } from "node:crypto";
import type {
  CreateProductAnalyticsEventInput,
  ProductAnalyticsEvent,
  ProductAnalyticsEventRepository
} from "../../domain/analytics/productAnalyticsEvent.js";

export class InMemoryProductAnalyticsEventRepository implements ProductAnalyticsEventRepository {
  private readonly events: ProductAnalyticsEvent[] = [];

  async createMany(inputs: CreateProductAnalyticsEventInput[]): Promise<ProductAnalyticsEvent[]> {
    const stored = inputs.map((input) => ({
      id: randomUUID(),
      userId: input.userId,
      sessionId: input.sessionId,
      eventName: input.eventName,
      screen: input.screen,
      surface: input.surface,
      action: input.action,
      result: input.result,
      objectType: input.objectType,
      objectId: input.objectId,
      latencyMs: input.latencyMs,
      sequence: input.sequence,
      appVersion: input.appVersion,
      buildType: input.buildType,
      deviceClass: input.deviceClass,
      osVersion: input.osVersion,
      networkStatus: input.networkStatus,
      attributes: input.attributes ?? {},
      occurredAt: input.occurredAt ?? new Date(),
      receivedAt: new Date()
    }));
    this.events.push(...stored);
    return stored;
  }

  async listForUser(userId: string, limit = 100): Promise<ProductAnalyticsEvent[]> {
    return this.events
      .filter((event) => event.userId === userId)
      .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime())
      .slice(0, limit);
  }
}
