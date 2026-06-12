export interface UserPhoneRouting {
  primaryPhoneNumber?: string;
  assistantPhoneNumber?: string;
  voiceAgentId?: string;
  providerNumberType?: "twilio" | "telnyx" | "custom";
  assistantNumberAssignedAt?: Date;
  assistantNumberProvisioningStatus?: "unassigned" | "provisioning" | "assigned" | "failed" | "needs_operator_review";
  assistantNumberLastErrorCode?: string;
  assistantNumberProvisioningAttemptId?: string;
  transferPhoneNumber?: string;
  forwardingInstructionsViewedAt?: Date;
}

export interface UserBillingLimits {
  plan: string;
  monthlyIncludedMinutes: number;
  monthlyClassificationLimit: number;
  assistantNumberProvisioningAllowed: boolean;
}

export interface UserAuthState {
  firebaseUid?: string;
  email?: string;
  primaryPhoneVerifiedAt?: Date;
  phoneNumber?: string;
}

export interface AssistantProfile {
  assistantName: string;
  greetingStyle: "concise" | "warm" | "formal" | "protective";
  disclosureStyle: "standard" | "explicit";
  warmth: 1 | 2 | 3 | 4 | 5;
  brevity: 1 | 2 | 3 | 4 | 5;
  proactivity: 1 | 2 | 3 | 4 | 5;
  unknownCallerPolicy: "screen" | "message_only" | "ring_me";
  trustedCallerPolicy: "can_interrupt" | "ask_first" | "message_only";
  transferPolicy: "approval_required" | "trusted_can_transfer" | "never_transfer";
  calendarPolicy: "free_busy_only" | "create_events" | "disabled";
  topicMemoryPolicy: "use_relevant_threads" | "ask_before_using" | "disabled";
  profileVersion: number;
}

export interface UserConfig {
  userId: string;
  accountStatus: "active" | "deleted";
  deletedAt?: Date;
  displayName: string;
  auth: UserAuthState;
  assistantProfile: AssistantProfile;
  phoneRouting: UserPhoneRouting;
  billing: UserBillingLimits;
  onboarding: {
    accountCreatedAt?: Date;
    assistantProfileConfiguredAt?: Date;
    forwardingConfiguredAt?: Date;
    firstTestCallAt?: Date;
    firstUsefulHandledCallAt?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertUserConfigInput {
  userId: string;
  accountStatus?: "active" | "deleted";
  deletedAt?: Date;
  displayName?: string;
  auth?: UserAuthState;
  assistantProfile?: Partial<AssistantProfile>;
  phoneRouting?: UserPhoneRouting;
  billing?: Partial<UserBillingLimits>;
  onboarding?: UserConfig["onboarding"];
}

export interface UserConfigRepository {
  get(userId: string): Promise<UserConfig | undefined>;
  getByAssistantPhoneNumber(phoneNumber: string): Promise<UserConfig | undefined>;
  upsert(input: UpsertUserConfigInput): Promise<UserConfig>;
}

export function createUserConfig(input: UpsertUserConfigInput & { now?: Date }): UserConfig {
  const now = input.now ?? new Date();
  return {
    userId: input.userId,
    accountStatus: input.accountStatus ?? "active",
    deletedAt: input.deletedAt,
    displayName: input.displayName ?? "Phone Agent User",
    auth: input.auth ?? {},
    assistantProfile: createAssistantProfile(input.assistantProfile),
    phoneRouting: input.phoneRouting ?? {},
    billing: {
      plan: input.billing?.plan ?? "beta",
      monthlyIncludedMinutes: input.billing?.monthlyIncludedMinutes ?? 300,
      monthlyClassificationLimit: input.billing?.monthlyClassificationLimit ?? 1000,
      assistantNumberProvisioningAllowed: input.billing?.assistantNumberProvisioningAllowed ?? false
    },
    onboarding: {
      accountCreatedAt: now,
      ...input.onboarding
    },
    createdAt: now,
    updatedAt: now
  };
}

export function createAssistantProfile(input: Partial<AssistantProfile> = {}): AssistantProfile {
  return {
    assistantName: input.assistantName ?? "Assistant",
    greetingStyle: input.greetingStyle ?? "warm",
    disclosureStyle: input.disclosureStyle ?? "standard",
    warmth: input.warmth ?? 4,
    brevity: input.brevity ?? 3,
    proactivity: input.proactivity ?? 3,
    unknownCallerPolicy: input.unknownCallerPolicy ?? "screen",
    trustedCallerPolicy: input.trustedCallerPolicy ?? "can_interrupt",
    transferPolicy: input.transferPolicy ?? "approval_required",
    calendarPolicy: input.calendarPolicy ?? "create_events",
    topicMemoryPolicy: input.topicMemoryPolicy ?? "use_relevant_threads",
    profileVersion: input.profileVersion ?? 1
  };
}
