import type { Firestore } from "@google-cloud/firestore";
import {
  createNotificationEvent,
  type CreateNotificationEventInput,
  type NotificationAction,
  type NotificationEvent,
  type NotificationEventRepository,
  type NotificationPriority,
  type NotificationPrivacy,
  type NotificationStatus,
  type NotificationType
} from "../../domain/notifications/notificationEvent.js";
import { firestoreDate, removeUndefinedDeep } from "./firestoreClient.js";

const COLLECTION = "notificationEvents";

export class FirestoreNotificationEventRepository implements NotificationEventRepository {
  constructor(private readonly firestore: Firestore) {}

  async create(input: CreateNotificationEventInput): Promise<NotificationEvent> {
    const event = createNotificationEvent(input);
    await this.collection().doc(event.id).set(removeUndefinedDeep(event));
    return event;
  }

  async listForUser(userId: string, limit = 50): Promise<NotificationEvent[]> {
    await this.expireDue();
    const snapshot = await this.collection()
      .where("userId", "==", userId)
      .limit(Math.max(limit * 3, limit))
      .get();
    return snapshot.docs
      .map((doc) => notificationEventFromFirestore(doc.id, doc.data()))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async listUnreadForUser(userId: string, limit = 50): Promise<NotificationEvent[]> {
    const events = await this.listForUser(userId, Math.max(limit * 3, limit));
    return events
      .filter((event) => event.status === "unread")
      .slice(0, limit);
  }

  async markRead(id: string, userId: string): Promise<NotificationEvent | undefined> {
    return this.updateStatus(id, userId, "read");
  }

  async dismiss(id: string, userId: string): Promise<NotificationEvent | undefined> {
    return this.updateStatus(id, userId, "dismissed");
  }

  async dismissBySource(userId: string, sourceType: string, sourceId: string): Promise<number> {
    const snapshot = await this.collection()
      .where("userId", "==", userId)
      .where("sourceType", "==", sourceType)
      .where("sourceId", "==", sourceId)
      .limit(25)
      .get();
    const batch = this.firestore.batch();
    let count = 0;
    const now = new Date();
    for (const doc of snapshot.docs) {
      const event = notificationEventFromFirestore(doc.id, doc.data());
      if (event.status === "unread") {
        batch.update(doc.ref, { status: "dismissed", dismissedAt: now });
        count += 1;
      }
    }
    if (count > 0) {
      await batch.commit();
    }
    return count;
  }

  async expireDue(now = new Date()): Promise<number> {
    const snapshot = await this.collection()
      .where("status", "==", "unread")
      .limit(100)
      .get();
    const batch = this.firestore.batch();
    for (const doc of snapshot.docs) {
      const event = notificationEventFromFirestore(doc.id, doc.data());
      if (event.expiresAt && event.expiresAt.getTime() <= now.getTime()) {
        batch.update(doc.ref, { status: "expired" });
      }
    }
    const expiredCount = snapshot.docs.filter((doc) => {
      const event = notificationEventFromFirestore(doc.id, doc.data());
      return Boolean(event.expiresAt && event.expiresAt.getTime() <= now.getTime());
    }).length;
    if (expiredCount > 0) {
      await batch.commit();
    }
    return expiredCount;
  }

  private async updateStatus(id: string, userId: string, status: "read" | "dismissed") {
    const ref = this.collection().doc(id);
    const doc = await ref.get();
    if (!doc.exists) {
      return undefined;
    }
    const event = notificationEventFromFirestore(doc.id, doc.data() ?? {});
    if (event.userId !== userId) {
      return undefined;
    }
    const patch = status === "read"
      ? { status, readAt: new Date() }
      : { status, dismissedAt: new Date() };
    await ref.update(patch);
    return { ...event, ...patch };
  }

  private collection() {
    return this.firestore.collection(COLLECTION);
  }
}

function notificationEventFromFirestore(id: string, data: Record<string, unknown>): NotificationEvent {
  return {
    id,
    userId: getString(data.userId) ?? "",
    type: getType(data.type),
    priority: getPriority(data.priority),
    privacy: getPrivacy(data.privacy),
    title: getString(data.title) ?? "Phone Agent",
    body: getString(data.body) ?? "Notification",
    detailedBody: getString(data.detailedBody),
    target: getString(data.target) ?? "assistant",
    sourceType: getString(data.sourceType),
    sourceId: getString(data.sourceId),
    actions: parseActions(data.actions),
    status: getStatus(data.status),
    expiresAt: firestoreDate(data.expiresAt),
    createdAt: firestoreDate(data.createdAt) ?? new Date(0),
    readAt: firestoreDate(data.readAt),
    dismissedAt: firestoreDate(data.dismissedAt)
  };
}

function parseActions(value: unknown): NotificationAction[] {
  return Array.isArray(value)
    ? value.flatMap((item) => {
      if (!item || typeof item !== "object") {
        return [];
      }
      const record = item as Record<string, unknown>;
      const id = getString(record.id);
      const label = getString(record.label);
      const target = getString(record.target);
      return id && label && target ? [{ id, label, target }] : [];
    })
    : [];
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getType(value: unknown): NotificationType {
  const allowed: NotificationType[] = [
    "live_transfer_request",
    "live_answer_request",
    "live_call_state",
    "call_summary",
    "topic_suggestion",
    "decision_pending",
    "calendar_change",
    "billing_issue",
    "setup_issue",
    "provider_issue",
    "privacy_review"
  ];
  return allowed.includes(value as NotificationType) ? value as NotificationType : "provider_issue";
}

function getPriority(value: unknown): NotificationPriority {
  return value === "low" || value === "high" || value === "urgent" ? value : "normal";
}

function getPrivacy(value: unknown): NotificationPrivacy {
  return value === "summary" || value === "detailed" ? value : "private";
}

function getStatus(value: unknown): NotificationStatus {
  return value === "read" || value === "dismissed" || value === "expired" ? value : "unread";
}
