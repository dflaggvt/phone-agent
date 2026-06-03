import type {
  StartWebhookProcessingInput,
  WebhookEventRecord,
  WebhookEventRepository,
  WebhookProcessingClaim,
  WebhookProcessingError
} from "../../domain/webhooks/webhookEvent.js";

export class InMemoryWebhookEventRepository implements WebhookEventRepository {
  private readonly events = new Map<string, WebhookEventRecord>();

  async startProcessing(input: StartWebhookProcessingInput): Promise<WebhookProcessingClaim> {
    const key = recordKey(input.provider, input.eventId);
    const now = input.now ?? new Date();
    const existing = this.events.get(key);
    if (existing?.status === "processed") {
      return { event: existing, shouldProcess: false };
    }
    const next: WebhookEventRecord = existing
      ? {
        ...existing,
        eventType: input.eventType,
        status: "processing",
        attempts: existing.attempts + 1,
        updatedAt: now,
        lastErrorCode: undefined,
        lastErrorMessage: undefined
      }
      : {
        provider: input.provider,
        eventId: input.eventId,
        eventType: input.eventType,
        status: "processing",
        attempts: 1,
        firstSeenAt: now,
        updatedAt: now
      };
    this.events.set(key, next);
    return { event: next, shouldProcess: true };
  }

  async markProcessed(provider: string, eventId: string, processedAt = new Date()): Promise<WebhookEventRecord | undefined> {
    const key = recordKey(provider, eventId);
    const existing = this.events.get(key);
    if (!existing) {
      return undefined;
    }
    const next: WebhookEventRecord = {
      ...existing,
      status: "processed",
      updatedAt: processedAt,
      processedAt,
      lastErrorCode: undefined,
      lastErrorMessage: undefined
    };
    this.events.set(key, next);
    return next;
  }

  async markFailed(
    provider: string,
    eventId: string,
    error: WebhookProcessingError,
    failedAt = new Date()
  ): Promise<WebhookEventRecord | undefined> {
    const key = recordKey(provider, eventId);
    const existing = this.events.get(key);
    if (!existing) {
      return undefined;
    }
    const next: WebhookEventRecord = {
      ...existing,
      status: "failed",
      updatedAt: failedAt,
      lastErrorCode: error.code,
      lastErrorMessage: error.message
    };
    this.events.set(key, next);
    return next;
  }
}

function recordKey(provider: string, eventId: string): string {
  return `${provider}:${eventId}`;
}

