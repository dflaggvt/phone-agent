import { createHash, randomUUID } from "node:crypto";
import type { Firestore } from "@google-cloud/firestore";
import type {
  CreateTopicSuggestionInput,
  TopicSuggestion,
  TopicSuggestionRepository,
  TopicSuggestionStatus,
  TopicSuggestionTargetType
} from "../../domain/topics/topicSuggestion.js";
import { firestoreDate, removeUndefinedDeep } from "./firestoreClient.js";

const COLLECTION = "topicSuggestions";

export class FirestoreTopicSuggestionRepository implements TopicSuggestionRepository {
  constructor(private readonly firestore: Firestore) {}

  async upsertPending(input: CreateTopicSuggestionInput): Promise<TopicSuggestion> {
    const existing = await this.findPendingMatch(input);
    const now = new Date();
    const suggestion: TopicSuggestion = {
      id: existing?.id ?? stableSuggestionId(input),
      userId: input.userId,
      communicationItemId: input.communicationItemId,
      targetType: input.targetType,
      suggestedTopicThreadId: input.suggestedTopicThreadId,
      suggestedTitle: input.suggestedTitle,
      suggestedDescription: input.suggestedDescription,
      confidence: input.confidence,
      reason: input.reason,
      evidence: input.evidence ?? [],
      status: "pending",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };
    await this.collection().doc(suggestion.id).set(removeUndefinedDeep(suggestion));
    return suggestion;
  }

  async get(id: string): Promise<TopicSuggestion | undefined> {
    const doc = await this.collection().doc(id).get();
    return doc.exists ? topicSuggestionFromFirestore(doc.id, doc.data() ?? {}) : undefined;
  }

  async listForCommunication(userId: string, communicationItemId: string): Promise<TopicSuggestion[]> {
    const snapshot = await this.collection()
      .where("userId", "==", userId)
      .where("communicationItemId", "==", communicationItemId)
      .limit(100)
      .get();
    return snapshot.docs
      .map((doc) => topicSuggestionFromFirestore(doc.id, doc.data()))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async listPendingForUser(userId: string): Promise<TopicSuggestion[]> {
    const snapshot = await this.collection()
      .where("userId", "==", userId)
      .where("status", "==", "pending")
      .limit(100)
      .get();
    return snapshot.docs
      .map((doc) => topicSuggestionFromFirestore(doc.id, doc.data()))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async accept(id: string): Promise<TopicSuggestion | undefined> {
    return this.decide(id, "accepted");
  }

  async dismiss(id: string): Promise<TopicSuggestion | undefined> {
    return this.decide(id, "dismissed");
  }

  async dismissPendingForCommunication(input: {
    userId: string;
    communicationItemId: string;
    exceptId?: string;
  }): Promise<TopicSuggestion[]> {
    const snapshot = await this.collection()
      .where("userId", "==", input.userId)
      .where("communicationItemId", "==", input.communicationItemId)
      .where("status", "==", "pending")
      .limit(100)
      .get();
    const siblings = snapshot.docs
      .map((doc) => topicSuggestionFromFirestore(doc.id, doc.data()))
      .filter((suggestion) => suggestion.id !== input.exceptId);
    const now = new Date();
    const batch = this.firestore.batch();
    const dismissed = siblings.map((suggestion) => ({
      ...suggestion,
      status: "dismissed" as const,
      updatedAt: now,
      decidedAt: now
    }));
    for (const suggestion of dismissed) {
      batch.set(this.collection().doc(suggestion.id), removeUndefinedDeep(suggestion));
    }
    if (dismissed.length > 0) {
      await batch.commit();
    }
    return dismissed;
  }

  private async findPendingMatch(input: CreateTopicSuggestionInput): Promise<TopicSuggestion | undefined> {
    const query = this.collection()
      .where("userId", "==", input.userId)
      .where("communicationItemId", "==", input.communicationItemId)
      .where("status", "==", "pending");

    const snapshot = await query.limit(1).get();
    const doc = snapshot.docs[0];
    return doc ? topicSuggestionFromFirestore(doc.id, doc.data()) : undefined;
  }

  private async decide(id: string, status: "accepted" | "dismissed"): Promise<TopicSuggestion | undefined> {
    const existing = await this.get(id);
    if (!existing) {
      return undefined;
    }

    const now = new Date();
    const updated = { ...existing, status, updatedAt: now, decidedAt: now };
    await this.collection().doc(id).set(removeUndefinedDeep(updated));
    return updated;
  }

  private collection() {
    return this.firestore.collection(COLLECTION);
  }
}

function topicSuggestionFromFirestore(id: string, data: Record<string, unknown>): TopicSuggestion {
  return {
    id,
    userId: getString(data.userId) ?? "",
    communicationItemId: getString(data.communicationItemId) ?? "",
    targetType: targetType(data.targetType),
    suggestedTopicThreadId: getString(data.suggestedTopicThreadId),
    suggestedTitle: getString(data.suggestedTitle),
    suggestedDescription: getString(data.suggestedDescription),
    confidence: typeof data.confidence === "number" ? data.confidence : 0,
    reason: getString(data.reason) ?? "",
    evidence: stringArray(data.evidence),
    status: status(data.status),
    createdAt: firestoreDate(data.createdAt) ?? new Date(0),
    updatedAt: firestoreDate(data.updatedAt) ?? new Date(0),
    decidedAt: firestoreDate(data.decidedAt)
  };
}

function targetType(value: unknown): TopicSuggestionTargetType {
  return value === "new_topic" ? "new_topic" : "existing_topic";
}

function status(value: unknown): TopicSuggestionStatus {
  return value === "accepted" || value === "dismissed" ? value : "pending";
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function stableSuggestionId(input: CreateTopicSuggestionInput): string {
  if (!input.userId || !input.communicationItemId) {
    return randomUUID();
  }
  const hash = createHash("sha256")
    .update(`${input.userId}:${input.communicationItemId}`)
    .digest("hex")
    .slice(0, 32);
  return `communication_${hash}`;
}
