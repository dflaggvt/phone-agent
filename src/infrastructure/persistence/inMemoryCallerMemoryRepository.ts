import { randomUUID } from "node:crypto";
import {
  type AgentContextPack,
  type CallerMemory,
  type CallerMemoryRepository,
  type CallerProfile,
  type CallerTrustLevel,
  type MemoryUpsertInput,
  type RelationshipLabel
} from "../../domain/callers/callerMemory.js";

export class InMemoryCallerMemoryRepository implements CallerMemoryRepository {
  private readonly profiles = new Map<string, CallerProfile>();
  private readonly phoneIndex = new Map<string, string>();

  async findByPhoneNumber(userId: string, phoneNumber: string): Promise<CallerProfile | undefined> {
    const normalized = normalizePhoneNumber(phoneNumber);
    const id = this.phoneIndex.get(phoneIndexKey(userId, normalized));
    return id ? this.profiles.get(id) : undefined;
  }

  async listProfiles(userId: string): Promise<CallerProfile[]> {
    return [...this.profiles.values()]
      .filter((profile) => profile.userId === userId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async getProfile(userId: string, id: string): Promise<CallerProfile | undefined> {
    const profile = this.profiles.get(id);
    return profile?.userId === userId ? profile : undefined;
  }

  async upsertFromCall(input: MemoryUpsertInput): Promise<CallerProfile> {
    const normalized = normalizePhoneNumber(input.phoneNumber);
    const now = new Date();
    const existing = await this.findByPhoneNumber(input.userId, normalized);
    const relationship = input.relationship ?? existing?.relationship ?? "unknown";
    const trustLevel = input.trustLevel ?? existing?.trustLevel ?? trustLevelForRelationship(relationship);
    const memories = existing?.memories ? [...existing.memories] : [];

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

    const profile: CallerProfile = {
      id: existing?.id ?? randomUUID(),
      userId: input.userId,
      primaryPhoneNumber: existing?.primaryPhoneNumber ?? normalized,
      phoneNumbers: existing?.phoneNumbers ?? [normalized],
      displayName: input.displayName ?? existing?.displayName,
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

    this.profiles.set(profile.id, profile);
    for (const phoneNumber of profile.phoneNumbers) {
      this.phoneIndex.set(phoneIndexKey(profile.userId, normalizePhoneNumber(phoneNumber)), profile.id);
    }

    return profile;
  }

  async updateProfile(
    userId: string,
    id: string,
    input: Partial<Pick<CallerProfile, "displayName" | "organization" | "relationship" | "trustLevel">>
  ): Promise<CallerProfile | undefined> {
    const existing = this.profiles.get(id);
    if (!existing || existing.userId !== userId) {
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
    this.profiles.set(id, updated);
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

function normalizePhoneNumber(phoneNumber: string): string {
  return phoneNumber.trim();
}

function phoneIndexKey(userId: string, phoneNumber: string): string {
  return `${userId}:${phoneNumber}`;
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
