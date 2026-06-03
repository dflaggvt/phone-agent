export type OpenQuestionStatus = "open" | "answered" | "dismissed";

export interface OpenQuestion {
  id: string;
  topicThreadId: string;
  question: string;
  status: OpenQuestionStatus;
  ownerParticipantId?: string;
  answer?: string;
  dueAt?: Date;
  sourceCommunicationItemIds: string[];
  createdAt: Date;
  updatedAt: Date;
  answeredAt?: Date;
}

