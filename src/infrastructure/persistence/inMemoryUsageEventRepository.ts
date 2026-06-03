import { randomUUID } from "node:crypto";
import type {
  CreateUsageEventInput,
  UsageEvent,
  UsageEventRepository,
  UsageSummary
} from "../../domain/billing/usage.js";

export class InMemoryUsageEventRepository implements UsageEventRepository {
  private readonly events = new Map<string, UsageEvent>();

  async create(input: CreateUsageEventInput): Promise<UsageEvent> {
    const idempotencyKey = input.idempotencyKey ?? defaultIdempotencyKey(input);
    const existing = [...this.events.values()].find((event) => event.idempotencyKey === idempotencyKey);
    if (existing) {
      return existing;
    }
    const now = new Date();
    const event: UsageEvent = {
      id: randomUUID(),
      idempotencyKey,
      userId: input.userId,
      type: input.type,
      quantity: input.quantity,
      provider: input.provider,
      sourceId: input.sourceId,
      occurredAt: input.occurredAt ?? now,
      createdAt: now
    };
    this.events.set(event.id, event);
    return event;
  }

  async markBillingPublished(id: string, billingMeterEventId: string, publishedAt = new Date()): Promise<UsageEvent | undefined> {
    const existing = this.events.get(id);
    if (!existing) {
      return undefined;
    }
    const updated = {
      ...existing,
      billingMeterEventId,
      billingPublishedAt: publishedAt,
      billingPublishError: undefined
    };
    this.events.set(id, updated);
    return updated;
  }

  async markBillingPublishFailed(id: string, error: string): Promise<UsageEvent | undefined> {
    const existing = this.events.get(id);
    if (!existing) {
      return undefined;
    }
    const updated = {
      ...existing,
      billingPublishError: error
    };
    this.events.set(id, updated);
    return updated;
  }

  async summarizeForUser(userId: string, periodStart: Date, periodEnd: Date): Promise<UsageSummary> {
    return summarize(userId, periodStart, periodEnd, [...this.events.values()]);
  }
}

function defaultIdempotencyKey(input: CreateUsageEventInput): string {
  return [input.userId, input.type, input.sourceId ?? randomUUID()].join(":");
}

export function summarize(userId: string, periodStart: Date, periodEnd: Date, events: UsageEvent[]): UsageSummary {
  const inPeriod = events.filter((event) =>
    event.userId === userId
    && event.occurredAt.getTime() >= periodStart.getTime()
    && event.occurredAt.getTime() < periodEnd.getTime()
  );
  return {
    userId,
    periodStart,
    periodEnd,
    callMinutes: sum(inPeriod, "call_minute"),
    classificationRequests: sum(inPeriod, "openai_classification"),
    calendarWrites: sum(inPeriod, "calendar_write"),
    outboundCallAttempts: sum(inPeriod, "outbound_call_attempt")
  };
}

function sum(events: UsageEvent[], type: UsageEvent["type"]): number {
  return events
    .filter((event) => event.type === type)
    .reduce((total, event) => total + event.quantity, 0);
}
