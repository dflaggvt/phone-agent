import type {
  CommunicationItem,
  CommunicationItemRepository,
  ExtractedDecision,
  ExtractedFact,
  ExtractedOpenQuestion,
  ExtractedTask
} from "../../domain/communications/communicationItem.js";
import type { CommunicationClassifier, CommunicationClassificationResult } from "../../domain/topics/communicationClassifier.js";
import type {
  TopicSuggestion,
  TopicSuggestionListItem,
  TopicSuggestionRepository
} from "../../domain/topics/topicSuggestion.js";
import type { TopicThread, TopicThreadRepository } from "../../domain/topics/topicThread.js";
import type { UsageService } from "../billing/usageService.js";
import type { NotificationService } from "../notifications/notificationService.js";
import type { AppLogger } from "../../shared/logger.js";

export class TopicSuggestionService {
  constructor(
    private readonly dependencies: {
      suggestions: TopicSuggestionRepository;
      topics: TopicThreadRepository;
      communicationItems: CommunicationItemRepository;
      classifier?: CommunicationClassifier;
      usage?: UsageService;
      notifications?: NotificationService;
      logger?: AppLogger;
    }
  ) {}

  async listPending(userId: string): Promise<TopicSuggestionListItem[]> {
    const suggestions = await this.dependencies.suggestions.listPendingForUser(userId);
    return Promise.all(collapsePendingSuggestions(suggestions).map((suggestion) => this.enrichSuggestion(suggestion)));
  }

  async analyzeCommunication(item: CommunicationItem): Promise<TopicSuggestion[]> {
    if (item.topicAssociations.length > 0) {
      return [];
    }

    const topics = await this.dependencies.topics.listForUser(item.userId);
    const classified = await this.classifyWithProvider(item, topics);
    if (classified) {
      await this.updateExtractions(item, classified);
      return this.createSuggestionFromClassification(item, classified);
    }

    return [];
  }

  async acceptSuggestion(id: string, userId?: string): Promise<{ suggestion: TopicSuggestion; topic: TopicThread } | undefined> {
    const existing = await this.dependencies.suggestions.get(id);
    if (!existing || existing.status !== "pending") {
      return undefined;
    }
    if (userId && existing.userId !== userId) {
      return undefined;
    }

    const communication = await this.dependencies.communicationItems.get(existing.communicationItemId);
    if (!communication) {
      return undefined;
    }

    const topic = existing.targetType === "existing_topic"
      ? await this.getSuggestedExistingTopic(existing)
      : await this.dependencies.topics.create({
        userId: existing.userId,
        title: existing.suggestedTitle ?? "New topic",
        description: existing.suggestedDescription
      });

    if (!topic) {
      return undefined;
    }

    const attachedTopic = await this.dependencies.topics.attachCommunication(topic.id, communication.id);
    await this.dependencies.communicationItems.attachToTopic({
      communicationItemId: communication.id,
      topicThreadId: topic.id,
      confidence: existing.confidence,
      mode: "manual",
      reason: `Accepted suggestion: ${existing.reason}`
    });
    const accepted = await this.dependencies.suggestions.accept(id);
    await this.dependencies.suggestions.dismissPendingForCommunication({
      userId: existing.userId,
      communicationItemId: existing.communicationItemId,
      exceptId: id
    });
    return accepted ? { suggestion: accepted, topic: attachedTopic ?? topic } : undefined;
  }

  async dismissSuggestion(id: string, userId?: string): Promise<TopicSuggestion | undefined> {
    const existing = await this.dependencies.suggestions.get(id);
    if (!existing || (userId && existing.userId !== userId)) {
      return undefined;
    }
    const dismissed = await this.dependencies.suggestions.dismiss(id);
    await this.dependencies.suggestions.dismissPendingForCommunication({
      userId: existing.userId,
      communicationItemId: existing.communicationItemId,
      exceptId: id
    });
    return dismissed;
  }

  private async getSuggestedExistingTopic(suggestion: TopicSuggestion): Promise<TopicThread | undefined> {
    return suggestion.suggestedTopicThreadId
      ? this.dependencies.topics.get(suggestion.suggestedTopicThreadId)
      : undefined;
  }

  private async enrichSuggestion(suggestion: TopicSuggestion): Promise<TopicSuggestionListItem> {
    const [communication, targetTopic] = await Promise.all([
      this.dependencies.communicationItems.get(suggestion.communicationItemId),
      suggestion.suggestedTopicThreadId ? this.dependencies.topics.get(suggestion.suggestedTopicThreadId) : undefined
    ]);

    return {
      ...suggestion,
      suggestedTopicTitle: suggestion.suggestedTitle ?? targetTopic?.title ?? "Suggested topic",
      sourceCommunication: communication ? summarizeSourceCommunication(communication) : undefined
    };
  }

  private async classifyWithProvider(item: CommunicationItem, topics: TopicThread[]): Promise<CommunicationClassificationResult | undefined> {
    if (!this.dependencies.classifier) {
      return undefined;
    }

    try {
      if (this.dependencies.usage && !(await this.dependencies.usage.canClassify(item.userId))) {
        this.dependencies.logger?.warn(
          { communicationItemId: item.id, userId: item.userId },
          "communication classifier skipped because usage limit is exhausted"
        );
        return undefined;
      }
      await this.dependencies.usage?.recordClassification({
        userId: item.userId,
        sourceId: item.id,
        provider: "openai"
      });
      return await this.dependencies.classifier.classify({
        communicationItem: item,
        candidateTopics: topics
      });
    } catch (error) {
      this.dependencies.logger?.warn(
        {
          error,
          communicationItemId: item.id,
          sourceProvider: item.sourceProvider
        },
        "communication classifier failed; leaving communication unassigned"
      );
      return undefined;
    }
  }

