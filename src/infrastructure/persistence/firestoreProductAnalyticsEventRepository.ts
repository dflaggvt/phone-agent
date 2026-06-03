import { randomUUID } from "node:crypto";
import type { Firestore } from "@google-cloud/firestore";
import type {
  CreateProductAnalyticsEventInput,
  ProductAnalyticsEvent,
  ProductAnalyticsEventRepository
} from "../../domain/analytics/productAnalyticsEvent.js";
import { firestoreDate, removeUndefinedDeep } from "./firestoreClient.js";

const COLLECTION = "productAnalyticsEvents";

export class FirestoreProductAnalyticsEventRepository implements ProductAnalyticsEventRepository {
  constructor(private readonly firestore: Firestore) {}

  async createMany(inputs: CreateProductAnalyticsEventInput[]): Promise<ProductAnalyticsEvent[]> {
    const receivedAt = new Date();
    const events = inputs.map((input) => ({
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
      occurredAt: input.occurredAt ?? receivedAt,
      receivedAt
    }));
    const batch = this.firestore.batch();
    for (const event of events) {
      batch.set(this.collection().doc(event.id), removeUndefinedDeep(event));
    }
    await batch.commit();
    return events;
  }

  async listForUser(userId: string, limit = 100): Promise<ProductAnalyticsEvent[]> {
    const snapshot = await this.collection()
      .where("userId", "==", userId)
      .orderBy("receivedAt", "desc")
      .limit(limit)
      .get();
    return snapshot.docs.map((doc) => eventFromFirestore(doc.id, doc.data()));
  }

  private collection() {
    return this.firestore.collection(COLLECTION);
  }
}

function eventFromFirestore(id: string, data: Record<string, unknown>): ProductAnalyticsEvent {
  return {
    id,
    userId: getString(data.userId) ?? "",
    sessionId: getString(data.sessionId) ?? "",
    eventName: getString(data.eventName) ?? "",
    screen: getString(data.screen),
    surface: getString(data.surface),
    action: getString(data.action),
    result: getString(data.result),
    objectType: getString(data.objectType),
    objectId: getString(data.objectId),
    latencyMs: getNumber(data.latencyMs),
    sequence: getNumber(data.sequence),
    appVersion: getString(data.appVersion),
    buildType: getString(data.buildType),
    deviceClass: getString(data.deviceClass),
    osVersion: getString(data.osVersion),
    networkStatus: getString(data.networkStatus),
    attributes: getAttributes(data.attributes),
    occurredAt: firestoreDate(data.occurredAt) ?? new Date(0),
    receivedAt: firestoreDate(data.receivedAt) ?? new Date(0)
  };
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function getNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getAttributes(value: unknown): Record<string, string | number | boolean> {
  if (!value || typeof value !== "object") {
    return {};
  }
  const result: Record<string, string | number | boolean> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (typeof child === "string" || typeof child === "number" || typeof child === "boolean") {
      result[key] = child;
    }
  }
  return result;
}
