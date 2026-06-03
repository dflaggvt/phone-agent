import { randomUUID } from "node:crypto";
import type { Firestore } from "@google-cloud/firestore";
import type {
  CreateDecisionInput,
  CreateOpenQuestionInput,
  CreateTopicTaskInput,
  CreateTopicThreadInput,
  TopicThread,
  TopicThreadRepository
} from "../../domain/topics/topicThread.js";
import { createTopicThreadSkeleton } from "../../domain/topics/topicThread.js";
import { firestoreDate, removeUndefinedDeep } from "./firestoreClient.js";

const COLLECTION = "topicThreads";

export class FirestoreTopicThreadRepository implements TopicThreadRepository {
  constructor(private readonly firestore: Firestore) {}

  async create(input: CreateTopicThreadInput): Promise<TopicThread> {
    const topic = createTopicThreadSkeleton({ ...input, id: randomUUID() });
    await this.collection().doc(topic.id).set(removeUndefinedDeep(topic));
    return topic;
  }

  async get(id: string): Promise<TopicThread | undefined> {
    const doc = await this.collection().doc(id).get();
    return doc.exists ? topicFromFirestore(doc.id, doc.data() ?? {}) : undefined;
  }

  async listForUser(userId: string): Promise<TopicThread[]> {
    const snapshot = await this.collection().where("userId", "==", userId).limit(100).get();
    return snapshot.docs
      .map((doc) => topicFromFirestore(doc.id, doc.data()))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async attachCommunication(topicThreadId: string, communicationItemId: string): Promise<TopicThread | undefined> {
    return this.update(topicThreadId, (topic) => ({
      ...topic,
      communicationItemIds: topic.communicationItemIds.includes(communicationItemId)
        ? topic.communicationItemIds
        : [...topic.communicationItemIds, communicationItemId]
    }));
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
    const existing = await this.get(topicThreadId);
    if (!existing) {
      return undefined;
    }
    const updated = { ...update(existing), updatedAt: new Date() };
    await this.collection().doc(topicThreadId).set(removeUndefinedDeep(updated));
    return updated;
  }

  private collection() {
    return this.firestore.collection(COLLECTION);
  }
}

function topicFromFirestore(id: string, data: Record<string, unknown>): TopicThread {
  return {
    id,
    userId: getString(data.userId) ?? "",
    title: getString(data.title) ?? "Untitled topic",
    description: getString(data.description),
    status: data.status === "waiting" || data.status === "resolved" || data.status === "archived" ? data.status : "active",
    participants: Array.isArray(data.participants) ? data.participants as TopicThread["participants"] : [],
    communicationItemIds: stringArray(data.communicationItemIds),
    decisions: Array.isArray(data.decisions) ? data.decisions as TopicThread["decisions"] : [],
    openQuestions: Array.isArray(data.openQuestions) ? data.openQuestions as TopicThread["openQuestions"] : [],
    tasks: Array.isArray(data.tasks) ? data.tasks as TopicThread["tasks"] : [],
    documents: Array.isArray(data.documents) ? data.documents as TopicThread["documents"] : [],
    conflicts: Array.isArray(data.conflicts) ? data.conflicts as TopicThread["conflicts"] : [],
    suggestedNextActions: stringArray(data.suggestedNextActions),
    permissionsPolicyId: getString(data.permissionsPolicyId),
    retentionPolicyId: getString(data.retentionPolicyId),
    createdAt: firestoreDate(data.createdAt) ?? new Date(0),
    updatedAt: firestoreDate(data.updatedAt) ?? new Date(0)
  };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
