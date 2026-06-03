export type RelationshipLabel =
  | "unknown"
  | "family"
  | "close_friend"
  | "coworker"
  | "vendor"
  | "healthcare"
  | "school"
  | "spam"
  | "blocked";

export type CallerTrustLevel = "unknown" | "trusted" | "standard" | "low" | "blocked";

export interface CallerMemory {
  id: string;
  type: "fact" | "preference" | "prior_summary" | "open_follow_up";
  text: string;
  sourceCallId?: string;
  confidence: number;
  approved: boolean;
  sensitive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CallerProfile {
  id: string;
  userId: string;
  primaryPhoneNumber: string;
  phoneNumbers: string[];
  displayName?: string;
  organization?: string;
  relationship: RelationshipLabel;
  trustLevel: CallerTrustLevel;
  lastIntent?: string;
  lastCallSummary?: string;
  lastCallAt?: Date;
  callCount: number;
  memories: CallerMemory[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentContextPack {
  callerProfileId?: string;
  contactId?: string;
  identitySource: "caller_memory" | "contact" | "unknown";
  knownCaller: boolean;
  callerName?: string;
  organization?: string;
  relationship: RelationshipLabel;
  trustLevel: CallerTrustLevel;
  priorCallCount: number;
  lastCallSummary?: string;
  lastIntent?: string;
  approvedFacts: string[];
  openFollowUps: string[];
  suggestedTone: string;
  routingGuidance: string;
  redLines: string[];
}

export interface MemoryUpsertInput {
  userId: string;
  phoneNumber: string;
  displayName?: string;
  organization?: string;
  relationship?: RelationshipLabel;
  trustLevel?: CallerTrustLevel;
  lastIntent?: string;
  lastCallSummary?: string;
  lastCallAt?: Date;
  sourceCallId?: string;
  facts?: string[];
  openFollowUps?: string[];
}

export interface CallerMemoryRepository {
  findByPhoneNumber(userId: string, phoneNumber: string): Promise<CallerProfile | undefined>;
  listProfiles(userId: string): Promise<CallerProfile[]>;
  getProfile(userId: string, id: string): Promise<CallerProfile | undefined>;
  upsertFromCall(input: MemoryUpsertInput): Promise<CallerProfile>;
  updateProfile(
    userId: string,
    id: string,
    input: Partial<Pick<CallerProfile, "displayName" | "organization" | "relationship" | "trustLevel">>
  ): Promise<CallerProfile | undefined>;
  buildContextPack(userId: string, phoneNumber: string): Promise<AgentContextPack>;
}
