import { randomUUID } from "node:crypto";
import type { Firestore } from "@google-cloud/firestore";
import type {
  AnswerRequest,
  AnswerRequestRepository,
  AnswerRequestStatus,
  CreateAnswerRequestInput
} from "../../domain/answerRequests/answerRequest.js";
import { firestoreDate, removeUndefinedDeep } from "./firestoreClient.js";

const ANSWER_REQUEST_COLLECTION = "answerRequests";

export class FirestoreAnswerRequestRepository implements AnswerRequestRepository {
  constructor(private readonly firestore: Firestore) {}

  async create(input: CreateAnswerRequestInput): Promise<AnswerRequest> {
    const now = new Date();
    const answerRequest: AnswerRequest = {
      id: randomUUID(),
      userId: input.userId,
      type: "live_answer",
      status: "pending",
      providerCallId: input.providerCallId,
      callerNumber: input.callerNumber,
      callerName: input.callerName,
      question: input.question,
      reason: input.reason,
      urgency: input.urgency ?? "unknown",
      createdAt: now,
      expiresAt: new Date(now.getTime() + (input.timeoutMs ?? 45_000))
    };
    await this.collection().doc(answerRequest.id).set(removeUndefinedDeep(answerRequest));
    return answerRequest;
  }

  async get(id: string): Promise<AnswerRequest | undefined> {
    await this.expirePending();
    const doc = await this.collection().doc(id).get();
    return doc.exists ? answerRequestFromFirestore(doc.id, doc.data() ?? {}) : undefined;
  }

  async listPending(now = new Date()): Promise<AnswerRequest[]> {
    await this.expirePending(now);
    const snapshot = await this.collection()
      .where("status", "==", "pending")
      .limit(25)
      .get();
    return snapshot.docs
      .map((doc) => answerRequestFromFirestore(doc.id, doc.data()))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async answer(id: string, answer: string): Promise<AnswerRequest | undefined> {
    return this.decide(id, "answered", answer);
  }

  async decline(id: string): Promise<AnswerRequest | undefined> {
    return this.decide(id, "declined");
  }

  async expirePending(now = new Date()): Promise<void> {
    const pending = await this.collection()
      .where("status", "==", "pending")
      .limit(25)
      .get();
    const batch = this.firestore.batch();
    let updateCount = 0;
    for (const doc of pending.docs) {
      const request = answerRequestFromFirestore(doc.id, doc.data());
      if (request.expiresAt.getTime() <= now.getTime()) {
        batch.update(doc.ref, { status: "expired", respondedAt: now });
        updateCount += 1;
      }
    }
    if (updateCount > 0) {
      await batch.commit();
    }
  }

  private async decide(
    id: string,
    status: Extract<AnswerRequestStatus, "answered" | "declined">,
    answer?: string
  ): Promise<AnswerRequest | undefined> {
    const docRef = this.collection().doc(id);
    return this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(docRef);
      if (!snapshot.exists) {
        return undefined;
      }
      const existing = answerRequestFromFirestore(snapshot.id, snapshot.data() ?? {});
      if (existing.status !== "pending") {
        return existing;
      }
      const now = new Date();
      const updated = existing.expiresAt.getTime() <= now.getTime()
        ? { ...existing, status: "expired" as const, respondedAt: now }
        : { ...existing, status, answer, respondedAt: now };
      transaction.set(docRef, removeUndefinedDeep(updated));
      return updated;
    });
  }

  private collection() {
    return this.firestore.collection(ANSWER_REQUEST_COLLECTION);
  }
}

function answerRequestFromFirestore(id: string, data: Record<string, unknown>): AnswerRequest {
  return {
    id: getString(data.id) ?? id,
    userId: getString(data.userId),
    type: "live_answer",
    status: answerRequestStatus(data.status),
    providerCallId: getString(data.providerCallId),
    callerNumber: getString(data.callerNumber),
    callerName: getString(data.callerName),
    question: getString(data.question) ?? "",
    reason: getString(data.reason),
    urgency: answerRequestUrgency(data.urgency),
    answer: getString(data.answer),
    createdAt: firestoreDate(data.createdAt) ?? new Date(0),
    expiresAt: firestoreDate(data.expiresAt) ?? new Date(0),
    respondedAt: firestoreDate(data.respondedAt)
  };
}

function answerRequestStatus(value: unknown): AnswerRequestStatus {
  return value === "answered" || value === "declined" || value === "expired" ? value : "pending";
}

function answerRequestUrgency(value: unknown): AnswerRequest["urgency"] {
  return value === "low" || value === "normal" || value === "high" || value === "emergency" ? value : "unknown";
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}
