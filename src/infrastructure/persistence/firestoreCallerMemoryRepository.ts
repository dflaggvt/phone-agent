import { createHash, randomUUID } from "node:crypto";
import type { Firestore } from "@google-cloud/firestore";
import {
  type AgentContextPack,
  type CallerMemory,
  type CallerMemoryRepository,
  type CallerProfile,
  type CallerTrustLevel,
  type MemoryUpsertInput,
  type RelationshipLabel
} from "../../domain/callers/callerMemory.js";
import { firestoreDate, removeUndefinedDeep } from "./firestoreClient.js";

const CALLER_COLLECTION = "callerProfiles";

export class FirestoreCallerMemoryRepository implements CallerMemoryRepository {
  constructor(private readonly firestore: Firestore) {}

  async findByPhoneNumber(userId: string, phoneNumber: string): Promise<CallerProfile | undefined> {
    const normalized = normalizePhoneNumber(phoneNumber);
    const direct = await this.firestore.collection(CALLER_COLLECTION).doc(profileIdForPhoneNumber(userId, normalized)).get();
    if (direct.exists) {
      return callerProfileFromFirestore(direct.id, direct.data() ?? {});
    }

    const snapshot = await this.firestore
      .collection(CALLER_COLLECTION)
      .where("userId", "==", userId)
      .where("phoneNumbers", "array-contains", normalized)
      .limit(1)
      .get();
    const doc = snapshot.docs[0];
    if (doc) {
      return callerProfileFromFirestore(doc.id, doc.data());
    }

    return undefined;
  }

  async listProfiles(userId: string): Promise<CallerProfile[]> {
    const snapshot = await this.firestore
      .collection(CALLER_COLLECTION)
      .where("userId", "==", userId)
      .limit(300)
      .get();
    return snapshot.docs
      .map((doc) => callerProfileFromFirestore(doc.id, doc.data()))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 100);
  }

  async getProfile(userId: string, id: string): Promise<CallerProfile | undefined> {
    const doc = await this.firestore.collection(CALLER_COLLECTION).doc(id).get();
    if (!doc.exists) {
      return undefined;
    }
    const profile = callerProfileFromFirestore(doc.id, doc.data() ?? {});
    return profile.userId === userId ? profile : undefined;
  }

  async upsertFromCall(input: MemoryUpsertInput): Promise<CallerProfile> {
    const normalized = normalizePhoneNumber(input.phoneNumber);
    const docRef = this.firestore.collection(CALLER_COLLECTION).doc(profileIdForPhoneNumber(input.userId, normalized));

    return this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(docRef);
      const existing = snapshot.exists ? callerProfileFromFirestore(snapshot.id, snapshot.data() ?? {}) : undefined;
      const profile = mergeCallIntoProfile(input, normalized, existing);
      transaction.set(docRef, removeUndefinedDeep(profile));
      return profile;
    });
  }

  async updateProfile(
    userId: string,
    id: string,
    input: Partial<Pick<CallerProfile, "displayName" | "organization" | "relationship" | "trustLevel">>
  ): Promise<CallerProfile | undefined> {
    const docRef = this.firestore.collection(CALLER_COLLECTION).doc(id);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      return undefined;
    }

    const existing = callerProfileFromFirestore(snapshot.id, snapshot.data() ?? {});
    if (existing.userId !== userId) {
      return undefined;
    }
    const relationship = input.relationship ?? existing.relationship;
    const updated: CallerProfile = {
      ...existing,
      displayName: input.displayName ?? existing.displayName,
      organization: input.organization ?? existing.organization,
      relationship,
      trustLevel: input.trustLevel ?? existing.trustLevel ?? trustLevelForRelationship(relationship),
      updatedAt: new Date()
    };
    await docRef.set(removeUndefinedDeep(updated));
    return updated;
  }

  async buildContextPack(userId: string, phoneNumber: string): Promise<AgentContextPack> {
    const profile = await this.findByPhoneNumber(userId, phoneNumber);
    if (!profile) {
      return {
        identitySource: "unknown",
        knownCaller: false,
        relationship: "unknown",
        trustLevel: "unknown",
        priorCallCount: 0,
        approvedFacts: [],
        openFollowUps: [],
        suggestedTone: "Polite, brief, and clarifying. Ask who is calling and why.",
        routingGuidance: "Treat as an unknown caller. Determine identity, intent, and urgency before escalating.",
        redLines: ["Do not claim to know the caller.", "Do not share private user information."]
      };
    }

    const approvedMemories = profile.memories.filter((memory) => memory.approved && !memory.sensitive);
    return {
      callerProfileId: profile.id,
      identitySource: "caller_memory",
      knownCaller: true,
      callerName: profile.displayName,
      organization: profile.organization,
      relationship: profile.relationship,
      trustLevel: profile.trustLevel,
      priorCallCount: profile.callCount,
      lastCallSummary: profile.lastCallSummary,
      lastIntent: profile.lastIntent,
      approvedFacts: approvedMemories.filter((memory) => memory.type === "fact").slice(-6).map((memory) => memory.text),
      openFollowUps: approvedMemories.filter((memory) => memory.type === "open_follow_up").slice(-5).map((memory) => memory.text),
      suggestedTone: toneForRelationship(profile.relationship),
      routingGuidance: routingForRelationship(profile.relationship, profile.trustLevel),
      redLines: [
        "Do not reveal private facts unless the caller clearly already knows them.",
        "Do not make commitments for the user.",
        "If memory seems stale or the caller contradicts it, ask a clarifying question."
      ]
    };
  }
}

