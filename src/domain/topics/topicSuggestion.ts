export type TopicSuggestionStatus = "pending" | "accepted" | "dismissed";

export type TopicSuggestionTargetType = "existing_topic" | "new_topic";

export interface TopicSuggestion {
  id: string;
  userId: string;
  communicationItemId: string;
  targetType: TopicSuggestionTargetType;
  suggestedTopicThreadId?: string;
  suggestedTitle?: string;
  suggestedDescription?: string;
  confidence: number;
  reason: string;
  evidence: string[];
  status: TopicSuggestionStatus;
  createdAt: Date;
  updatedAt: Date;
  decidedAt?: Date;
}

export interface TopicSuggestionSourceCommunication {
  id: string;
  channel: string;
  channelLabel: string;
  displayName?: string;
  phoneNumber?: string;
  occurredAt: Date;
  summary?: string;
}

export interface TopicSuggestionListItem extends TopicSuggestion {
  suggestedTopicTitle: string;
  sourceCommunication?: TopicSuggestionSourceCommunication;
}

export interface CreateTopicSuggestionInput {
  userId: string;
  communicationItemId: string;
  targetType: TopicSuggestionTargetType;
  suggestedTopicThreadId?: string;
  suggestedTitle?: string;
  suggestedDescription?: string;
  confidence: number;
  reason: string;
  evidence?: string[];
}

export interface TopicSuggestionRepository {
  upsertPending(input: CreateTopicSuggestionInput): Promise<TopicSuggestion>;
  get(id: string): Promise<TopicSuggestion | undefined>;
  listForCommunication(userId: string, communicationItemId: string): Promise<TopicSuggestion[]>;
  listPendingForUser(userId: string): Promise<TopicSuggestion[]>;
  accept(id: string): Promise<TopicSuggestion | undefined>;
  dismiss(id: string): Promise<TopicSuggestion | undefined>;
  dismissPendingForCommunication(input: {
    userId: string;
    communicationItemId: string;
    exceptId?: string;
  }): Promise<TopicSuggestion[]>;
}
