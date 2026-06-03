import type { Firestore } from "@google-cloud/firestore";
import {
  createNotificationDelivery,
  type CreateNotificationDeliveryInput,
  type NotificationDelivery,
  type NotificationDeliveryPlatform,
  type NotificationDeliveryProvider,
  type NotificationDeliveryRepository,
  type NotificationDeliveryStatus
} from "../../domain/notifications/notificationDelivery.js";
import { firestoreDate, removeUndefinedDeep } from "./firestoreClient.js";

const COLLECTION = "notificationDeliveries";

export class FirestoreNotificationDeliveryRepository implements NotificationDeliveryRepository {
  constructor(private readonly firestore: Firestore) {}

  async create(input: CreateNotificationDeliveryInput): Promise<NotificationDelivery> {
    const delivery = createNotificationDelivery(input);
    await this.collection().doc(delivery.id).set(removeUndefinedDeep(delivery));
    return delivery;
  }

  async listForUser(userId: string, limit = 50): Promise<NotificationDelivery[]> {
    const snapshot = await this.collection()
      .where("userId", "==", userId)
      .limit(Math.max(limit * 3, limit))
      .get();
    return snapshot.docs
      .map((doc) => deliveryFromFirestore(doc.id, doc.data()))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  private collection() {
    return this.firestore.collection(COLLECTION);
  }
}

function deliveryFromFirestore(id: string, data: Record<string, unknown>): NotificationDelivery {
  return {
    id,
    userId: getString(data.userId) ?? "",
    notificationId: getString(data.notificationId) ?? "",
    pushDeviceTokenId: getString(data.pushDeviceTokenId) ?? "",
    platform: platform(data.platform),
    provider: provider(data.provider),
    status: deliveryStatus(data.status),
    latencyMs: getNumber(data.latencyMs),
    errorCode: getString(data.errorCode),
    disableToken: data.disableToken === true,
    createdAt: firestoreDate(data.createdAt) ?? new Date(0)
  };
}

function platform(value: unknown): NotificationDeliveryPlatform {
  return value === "android" ? value : "android";
}

function provider(value: unknown): NotificationDeliveryProvider {
  return value === "fcm" ? value : "fcm";
}

function deliveryStatus(value: unknown): NotificationDeliveryStatus {
  return value === "sent" ? "sent" : "failed";
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
