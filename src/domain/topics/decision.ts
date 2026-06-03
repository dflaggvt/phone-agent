export type DecisionStatus = "pending" | "made" | "declined" | "superseded";

export interface DecisionOption {
  id: string;
  label: string;
  description?: string;
}

export interface Decision {
  id: string;
  topicThreadId: string;
  title: string;
  description?: string;
  status: DecisionStatus;
  options: DecisionOption[];
  selectedOptionId?: string;
  requiredApproverParticipantIds: string[];
  dueAt?: Date;
  sourceCommunicationItemIds: string[];
  createdAt: Date;
  updatedAt: Date;
  decidedAt?: Date;
}

