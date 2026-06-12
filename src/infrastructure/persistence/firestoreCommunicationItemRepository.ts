import { randomUUID } from "node:crypto";
import { FieldPath, type Firestore } from "@google-cloud/firestore";
import type {
  CommunicationActor,
  CommunicationChannel,
  CommunicationDirection,
  CommunicationItem,
  CommunicationItemRepository,
  CreateCommunicationItemInput,
  SensitivityLevel,
  TopicAssociation,
  UpsertCommunicationItemFromProviderInput
} from "../../domain/communications/communicationItem.js";
import { firestoreDate, removeUndefinedDeep } from "./firestoreClient.js";

const COLLECTION = "communicationItems";

export class FirestoreCommunicationItemRepository implements CommunicationItemRepository {
  constructor(private readonly firestore: Firestore) {}

  async create(input: CreateCommunicationItemInput): Promise<CommunicationItem> {
    const item = buildCommunicationItem(randomUUID(), input);
    await this.collection().doc(item.id).set(removeUndefinedDeep(item));
    return item;
  }

  async upsertFromProvider(input: UpsertCommunicationItemFromProviderInput): Promise<CommunicationItem> {
    const existing = await this.findByProviderItem(input.sourceProvider, input.providerItemId);
    if (!existing) {
      return this.create(input);
    }

    const updated: CommunicationItem = {
      ...existing,
      sender: input.sender ?? existing.sender,
      recipients: input.recipients ?? existing.recipients,
      participants: input.participants ?? existing.participants,
      occurredAt: input.occurredAt ?? existing.occurredAt,
      receivedAt: input.receivedAt ?? existing.receivedAt,
      rawContentRef: input.rawContentRef ?? existing.rawContentRef,
      bodyText: input.bodyText ?? existing.bodyText,
      transcriptText: input.transcriptText ?? existing.transcriptText,
      summary: input.summary ?? existing.summary,
      sensitivity: input.sensitivity ?? existing.sensitivity,
      consentRequired: input.consentRequired ?? existing.consentRequired,
      retentionPolicyId: input.retentionPolicyId ?? existing.retentionPolicyId,
      updatedAt: new Date()
    };
    await this.collection().doc(updated.id).set(removeUndefinedDeep(updated));
    return updated;
  }

  async get(id: string): Promise<CommunicationItem | undefined> {
    const doc = await this.collection().doc(id).get();
    return doc.exists ? communicationItemFromFirestore(doc.id, doc.data() ?? {}) : undefined;
  }

  async listByIdsForUser(userId: string, ids: string[]): Promise<CommunicationItem[]> {
    const uniqueIds = [...new Set(ids.filter((id) => id.length > 0))];
    if (uniqueIds.length === 0) {
      return [];
    }

    const items: CommunicationItem[] = [];
    for (let index = 0; index < uniqueIds.length; index += 30) {
      const chunk = uniqueIds.slice(index, index + 30);
      const snapshot = await this.collection()
        .where(FieldPath.documentId(), "in", chunk)
        .get();
      items.push(...snapshot.docs.map((doc) => communicationItemFromFirestore(doc.id, doc.data())));
    }

    return items
      .filter((item) => item.userId === userId)
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  }

  async findByProviderItem(sourceProvider: string, providerItemId: string): Promise<CommunicationItem | undefined> {
    const snapshot = await this.collection()
      .where("sourceProvider", "==", sourceProvider)
      .where("providerItemId", "==", providerItemId)
      .limit(1)
      .get();
    const doc = snapshot.docs[0];
    return doc ? communicationItemFromFirestore(doc.id, doc.data()) : undefined;
  }

  async listRecentForUser(userId: string, limit = 50): Promise<CommunicationItem[]> {
    const snapshot = await this.collection().where("userId", "==", userId).limit(Math.max(limit, 100)).get();
    return snapshot.docs
      .map((doc) => communicationItemFromFirestore(doc.id, doc.data()))
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
      .slice(0, limit);
  }

  async updateExtractions(
    communicationItemId: string,
    input: {
      extractedFacts?: CommunicationItem["extractedFacts"];
      extractedTasks?: CommunicationItem["extractedTasks"];
      extractedDecisions?: CommunicationItem["extractedDecisions"];
      extractedOpenQuestions?: CommunicationItem["extractedOpenQuestions"];
    }
  ): Promise<CommunicationItem | undefined> {
    const existing = await this.get(communicationItemId);
    if (!existing) {
      return undefined;
    }

    const updated: CommunicationItem = {
      ...existing,
      extractedFacts: input.extractedFacts ?? existing.extractedFacts,
      extractedTasks: input.extractedTasks ?? existing.extractedTasks,
      extractedDecisions: input.extractedDecisions ?? existing.extractedDecisions,
      extractedOpenQuestions: input.extractedOpenQuestions ?? existing.extractedOpenQuestions,
      updatedAt: new Date()
    };
    await this.collection().doc(updated.id).set(removeUndefinedDeep(updated));
    return updated;
  }

