import { randomUUID } from "node:crypto";
import type { Firestore } from "@google-cloud/firestore";
import type {
  ApprovalRequest,
  ApprovalRequestRepository,
  ApprovalRequestStatus,
  CreateApprovalRequestInput
} from "../../domain/approvals/approvalRequest.js";
import { DEFAULT_TRANSFER_APPROVAL_TIMEOUT_MS } from "../../domain/liveActions/liveActionTimeouts.js";
import { firestoreDate, removeUndefinedDeep } from "./firestoreClient.js";

const APPROVAL_COLLECTION = "approvalRequests";

export class FirestoreApprovalRequestRepository implements ApprovalRequestRepository {
  constructor(private readonly firestore: Firestore) {}

  async create(input: CreateApprovalRequestInput): Promise<ApprovalRequest> {
    const now = new Date();
    const approval: ApprovalRequest = {
      id: randomUUID(),
      userId: input.userId,
      type: "warm_transfer",
      status: "pending",
      providerCallId: input.providerCallId,
      callerNumber: input.callerNumber,
      callerName: input.callerName,
      reason: input.reason,
      urgency: input.urgency ?? "unknown",
      transferToNumber: input.transferToNumber,
      createdAt: now,
      expiresAt: new Date(now.getTime() + (input.timeoutMs ?? DEFAULT_TRANSFER_APPROVAL_TIMEOUT_MS))
    };
    await this.collection().doc(approval.id).set(removeUndefinedDeep(approval));
    return approval;
  }

  async get(id: string): Promise<ApprovalRequest | undefined> {
    await this.expirePending();
    const doc = await this.collection().doc(id).get();
    return doc.exists ? approvalFromFirestore(doc.id, doc.data() ?? {}) : undefined;
  }

  async listPending(now = new Date()): Promise<ApprovalRequest[]> {
    await this.expirePending(now);
    const snapshot = await this.collection()
      .where("status", "==", "pending")
      .limit(25)
      .get();
    return snapshot.docs
      .map((doc) => approvalFromFirestore(doc.id, doc.data()))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async accept(id: string): Promise<ApprovalRequest | undefined> {
    return this.decide(id, "accepted");
  }

  async decline(id: string): Promise<ApprovalRequest | undefined> {
    return this.decide(id, "declined");
  }

  async expirePending(now = new Date()): Promise<void> {
    const expired = await this.collection()
      .where("status", "==", "pending")
      .limit(25)
      .get();
    const batch = this.firestore.batch();
    let updateCount = 0;
    for (const doc of expired.docs) {
      const approval = approvalFromFirestore(doc.id, doc.data());
      if (approval.expiresAt.getTime() <= now.getTime()) {
        batch.update(doc.ref, { status: "expired", decidedAt: now });
        updateCount += 1;
      }
    }
    if (updateCount > 0) {
      await batch.commit();
    }
  }

  private async decide(id: string, status: "accepted" | "declined"): Promise<ApprovalRequest | undefined> {
    const docRef = this.collection().doc(id);
    return this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(docRef);
      if (!snapshot.exists) {
        return undefined;
      }
      const existing = approvalFromFirestore(snapshot.id, snapshot.data() ?? {});
      if (existing.status !== "pending") {
        return existing;
      }
      const now = new Date();
      const updated = existing.expiresAt.getTime() <= now.getTime()
        ? { ...existing, status: "expired" as const, decidedAt: now }
        : { ...existing, status, decidedAt: now };
      transaction.set(docRef, removeUndefinedDeep(updated));
      return updated;
    });
  }

  private collection() {
    return this.firestore.collection(APPROVAL_COLLECTION);
  }
}

function approvalFromFirestore(id: string, data: Record<string, unknown>): ApprovalRequest {
  return {
    id: getString(data.id) ?? id,
    userId: getString(data.userId),
    type: "warm_transfer",
    status: approvalStatus(data.status),
    providerCallId: getString(data.providerCallId),
    callerNumber: getString(data.callerNumber),
    callerName: getString(data.callerName),
    reason: getString(data.reason) ?? "Caller requested live attention.",
    urgency: approvalUrgency(data.urgency),
    transferToNumber: getString(data.transferToNumber),
    createdAt: firestoreDate(data.createdAt) ?? new Date(0),
    expiresAt: firestoreDate(data.expiresAt) ?? new Date(0),
    decidedAt: firestoreDate(data.decidedAt)
  };
}

function approvalStatus(value: unknown): ApprovalRequestStatus {
  return value === "accepted" || value === "declined" || value === "expired" ? value : "pending";
}

function approvalUrgency(value: unknown): ApprovalRequest["urgency"] {
  return value === "low" || value === "normal" || value === "high" || value === "emergency" ? value : "unknown";
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}
