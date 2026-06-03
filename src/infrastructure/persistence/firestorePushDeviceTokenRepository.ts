import type { Firestore } from "@google-cloud/firestore";
import {
  createPushDeviceToken,
  pushTokenHash,
  type PushDeviceToken,
  type PushDeviceTokenRepository,
  type PushDeviceTokenStatus,
  type RegisterPushDeviceTokenInput
} from "../../domain/notifications/pushDeviceToken.js";
import { firestoreDate, removeUndefinedDeep } from "./firestoreClient.js";

const COLLECTION = "pushDeviceTokens";

export class FirestorePushDeviceTokenRepository implements PushDeviceTokenRepository {
  constructor(private readonly firestore: Firestore) {}

  async upsert(input: RegisterPushDeviceTokenInput): Promise<PushDeviceToken> {
    const tokenHash = pushTokenHash(input.token);
    const existing = await this.collection()
      .where("userId", "==", input.userId)
      .where("tokenHash", "==", tokenHash)
      .limit(1)
      .get();
    const now = new Date();
    if (!existing.empty) {
      const doc = existing.docs[0];
      if (!doc) {
        throw new Error("Expected existing push device token document.");
      }
      const current = pushDeviceTokenFromFirestore(doc.id, doc.data());
      const next: PushDeviceToken = {
        ...current,
        token: input.token,
        platform: input.platform,
        deviceId: input.deviceId,
        appVersion: input.appVersion,
        status: "active",
        updatedAt: now,
        lastSeenAt: now,
        disabledAt: undefined
      };
      await doc.ref.set(removeUndefinedDeep(next), { merge: true });
      return next;
    }

    const created = createPushDeviceToken(input, now);
    await this.collection().doc(created.id).set(removeUndefinedDeep(created));
    return created;
  }

  async listActiveForUser(userId: string): Promise<PushDeviceToken[]> {
    const snapshot = await this.collection()
      .where("userId", "==", userId)
      .where("status", "==", "active")
      .limit(20)
      .get();
    return snapshot.docs
      .map((doc) => pushDeviceTokenFromFirestore(doc.id, doc.data()))
      .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime());
  }

  async markDelivery(id: string, status: "sent" | "failed", errorCode?: string): Promise<PushDeviceToken | undefined> {
    const ref = this.collection().doc(id);
    const doc = await ref.get();
    if (!doc.exists) {
      return undefined;
    }
    const patch: Pick<PushDeviceToken, "lastDeliveryAt" | "lastDeliveryStatus" | "lastDeliveryErrorCode" | "updatedAt"> = removeUndefinedDeep({
      lastDeliveryAt: new Date(),
      lastDeliveryStatus: status,
      lastDeliveryErrorCode: errorCode,
      updatedAt: new Date()
    });
    await ref.update(patch);
    return { ...pushDeviceTokenFromFirestore(doc.id, doc.data() ?? {}), ...patch };
  }

  async disable(id: string, reason?: string): Promise<PushDeviceToken | undefined> {
    const ref = this.collection().doc(id);
    const doc = await ref.get();
    if (!doc.exists) {
      return undefined;
    }
    const patch: Pick<PushDeviceToken, "status" | "disabledAt" | "updatedAt" | "lastDeliveryStatus" | "lastDeliveryErrorCode"> = removeUndefinedDeep({
      status: "disabled",
      disabledAt: new Date(),
      updatedAt: new Date(),
      lastDeliveryStatus: "failed",
      lastDeliveryErrorCode: reason
    });
    await ref.update(patch);
    return { ...pushDeviceTokenFromFirestore(doc.id, doc.data() ?? {}), ...patch };
  }

  private collection() {
    return this.firestore.collection(COLLECTION);
  }
}

function pushDeviceTokenFromFirestore(id: string, data: Record<string, unknown>): PushDeviceToken {
  return {
    id,
    userId: getString(data.userId) ?? "",
    token: getString(data.token) ?? "",
    tokenHash: getString(data.tokenHash) ?? "",
    platform: data.platform === "android" ? "android" : "android",
    deviceId: getString(data.deviceId),
    appVersion: getString(data.appVersion),
    status: getPushStatus(data.status),
    createdAt: firestoreDate(data.createdAt) ?? new Date(0),
    updatedAt: firestoreDate(data.updatedAt) ?? new Date(0),
    lastSeenAt: firestoreDate(data.lastSeenAt) ?? new Date(0),
    disabledAt: firestoreDate(data.disabledAt),
    lastDeliveryAt: firestoreDate(data.lastDeliveryAt),
    lastDeliveryStatus: data.lastDeliveryStatus === "sent" || data.lastDeliveryStatus === "failed"
      ? data.lastDeliveryStatus
      : undefined,
    lastDeliveryErrorCode: getString(data.lastDeliveryErrorCode)
  };
}

function getPushStatus(value: unknown): PushDeviceTokenStatus {
  return value === "disabled" ? "disabled" : "active";
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
