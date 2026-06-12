import { randomUUID } from "node:crypto";
import type {
  CommunicationItem,
  CommunicationItemRepository,
  CreateCommunicationItemInput,
  TopicAssociation,
  UpsertCommunicationItemFromProviderInput
} from "../../domain/communications/communicationItem.js";

export class InMemoryCommunicationItemRepository implements CommunicationItemRepository {
  private readonly items = new Map<string, CommunicationItem>();
  private readonly providerIndex = new Map<string, string>();

  async create(input: CreateCommunicationItemInput): Promise<CommunicationItem> {
    const item = buildCommunicationItem(randomUUID(), input);
    this.items.set(item.id, item);
    if (item.providerItemId) {
      this.providerIndex.set(providerKey(item.sourceProvider, item.providerItemId), item.id);
    }
    return item;
  }

  async upsertFromProvider(input: UpsertCommunicationItemFromProviderInput): Promise<CommunicationItem> {
    const existing = await this.findByProviderItem(input.sourceProvider, input.providerItemId);
    if (!existing) {
      return this.create(input);
    }

    const now = new Date();
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
      updatedAt: now
    };
    this.items.set(updated.id, updated);
    return updated;
  }

  async get(id: string): Promise<CommunicationItem | undefined> {
    return this.items.get(id);
  }

  async listByIdsForUser(userId: string, ids: string[]): Promise<CommunicationItem[]> {
    const uniqueIds = [...new Set(ids)];
    return uniqueIds
      .map((id) => this.items.get(id))
      .filter((item): item is CommunicationItem => item !== undefined && item.userId === userId);
  }

  async findByProviderItem(sourceProvider: string, providerItemId: string): Promise<CommunicationItem | undefined> {
    const id = this.providerIndex.get(providerKey(sourceProvider, providerItemId));
    return id ? this.items.get(id) : undefined;
  }

  async listRecentForUser(userId: string, limit = 50): Promise<CommunicationItem[]> {
    return [...this.items.values()]
      .filter((item) => item.userId === userId)
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
    const existing = this.items.get(communicationItemId);
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
    this.items.set(updated.id, updated);
    return updated;
  }

  async attachToTopic(input: {
    communicationItemId: string;
    topicThreadId: string;
    confidence: number;
    mode: TopicAssociation["mode"];
    reason?: string;
  }): Promise<CommunicationItem | undefined> {
    const existing = this.items.get(input.communicationItemId);
    if (!existing) {
      return undefined;
    }

    const now = new Date();
    const nextAssociations = [
      ...existing.topicAssociations.filter((association) => association.topicThreadId !== input.topicThreadId),
      {
        topicThreadId: input.topicThreadId,
        confidence: input.confidence,
        mode: input.mode,
        reason: input.reason,
        attachedAt: now
      }
    ];
    const updated = { ...existing, topicAssociations: nextAssociations, updatedAt: now };
    this.items.set(updated.id, updated);
    return updated;
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

function providerKey(sourceProvider: string, providerItemId: string): string {
  return `${sourceProvider}:${providerItemId}`;
}
