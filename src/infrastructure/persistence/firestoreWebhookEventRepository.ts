import type { Firestore } from "@google-cloud/firestore";
import type {
  StartWebhookProcessingInput,
  WebhookEventRecord,
  WebhookEventRepository,
  WebhookProcessingClaim,
  WebhookProcessingError,
  WebhookProcessingStatus
} from "../../domain/webhooks/webhookEvent.js";
import { firestoreDate, removeUndefinedDeep } from "./firestoreClient.js";

const COLLECTION = "webhookEvents";

export class FirestoreWebhookEventRepository implements WebhookEventRepository {
  constructor(private readonly firestore: Firestore) {}

  async startProcessing(input: StartWebhookProcessingInput): Promise<WebhookProcessingClaim> {
    const now = input.now ?? new Date();
    const ref = this.firestore.collection(COLLECTION).doc(documentId(input.provider, input.eventId));
    return this.firestore.runTransaction(async (transaction) => {
      const doc = await transaction.get(ref);
      const existing = doc.exists ? webhookEventFromFirestore(doc.data() ?? {}) : undefined;
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
      transaction.set(ref, removeUndefinedDeep(next));
      return { event: next, shouldProcess: true };
    });
  }

  async markProcessed(provider: string, eventId: string, processedAt = new Date()): Promise<WebhookEventRecord | undefined> {
    const ref = this.firestore.collection(COLLECTION).doc(documentId(provider, eventId));
    const doc = await ref.get();
    if (!doc.exists) {
      return undefined;
    }
    await ref.set(removeUndefinedDeep({
      status: "processed",
      updatedAt: processedAt,
      processedAt,
      lastErrorCode: null,
      lastErrorMessage: null
    }), { merge: true });
    const updated = await ref.get();
    return webhookEventFromFirestore(updated.data() ?? {});
  }

  async markFailed(
    provider: string,
    eventId: string,
    error: WebhookProcessingError,
    failedAt = new Date()
  ): Promise<WebhookEventRecord | undefined> {
    const ref = this.firestore.collection(COLLECTION).doc(documentId(provider, eventId));
    const doc = await ref.get();
    if (!doc.exists) {
      return undefined;
    }
    await ref.set(removeUndefinedDeep({
      status: "failed",
      updatedAt: failedAt,
      lastErrorCode: error.code,
      lastErrorMessage: error.message
    }), { merge: true });
    const updated = await ref.get();
    return webhookEventFromFirestore(updated.data() ?? {});
  }
}

function documentId(provider: string, eventId: string): string {
  return `${safeDocumentSegment(provider)}_${safeDocumentSegment(eventId)}`;
}

function safeDocumentSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 700);
}

function webhookEventFromFirestore(data: Record<string, unknown>): WebhookEventRecord {
  return {
    provider: getString(data.provider) ?? "",
    eventId: getString(data.eventId) ?? "",
    eventType: getString(data.eventType) ?? "",
    status: webhookStatus(data.status),
    attempts: getNumber(data.attempts) ?? 0,
    firstSeenAt: firestoreDate(data.firstSeenAt) ?? new Date(0),
    updatedAt: firestoreDate(data.updatedAt) ?? new Date(0),
    processedAt: firestoreDate(data.processedAt),
    lastErrorCode: getString(data.lastErrorCode),
    lastErrorMessage: getString(data.lastErrorMessage)
  };
}

function webhookStatus(value: unknown): WebhookProcessingStatus {
  return value === "processed" || value === "failed" ? value : "processing";
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