  private async createSuggestionFromClassification(
    item: CommunicationItem,
    classification: CommunicationClassificationResult
  ): Promise<TopicSuggestion[]> {
    if (classification.topicAction === "no_topic" || classification.confidence < 0.35) {
      return [];
    }

    const priorSuggestions = await this.dependencies.suggestions.listForCommunication(item.userId, item.id);
    if (priorSuggestions.some((suggestion) => suggestion.status === "accepted" || suggestion.status === "dismissed")) {
      return [];
    }
    const hadPendingSuggestion = priorSuggestions.some((suggestion) => suggestion.status === "pending");

    if (classification.topicAction === "existing_topic" && classification.existingTopicThreadId) {
      const suggestion = await this.dependencies.suggestions.upsertPending({
        userId: item.userId,
        communicationItemId: item.id,
        targetType: "existing_topic",
        suggestedTopicThreadId: classification.existingTopicThreadId,
        confidence: classification.confidence,
        reason: classification.reason,
        evidence: classification.evidence
      });
      await this.afterUpsertedSuggestion(suggestion, hadPendingSuggestion);
      return [suggestion];
    }

    if (classification.topicAction === "new_topic" && classification.proposedTopicTitle) {
      const suggestion = await this.dependencies.suggestions.upsertPending({
        userId: item.userId,
        communicationItemId: item.id,
        targetType: "new_topic",
        suggestedTitle: classification.proposedTopicTitle,
        suggestedDescription: classification.proposedTopicDescription,
        confidence: classification.confidence,
        reason: classification.reason,
        evidence: classification.evidence
      });
      await this.afterUpsertedSuggestion(suggestion, hadPendingSuggestion);
      return [suggestion];
    }

    return [];
  }

  private async afterUpsertedSuggestion(suggestion: TopicSuggestion, hadPendingSuggestion: boolean): Promise<void> {
    await this.dependencies.suggestions.dismissPendingForCommunication({
      userId: suggestion.userId,
      communicationItemId: suggestion.communicationItemId,
      exceptId: suggestion.id
    });
    if (!hadPendingSuggestion) {
      await this.dependencies.notifications?.createTopicSuggestion({
        userId: suggestion.userId,
        suggestionId: suggestion.id,
        confidence: suggestion.confidence
      });
    }
  }

  private async updateExtractions(
    item: CommunicationItem,
    extracted: {
      extractedFacts?: ExtractedFact[];
      extractedDecisions: ExtractedDecision[];
      extractedOpenQuestions: ExtractedOpenQuestion[];
      extractedTasks: ExtractedTask[];
    }
  ): Promise<void> {
    if (
      (extracted.extractedFacts?.length ?? 0) === 0
      && extracted.extractedDecisions.length === 0
      && extracted.extractedOpenQuestions.length === 0
      && extracted.extractedTasks.length === 0
    ) {
      return;
    }

    await this.dependencies.communicationItems.updateExtractions(item.id, {
      extractedFacts: extracted.extractedFacts,
      extractedDecisions: extracted.extractedDecisions,
      extractedOpenQuestions: extracted.extractedOpenQuestions,
      extractedTasks: extracted.extractedTasks
    });
  }
}

function collapsePendingSuggestions(suggestions: TopicSuggestion[]): TopicSuggestion[] {
  const bestByCommunication = new Map<string, TopicSuggestion>();
  for (const suggestion of suggestions) {
    const existing = bestByCommunication.get(suggestion.communicationItemId);
    if (!existing || isBetterVisibleSuggestion(suggestion, existing)) {
      bestByCommunication.set(suggestion.communicationItemId, suggestion);
    }
  }
  return [...bestByCommunication.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

function isBetterVisibleSuggestion(candidate: TopicSuggestion, current: TopicSuggestion): boolean {
  const candidateTargetRank = candidate.targetType === "existing_topic" ? 1 : 0;
  const currentTargetRank = current.targetType === "existing_topic" ? 1 : 0;
  if (candidateTargetRank !== currentTargetRank) {
    return candidateTargetRank > currentTargetRank;
  }
  if (candidate.confidence !== current.confidence) {
    return candidate.confidence > current.confidence;
  }
  if (candidate.updatedAt.getTime() !== current.updatedAt.getTime()) {
    return candidate.updatedAt.getTime() > current.updatedAt.getTime();
  }
  return candidate.createdAt.getTime() > current.createdAt.getTime();
}

function summarizeSourceCommunication(item: CommunicationItem) {
  const sender = item.sender ?? item.participants[0];
  return {
    id: item.id,
    channel: item.channel,
    channelLabel: communicationChannelLabel(item.channel),
    displayName: sender?.displayName,
    phoneNumber: sender?.phoneNumber,
    occurredAt: item.occurredAt,
    summary: truncate(item.summary ?? item.bodyText ?? "", 180)
  };
}

function communicationChannelLabel(channel: CommunicationItem["channel"]): string {
  switch (channel) {
    case "phone_call":
      return "Call";
    case "sms":
      return "Text";
    case "email":
      return "Email";
    case "calendar_event":
      return "Calendar";
    case "document":
      return "Document";
    case "manual_note":
      return "Note";
    case "agent_message":
      return "Agent message";
  }
}

function truncate(value: string, maxLength: number): string | undefined {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return undefined;
  }
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength - 1).trimEnd()}…` : trimmed;
}
