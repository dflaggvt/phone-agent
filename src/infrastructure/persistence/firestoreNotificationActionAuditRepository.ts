import type { Firestore } from "@google-cloud/firestore";
import {
  createNotificationActionAudit,
  type CreateNotificationActionAuditInput,
  type NotificationActionAudit,
  type NotificationActionAuditRepository,
  type NotificationActionResult,
  type NotificationActionSurface
} from "../../domain/notifications/notificationActionAudit.js";
import { firestoreDate, removeUndefinedDeep } from "./firestoreClient.js";

const COLLECTION = "notificationActionAudits";

export class FirestoreNotificationActionAuditRepository implements NotificationActionAuditRepository {
  constructor(private readonly firestore: Firestore) {}

  async create(input: CreateNotificationActionAuditInput): Promise<NotificationActionAudit> {
    const audit = createNotificationActionAudit(input);
    await this.collection().doc(audit.id).set(removeUndefinedDeep(audit));
    return audit;
  }

  async listForUser(userId: string, limit = 50): Promise<NotificationActionAudit[]> {
    const snapshot = await this.collection()
      .where("userId", "==", userId)
      .limit(Math.max(limit * 3, limit))
      .get();
    return snapshot.docs
      .map((doc) => auditFromFirestore(doc.id, doc.data()))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  private collection() {
    return this.firestore.collection(COLLECTION);
  }
}

function auditFromFirestore(id: string, data: Record<string, unknown>): NotificationActionAudit {
  return {
    id,
    userId: getString(data.userId) ?? "",
    sourceType: getString(data.sourceType) ?? "unknown",
    sourceId: getString(data.sourceId) ?? "",
    action: getString(data.action) ?? "unknown",
    surface: actionSurface(data.surface),
    result: actionResult(data.result),
    latencyMs: getNumber(data.latencyMs),
    errorCode: getString(data.errorCode),
    createdAt: firestoreDate(data.createdAt) ?? new Date(0)
  };
}

function actionSurface(value: unknown): NotificationActionSurface {
  return value === "notification_action" || value === "app_screen" ? value : "api";
}

function actionResult(value: unknown): NotificationActionResult {
  return value === "accepted" || value === "declined" || value === "answered" || value === "expired" || value === "failed"
    ? value
    : "failed";
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
