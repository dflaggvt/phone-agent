import { randomUUID } from "node:crypto";
import type { Firestore } from "@google-cloud/firestore";
import type {
  CreateUsageEventInput,
  UsageEvent,
  UsageEventRepository,
  UsageEventType,
  UsageSummary
} from "../../domain/billing/usage.js";
import { firestoreDate, removeUndefinedDeep } from "./firestoreClient.js";
import { summarize } from "./inMemoryUsageEventRepository.js";

const COLLECTION = "usageEvents";

export class FirestoreUsageEventRepository implements UsageEventRepository {
  constructor(private readonly firestore: Firestore) {}

  async create(input: CreateUsageEventInput): Promise<UsageEvent> {
    const idempotencyKey = input.idempotencyKey ?? defaultIdempotencyKey(input);
    const existing = await this.firestore.collection(COLLECTION)
      .where("idempotencyKey", "==", idempotencyKey)
      .limit(1)
      .get();
    if (existing.docs[0]) {
      return usageEventFromFirestore(existing.docs[0].id, existing.docs[0].data());
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
    await this.firestore.collection(COLLECTION).doc(event.id).set(removeUndefinedDeep(event));
    return event;
  }

  async markBillingPublished(id: string, billingMeterEventId: string, publishedAt = new Date()): Promise<UsageEvent | undefined> {
    const ref = this.firestore.collection(COLLECTION).doc(id);
    const doc = await ref.get();
    if (!doc.exists) {
      return undefined;
    }
    await ref.set(removeUndefinedDeep({
      billingMeterEventId,
      billingPublishedAt: publishedAt,
      billingPublishError: null
    }), { merge: true });
    const updated = await ref.get();
    return usageEventFromFirestore(updated.id, updated.data() ?? {});
  }

  async markBillingPublishFailed(id: string, error: string): Promise<UsageEvent | undefined> {
    const ref = this.firestore.collection(COLLECTION).doc(id);
    const doc = await ref.get();
    if (!doc.exists) {
      return undefined;
    }
    await ref.set(removeUndefinedDeep({ billingPublishError: error }), { merge: true });
    const updated = await ref.get();
    return usageEventFromFirestore(updated.id, updated.data() ?? {});
  }

  async summarizeForUser(userId: string, periodStart: Date, periodEnd: Date): Promise<UsageSummary> {
    const snapshot = await this.firestore.collection(COLLECTION)
      .where("userId", "==", userId)
      .limit(2000)
      .get();
    return summarize(userId, periodStart, periodEnd, snapshot.docs.map((doc) => usageEventFromFirestore(doc.id, doc.data())));
  }
}

function usageEventFromFirestore(id: string, data: Record<string, unknown>): UsageEvent {
  return {
    id,
    idempotencyKey: getString(data.idempotencyKey) ?? id,
    userId: getString(data.userId) ?? "",
    type: usageEventType(data.type),
    quantity: typeof data.quantity === "number" ? data.quantity : 0,
    provider: getString(data.provider),
    sourceId: getString(data.sourceId),
    billingMeterEventId: getString(data.billingMeterEventId),
    billingPublishedAt: firestoreDate(data.billingPublishedAt),
    billingPublishError: getString(data.billingPublishError),
    occurredAt: firestoreDate(data.occurredAt) ?? new Date(0),
    createdAt: firestoreDate(data.createdAt) ?? new Date(0)
  };
}

function defaultIdempotencyKey(input: CreateUsageEventInput): string {
  return [input.userId, input.type, input.sourceId ?? randomUUID()].join(":");
}

function usageEventType(value: unknown): UsageEventType {
  return value === "openai_classification" || value === "calendar_write" || value === "outbound_call_attempt"
    ? value
    : "call_minute";
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