function mergeCallIntoProfile(
  input: MemoryUpsertInput,
  normalizedPhoneNumber: string,
  existing: CallerProfile | undefined
): CallerProfile {
  const now = new Date();
  const relationship = input.relationship ?? existing?.relationship ?? "unknown";
  const trustLevel = input.trustLevel ?? existing?.trustLevel ?? trustLevelForRelationship(relationship);
  const memories = existing?.memories ? [...existing.memories] : [];
  const displayName = input.displayNameSource === "contact"
    ? input.displayName ?? existing?.displayName
    : existing?.displayName ?? input.displayName;

  for (const fact of input.facts ?? []) {
    addMemory(memories, {
      type: "fact",
      text: fact,
      sourceCallId: input.sourceCallId,
      confidence: 0.8,
      approved: !isSensitiveFact(fact),
      sensitive: isSensitiveFact(fact),
      now
    });
  }

  for (const followUp of input.openFollowUps ?? []) {
    addMemory(memories, {
      type: "open_follow_up",
      text: followUp,
      sourceCallId: input.sourceCallId,
      confidence: 0.85,
      approved: true,
      sensitive: false,
      now
    });
  }

  if (input.lastCallSummary) {
    addMemory(memories, {
      type: "prior_summary",
      text: input.lastCallSummary,
      sourceCallId: input.sourceCallId,
      confidence: 0.9,
      approved: true,
      sensitive: false,
      now
    });
  }

  return {
    id: existing?.id ?? profileIdForPhoneNumber(input.userId, normalizedPhoneNumber),
    userId: input.userId,
    primaryPhoneNumber: existing?.primaryPhoneNumber ?? normalizedPhoneNumber,
    phoneNumbers: existing?.phoneNumbers ?? [normalizedPhoneNumber],
    displayName,
    organization: input.organization ?? existing?.organization,
    relationship,
    trustLevel,
    lastIntent: input.lastIntent ?? existing?.lastIntent,
    lastCallSummary: input.lastCallSummary ?? existing?.lastCallSummary,
    lastCallAt: input.lastCallAt ?? existing?.lastCallAt,
    callCount: (existing?.callCount ?? 0) + 1,
    memories: memories.slice(-25),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };
}

function callerProfileFromFirestore(id: string, data: Record<string, unknown>): CallerProfile {
  return {
    id: getString(data.id) ?? id,
    userId: getString(data.userId) ?? "",
    primaryPhoneNumber: getString(data.primaryPhoneNumber) ?? "",
    phoneNumbers: Array.isArray(data.phoneNumbers) ? data.phoneNumbers.filter(isString) : [],
    displayName: getString(data.displayName),
    organization: getString(data.organization),
    relationship: relationshipLabel(data.relationship),
    trustLevel: trustLevel(data.trustLevel),
    lastIntent: getString(data.lastIntent),
    lastCallSummary: getString(data.lastCallSummary),
    lastCallAt: firestoreDate(data.lastCallAt),
    callCount: typeof data.callCount === "number" ? data.callCount : 0,
    memories: Array.isArray(data.memories) ? data.memories.map(callerMemoryFromFirestore).filter(isCallerMemory) : [],
    createdAt: firestoreDate(data.createdAt) ?? new Date(0),
    updatedAt: firestoreDate(data.updatedAt) ?? new Date(0)
  };
}

