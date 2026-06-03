import type { Decision } from "./decision.js";
import type { OpenQuestion } from "./openQuestion.js";
import type { TopicParticipant } from "./participant.js";
import type { TopicTask } from "./task.js";

export type TopicThreadStatus = "active" | "waiting" | "resolved" | "archived";

export interface TopicDocumentReference {
  id: string;
  title: string;
  uri?: string;
  sourceCommunicationItemId?: string;
  contentType?: string;
  addedAt: Date;
}

export interface TopicConflict {
  id: string;
  description: string;
  sourceCommunicationItemIds: string[];
  severity: "low" | "medium" | "high";
  status: "open" | "resolved" | "dismissed";
  createdAt: Date;
  resolvedAt?: Date;
}

export interface TopicThread {
  id: string;
  userId: string;
  title: string;
  description?: string;
  status: TopicThreadStatus;
  participants: TopicParticipant[];
  communicationItemIds: string[];
  decisions: Decision[];
  openQuestions: OpenQuestion[];
  tasks: TopicTask[];
  documents: TopicDocumentReference[];
  conflicts: TopicConflict[];
  suggestedNextActions: string[];
  permissionsPolicyId?: string;
  retentionPolicyId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTopicThreadInput {
  userId: string;
  title: string;
  description?: string;
  participantIds?: string[];
}

export interface CreateDecisionInput {
  title: string;
  description?: string;
  requiredApproverParticipantIds?: string[];
  dueAt?: Date;
  sourceCommunicationItemIds?: string[];
}

export interface CreateOpenQuestionInput {
  question: string;
  ownerParticipantId?: string;
  dueAt?: Date;
  sourceCommunicationItemIds?: string[];
}

export interface CreateTopicTaskInput {
  title: string;
  description?: string;
  assigneeParticipantId?: string;
  dueAt?: Date;
  sourceCommunicationItemIds?: string[];
}

export interface TopicThreadRepository {
  create(input: CreateTopicThreadInput): Promise<TopicThread>;
  get(id: string): Promise<TopicThread | undefined>;
  listForUser(userId: string): Promise<TopicThread[]>;
  attachCommunication(topicThreadId: string, communicationItemId: string): Promise<TopicThread | undefined>;
  addDecision(topicThreadId: string, input: CreateDecisionInput): Promise<TopicThread | undefined>;
  addOpenQuestion(topicThreadId: string, input: CreateOpenQuestionInput): Promise<TopicThread | undefined>;
  addTask(topicThreadId: string, input: CreateTopicTaskInput): Promise<TopicThread | undefined>;
}

export function createTopicThreadSkeleton(input: CreateTopicThreadInput & { id: string; now?: Date }): TopicThread {
  const now = input.now ?? new Date();
  return {
    id: input.id,
    userId: input.userId,
    title: input.title.trim(),
    description: input.description?.trim(),
    status: "active",
    participants: (input.participantIds ?? []).map((participantId) => ({
      participantId,
      role: "participant",
      addedAt: now,
      permissions: ["read_thread_summary", "comment"]
    })),
    communicationItemIds: [],
    decisions: [],
    openQuestions: [],
    tasks: [],
    documents: [],
    conflicts: [],
    suggestedNextActions: [],
    createdAt: now,
    updatedAt: now
  };
}
