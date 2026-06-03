export type TopicTaskStatus = "open" | "in_progress" | "completed" | "dismissed";

export interface TopicTask {
  id: string;
  topicThreadId: string;
  title: string;
  description?: string;
  status: TopicTaskStatus;
  assigneeParticipantId?: string;
  dueAt?: Date;
  sourceCommunicationItemIds: string[];
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