function callerMemoryFromFirestore(value: unknown): CallerMemory | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const data = value as Record<string, unknown>;
  const text = getString(data.text);
  if (!text) {
    return undefined;
  }

  return {
    id: getString(data.id) ?? randomUUID(),
    type: memoryType(data.type),
    text,
    sourceCallId: getString(data.sourceCallId),
    confidence: typeof data.confidence === "number" ? data.confidence : 0.5,
    approved: data.approved === true,
    sensitive: data.sensitive === true,
    createdAt: firestoreDate(data.createdAt) ?? new Date(0),
    updatedAt: firestoreDate(data.updatedAt) ?? new Date(0)
  };
}

function addMemory(
  memories: CallerMemory[],
  input: {
    type: CallerMemory["type"];
    text: string;
    sourceCallId?: string;
    confidence: number;
    approved: boolean;
    sensitive: boolean;
    now: Date;
  }
) {
  const text = input.text.trim();
  if (!text) {
    return;
  }

  const existing = memories.find((memory) => memory.type === input.type && memory.text.toLowerCase() === text.toLowerCase());
  if (existing) {
    existing.updatedAt = input.now;
    existing.confidence = Math.max(existing.confidence, input.confidence);
    return;
  }

  memories.push({
    id: randomUUID(),
    type: input.type,
    text,
    sourceCallId: input.sourceCallId,
    confidence: input.confidence,
    approved: input.approved,
    sensitive: input.sensitive,
    createdAt: input.now,
    updatedAt: input.now
  });
}

function profileIdForPhoneNumber(userId: string, phoneNumber: string): string {
  return `caller_${createHash("sha256").update(`${userId}:${phoneNumber}`).digest("base64url").slice(0, 32)}`;
}

function normalizePhoneNumber(phoneNumber: string): string {
  return phoneNumber.trim();
}

function relationshipLabel(value: unknown): RelationshipLabel {
  return value === "family" ||
    value === "close_friend" ||
    value === "coworker" ||
    value === "vendor" ||
    value === "healthcare" ||
    value === "school" ||
    value === "spam" ||
    value === "blocked"
    ? value
    : "unknown";
}

function trustLevel(value: unknown): CallerTrustLevel {
  return value === "trusted" || value === "standard" || value === "low" || value === "blocked" ? value : "unknown";
}

function memoryType(value: unknown): CallerMemory["type"] {
  return value === "preference" || value === "prior_summary" || value === "open_follow_up" ? value : "fact";
}

function trustLevelForRelationship(relationship: RelationshipLabel): CallerTrustLevel {
  if (relationship === "family" || relationship === "close_friend") {
    return "trusted";
  }
  if (relationship === "spam") {
    return "low";
  }
  if (relationship === "blocked") {
    return "blocked";
  }
  if (relationship === "unknown") {
    return "unknown";
  }
  return "standard";
}

function toneForRelationship(relationship: RelationshipLabel): string {
  switch (relationship) {
    case "family":
    case "close_friend":
      return "Warm, familiar, and low-friction. Escalate urgency quickly.";
    case "vendor":
      return "Efficient and specific. Capture logistics, timing, callback, and requested next step.";
    case "spam":
    case "blocked":
      return "Brief and bounded. Do not encourage a long conversation.";
    default:
      return "Polite, clear, and concise.";
  }
}

function routingForRelationship(relationship: RelationshipLabel, trustLevel: CallerTrustLevel): string {
  if (relationship === "family" || trustLevel === "trusted") {
    return "This is a trusted caller. If they express urgency, request live transfer quickly; otherwise capture a careful message.";
  }
  if (relationship === "blocked") {
    return "This caller is blocked. Avoid escalation unless there is clear emergency language.";
  }
  if (relationship === "spam" || trustLevel === "low") {
    return "This caller is low value or spam-like. Keep the interaction short and do not escalate without clear human urgency.";
  }
  return "Use normal screening. Determine caller identity, intent, urgency, and requested follow-up.";
}

function isSensitiveFact(fact: string): boolean {
  const lower = fact.toLowerCase();
  return ["medical", "health", "diagnosis", "legal", "attorney", "bank", "password", "ssn"].some((term) =>
    lower.includes(term)
  );
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isCallerMemory(value: CallerMemory | undefined): value is CallerMemory {
  return value !== undefined;
}
