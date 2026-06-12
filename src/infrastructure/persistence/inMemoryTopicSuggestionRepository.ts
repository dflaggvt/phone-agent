import { randomUUID } from "node:crypto";
import type {
  CreateTopicSuggestionInput,
  TopicSuggestion,
  TopicSuggestionRepository
} from "../../domain/topics/topicSuggestion.js";

export class InMemoryTopicSuggestionRepository implements TopicSuggestionRepository {
  private readonly suggestions = new Map<string, TopicSuggestion>();

  async upsertPending(input: CreateTopicSuggestionInput): Promise<TopicSuggestion> {
    const existing = this.findPendingForCommunication(input.userId, input.communicationItemId);
    const now = new Date();
    const suggestion: TopicSuggestion = {
      id: existing?.id ?? randomUUID(),
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
    this.suggestions.set(suggestion.id, suggestion);
    return suggestion;
  }

  async get(id: string): Promise<TopicSuggestion | undefined> {
    return this.suggestions.get(id);
  }

  async listForCommunication(userId: string, communicationItemId: string): Promise<TopicSuggestion[]> {
    return [...this.suggestions.values()]
      .filter((suggestion) =>
        suggestion.userId === userId
        && suggestion.communicationItemId === communicationItemId
      )
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async listPendingForUser(userId: string): Promise<TopicSuggestion[]> {
    return [...this.suggestions.values()]
      .filter((suggestion) => suggestion.userId === userId && suggestion.status === "pending")
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
    const siblings = [...this.suggestions.values()].filter((suggestion) =>
      suggestion.status === "pending"
      && suggestion.userId === input.userId
      && suggestion.communicationItemId === input.communicationItemId
      && suggestion.id !== input.exceptId
    );
    const dismissed: TopicSuggestion[] = [];
    for (const sibling of siblings) {
      const updated = await this.decide(sibling.id, "dismissed");
      if (updated) {
        dismissed.push(updated);
      }
    }
    return dismissed;
  }

  private findPendingForCommunication(userId: string, communicationItemId: string): TopicSuggestion | undefined {
    return [...this.suggestions.values()].find((suggestion) =>
      suggestion.status === "pending"
      && suggestion.userId === userId
      && suggestion.communicationItemId === communicationItemId
    );
  }

  private async decide(id: string, status: "accepted" | "dismissed"): Promise<TopicSuggestion | undefined> {
    const existing = this.suggestions.get(id);
    if (!existing) {
      return undefined;
    }

    const now = new Date();
    const updated = { ...existing, status, updatedAt: now, decidedAt: now };
    this.suggestions.set(id, updated);
    return updated;
  }
}
