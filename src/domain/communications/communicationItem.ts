export type CommunicationChannel =
  | "phone_call"
  | "sms"
  | "email"
  | "calendar_event"
  | "document"
  | "manual_note"
  | "agent_message";

export type CommunicationDirection = "inbound" | "outbound" | "internal";

export type SensitivityLevel = "unknown" | "normal" | "sensitive" | "restricted";

export interface CommunicationActor {
  participantId?: string;
  contactId?: string;
  displayName?: string;
  phoneNumber?: string;
  email?: string;
  agentId?: string;
}

export interface RawContentRef {
  storageProvider: "inline" | "firestore" | "object_storage" | "provider";
  uri?: string;
  providerId?: string;
  contentType?: string;
  retainedUntil?: Date;
}

export interface ExtractedFact {
  text: string;
  confidence: number;
  sourceCommunicationItemId?: string;
}

export interface ExtractedTask {
  title: string;
  assigneeParticipantId?: string;
  dueAt?: Date;
  confidence: number;
}

export interface ExtractedDecision {
  title: string;
  status: "made" | "pending";
  selectedOption?: string;
  confidence: number;
}

export interface ExtractedOpenQuestion {
  question: string;
  ownerParticipantId?: string;
  dueAt?: Date;
  confidence: number;
}

export interface TopicAssociation {
  topicThreadId: string;
  confidence: number;
  mode: "manual" | "auto" | "suggested";
  reason?: string;
  attachedAt: Date;
}

export interface CommunicationItem {
  id: string;
  userId: string;
  channel: CommunicationChannel;
  direction: CommunicationDirection;
  sourceProvider: string;
  providerItemId?: string;
  sender?: CommunicationActor;
  recipients: CommunicationActor[];
  participants: CommunicationActor[];
  occurredAt: Date;
  receivedAt: Date;
  rawContentRef?: RawContentRef;
  bodyText?: string;
  transcriptText?: string;
  summary?: string;
  extractedFacts: ExtractedFact[];
  extractedTasks: ExtractedTask[];
  extractedDecisions: ExtractedDecision[];
  extractedOpenQuestions: ExtractedOpenQuestion[];
  topicAssociations: TopicAssociation[];
  sensitivity: SensitivityLevel;
  consentRequired: boolean;
  retentionPolicyId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCommunicationItemInput {
  userId: string;
  channel: CommunicationChannel;
  direction: CommunicationDirection;
  sourceProvider: string;
  providerItemId?: string;
  sender?: CommunicationActor;
  recipients?: CommunicationActor[];
  participants?: CommunicationActor[];
  occurredAt?: Date;
  receivedAt?: Date;
  rawContentRef?: RawContentRef;
  bodyText?: string;
  transcriptText?: string;
  summary?: string;
  sensitivity?: SensitivityLevel;
  consentRequired?: boolean;
  retentionPolicyId?: string;
}

export interface UpsertCommunicationItemFromProviderInput extends CreateCommunicationItemInput {
  providerItemId: string;
}

export interface CommunicationItemRepository {
  create(input: CreateCommunicationItemInput): Promise<CommunicationItem>;
  upsertFromProvider(input: UpsertCommunicationItemFromProviderInput): Promise<CommunicationItem>;
  get(id: string): Promise<CommunicationItem | undefined>;
  findByProviderItem(sourceProvider: string, providerItemId: string): Promise<CommunicationItem | undefined>;
  listRecentForUser(userId: string, limit?: number): Promise<CommunicationItem[]>;
  updateExtractions(
    communicationItemId: string,
    input: {
      extractedFacts?: ExtractedFact[];
      extractedTasks?: ExtractedTask[];
      extractedDecisions?: ExtractedDecision[];
      extractedOpenQuestions?: ExtractedOpenQuestion[];
    }
  ): Promise<CommunicationItem | undefined>;
  attachToTopic(input: {
    communicationItemId: string;
    topicThreadId: string;
    confidence: number;
    mode: TopicAssociation["mode"];
    reason?: string;
  }): Promise<CommunicationItem | undefined>;
}
