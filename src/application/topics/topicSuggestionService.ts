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

  listPending(userId: string) {
    return this.dependencies.suggestions.listPendingForUser(userId);
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
    return accepted ? { suggestion: accepted, topic: attachedTopic ?? topic } : undefined;
  }

  async dismissSuggestion(id: string, userId?: string): Promise<TopicSuggestion | undefined> {
    const existing = await this.dependencies.suggestions.get(id);
    if (!existing || (userId && existing.userId !== userId)) {
      return undefined;
    }
    return this.dependencies.suggestions.dismiss(id);
  }

  private async getSuggestedExistingTopic(suggestion: TopicSuggestion): Promise<TopicThread | undefined> {
    return suggestion.suggestedTopicThreadId
      ? this.dependencies.topics.get(suggestion.suggestedTopicThreadId)
      : undefined;
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
      await this.dependencies.notifications?.createTopicSuggestion({
        userId: item.userId,
        suggestionId: suggestion.id,
        confidence: suggestion.confidence
      });
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
      await this.dependencies.notifications?.createTopicSuggestion({
        userId: item.userId,
        suggestionId: suggestion.id,
        confidence: suggestion.confidence
      });
      return [suggestion];
    }

    return [];
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
