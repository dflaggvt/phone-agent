import type { CommunicationItemRepository } from "../../domain/communications/communicationItem.js";
import type {
  CreateDecisionInput,
  CreateOpenQuestionInput,
  CreateTopicTaskInput,
  CreateTopicThreadInput,
  TopicThreadRepository
} from "../../domain/topics/topicThread.js";

export class TopicThreadService {
  constructor(
    private readonly dependencies: {
      topics: TopicThreadRepository;
      communicationItems: CommunicationItemRepository;
    }
  ) {}

  list(userId: string) {
    return this.dependencies.topics.listForUser(userId);
  }

  create(input: CreateTopicThreadInput) {
    return this.dependencies.topics.create(input);
  }

  get(id: string) {
    return this.dependencies.topics.get(id);
  }

  async attachCommunication(input: {
    topicThreadId: string;
    communicationItemId: string;
    confidence?: number;
    reason?: string;
  }) {
    const topic = await this.dependencies.topics.attachCommunication(input.topicThreadId, input.communicationItemId);
    if (!topic) {
      return undefined;
    }

    await this.dependencies.communicationItems.attachToTopic({
      communicationItemId: input.communicationItemId,
      topicThreadId: input.topicThreadId,
      confidence: input.confidence ?? 1,
      mode: "manual",
      reason: input.reason
    });

    return topic;
  }

  addDecision(topicThreadId: string, input: CreateDecisionInput) {
    return this.dependencies.topics.addDecision(topicThreadId, input);
  }

  addOpenQuestion(topicThreadId: string, input: CreateOpenQuestionInput) {
    return this.dependencies.topics.addOpenQuestion(topicThreadId, input);
  }

  addTask(topicThreadId: string, input: CreateTopicTaskInput) {
    return this.dependencies.topics.addTask(topicThreadId, input);
  }
}
