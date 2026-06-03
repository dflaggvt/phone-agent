import { randomUUID } from "node:crypto";
import type {
  CreateDecisionInput,
  CreateOpenQuestionInput,
  CreateTopicTaskInput,
  CreateTopicThreadInput,
  TopicThread,
  TopicThreadRepository
} from "../../domain/topics/topicThread.js";
import { createTopicThreadSkeleton } from "../../domain/topics/topicThread.js";

export class InMemoryTopicThreadRepository implements TopicThreadRepository {
  private readonly topics = new Map<string, TopicThread>();

  async create(input: CreateTopicThreadInput): Promise<TopicThread> {
    const topic = createTopicThreadSkeleton({ ...input, id: randomUUID() });
    this.topics.set(topic.id, topic);
    return topic;
  }

  async get(id: string): Promise<TopicThread | undefined> {
    return this.topics.get(id);
  }

  async listForUser(userId: string): Promise<TopicThread[]> {
    return [...this.topics.values()]
      .filter((topic) => topic.userId === userId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async attachCommunication(topicThreadId: string, communicationItemId: string): Promise<TopicThread | undefined> {
    const topic = this.topics.get(topicThreadId);
    if (!topic) {
      return undefined;
    }
    const updated = {
      ...topic,
      communicationItemIds: topic.communicationItemIds.includes(communicationItemId)
        ? topic.communicationItemIds
        : [...topic.communicationItemIds, communicationItemId],
      updatedAt: new Date()
    };
    this.topics.set(updated.id, updated);
    return updated;
  }

  async addDecision(topicThreadId: string, input: CreateDecisionInput): Promise<TopicThread | undefined> {
    return this.update(topicThreadId, (topic) => ({
      ...topic,
      decisions: [
        ...topic.decisions,
        {
          id: randomUUID(),
          topicThreadId,
          title: input.title,
          description: input.description,
          status: "pending",
          options: [],
          requiredApproverParticipantIds: input.requiredApproverParticipantIds ?? [],
          dueAt: input.dueAt,
          sourceCommunicationItemIds: input.sourceCommunicationItemIds ?? [],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
    }));
  }

  async addOpenQuestion(topicThreadId: string, input: CreateOpenQuestionInput): Promise<TopicThread | undefined> {
    return this.update(topicThreadId, (topic) => ({
      ...topic,
      openQuestions: [
        ...topic.openQuestions,
        {
          id: randomUUID(),
          topicThreadId,
          question: input.question,
          status: "open",
          ownerParticipantId: input.ownerParticipantId,
          dueAt: input.dueAt,
          sourceCommunicationItemIds: input.sourceCommunicationItemIds ?? [],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
    }));
  }

  async addTask(topicThreadId: string, input: CreateTopicTaskInput): Promise<TopicThread | undefined> {
    return this.update(topicThreadId, (topic) => ({
      ...topic,
      tasks: [
        ...topic.tasks,
        {
          id: randomUUID(),
          topicThreadId,
          title: input.title,
          description: input.description,
          status: "open",
          assigneeParticipantId: input.assigneeParticipantId,
          dueAt: input.dueAt,
          sourceCommunicationItemIds: input.sourceCommunicationItemIds ?? [],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
    }));
  }

  private async update(topicThreadId: string, update: (topic: TopicThread) => TopicThread): Promise<TopicThread | undefined> {
    const existing = this.topics.get(topicThreadId);
    if (!existing) {
      return undefined;
    }
    const updated = { ...update(existing), updatedAt: new Date() };
    this.topics.set(topicThreadId, updated);
    return updated;
  }
}
