import { randomUUID } from "node:crypto";
import type {
  CreateTopicSuggestionInput,
  TopicSuggestion,
  TopicSuggestionRepository
} from "../../domain/topics/topicSuggestion.js";

export class InMemoryTopicSuggestionRepository implements TopicSuggestionRepository {
  private readonly suggestions = new Map<string, TopicSuggestion>();

  async upsertPending(input: CreateTopicSuggestionInput): Promise<TopicSuggestion> {
    const existing = this.findPendingMatch(input);
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

  private findPendingMatch(input: CreateTopicSuggestionInput): TopicSuggestion | undefined {
    return [...this.suggestions.values()].find((suggestion) =>
      suggestion.status === "pending"
      && suggestion.userId === input.userId
      && suggestion.communicationItemId === input.communicationItemId
      && suggestion.targetType === input.targetType
      && (suggestion.suggestedTopicThreadId ?? "") === (input.suggestedTopicThreadId ?? "")
      && (suggestion.suggestedTitle ?? "") === (input.suggestedTitle ?? "")
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