  async attachToTopic(input: {
    communicationItemId: string;
    topicThreadId: string;
    confidence: number;
    mode: TopicAssociation["mode"];
    reason?: string;
  }): Promise<CommunicationItem | undefined> {
    const existing = await this.get(input.communicationItemId);
    if (!existing) {
      return undefined;
    }
    const now = new Date();
    const updated = {
      ...existing,
      topicAssociations: [
        ...existing.topicAssociations.filter((association) => association.topicThreadId !== input.topicThreadId),
        {
          topicThreadId: input.topicThreadId,
          confidence: input.confidence,
          mode: input.mode,
          reason: input.reason,
          attachedAt: now
        }
      ],
      updatedAt: now
    };
    await this.collection().doc(updated.id).set(removeUndefinedDeep(updated));
    return updated;
  }

  private collection() {
    return this.firestore.collection(COLLECTION);
  }
}

function buildCommunicationItem(id: string, input: CreateCommunicationItemInput): CommunicationItem {
  const now = new Date();
  const occurredAt = input.occurredAt ?? now;
  const participants = input.participants ?? [input.sender, ...(input.recipients ?? [])].filter((actor) => actor !== undefined);
  return {
    id,
    userId: input.userId,
    channel: input.channel,
    direction: input.direction,
    sourceProvider: input.sourceProvider,
    providerItemId: input.providerItemId,
    sender: input.sender,
    recipients: input.recipients ?? [],
    participants,
    occurredAt,
    receivedAt: input.receivedAt ?? now,
    rawContentRef: input.rawContentRef,
    bodyText: input.bodyText,
    transcriptText: input.transcriptText,
    summary: input.summary,
    extractedFacts: [],
    extractedTasks: [],
    extractedDecisions: [],
    extractedOpenQuestions: [],
    topicAssociations: [],
    sensitivity: input.sensitivity ?? "unknown",
    consentRequired: input.consentRequired ?? false,
    retentionPolicyId: input.retentionPolicyId,
    createdAt: now,
    updatedAt: now
  };
}

function communicationItemFromFirestore(id: string, data: Record<string, unknown>): CommunicationItem {
  return {
    id,
    userId: getString(data.userId) ?? "",
    channel: communicationChannel(data.channel),
    direction: communicationDirection(data.direction),
    sourceProvider: getString(data.sourceProvider) ?? "unknown",
    providerItemId: getString(data.providerItemId),
    sender: actor(data.sender),
    recipients: actorArray(data.recipients),
    participants: actorArray(data.participants),
    occurredAt: firestoreDate(data.occurredAt) ?? new Date(0),
    receivedAt: firestoreDate(data.receivedAt) ?? new Date(0),
    rawContentRef: getRecord(data.rawContentRef) as CommunicationItem["rawContentRef"],
    bodyText: getString(data.bodyText),
    transcriptText: getString(data.transcriptText),
    summary: getString(data.summary),
    extractedFacts: Array.isArray(data.extractedFacts) ? data.extractedFacts as CommunicationItem["extractedFacts"] : [],
    extractedTasks: Array.isArray(data.extractedTasks) ? data.extractedTasks as CommunicationItem["extractedTasks"] : [],
    extractedDecisions: Array.isArray(data.extractedDecisions) ? data.extractedDecisions as CommunicationItem["extractedDecisions"] : [],
    extractedOpenQuestions: Array.isArray(data.extractedOpenQuestions) ? data.extractedOpenQuestions as CommunicationItem["extractedOpenQuestions"] : [],
    topicAssociations: Array.isArray(data.topicAssociations) ? data.topicAssociations as TopicAssociation[] : [],
    sensitivity: sensitivityLevel(data.sensitivity),
    consentRequired: data.consentRequired === true,
    retentionPolicyId: getString(data.retentionPolicyId),
    createdAt: firestoreDate(data.createdAt) ?? new Date(0),
    updatedAt: firestoreDate(data.updatedAt) ?? new Date(0)
  };
}

function communicationChannel(value: unknown): CommunicationChannel {
  return value === "sms" || value === "email" || value === "calendar_event" || value === "document" || value === "manual_note" || value === "agent_message"
    ? value
    : "phone_call";
}

function communicationDirection(value: unknown): CommunicationDirection {
  return value === "outbound" || value === "internal" ? value : "inbound";
}

function sensitivityLevel(value: unknown): SensitivityLevel {
  return value === "normal" || value === "sensitive" || value === "restricted" ? value : "unknown";
}

function actor(value: unknown): CommunicationActor | undefined {
  return getRecord(value) as CommunicationActor | undefined;
}

function actorArray(value: unknown): CommunicationActor[] {
  return Array.isArray(value) ? value.filter((item) => typeof item === "object" && item !== null) as CommunicationActor[] : [];
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? value as Record<string, unknown> : undefined;
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
