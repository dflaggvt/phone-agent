import type { Firestore } from "@google-cloud/firestore";
import type { UpsertUserConfigInput, UserConfig, UserConfigRepository } from "../../domain/users/userConfig.js";
import { createAssistantProfile, createUserConfig, type AssistantProfile } from "../../domain/users/userConfig.js";
import { firestoreDate, removeUndefinedDeep } from "./firestoreClient.js";

const COLLECTION = "userConfigs";

export class FirestoreUserConfigRepository implements UserConfigRepository {
  constructor(private readonly firestore: Firestore) {}

  async get(userId: string): Promise<UserConfig | undefined> {
    const doc = await this.collection().doc(userId).get();
    return doc.exists ? userConfigFromFirestore(doc.id, doc.data() ?? {}) : undefined;
  }

  async getByAssistantPhoneNumber(phoneNumber: string): Promise<UserConfig | undefined> {
    const normalized = normalizePhone(phoneNumber);
    const snapshot = await this.collection()
      .where("phoneRouting.assistantPhoneNumber", "==", normalized)
      .limit(1)
      .get();
    const doc = snapshot.docs[0];
    if (doc) {
      return userConfigFromFirestore(doc.id, doc.data());
    }

    const legacySnapshot = await this.collection()
      .where("phoneRouting.retellPhoneNumber", "==", normalized)
      .limit(1)
      .get();
    const legacyDoc = legacySnapshot.docs[0];
    return legacyDoc ? userConfigFromFirestore(legacyDoc.id, legacyDoc.data()) : undefined;
  }

  async upsert(input: UpsertUserConfigInput): Promise<UserConfig> {
    const existing = await this.get(input.userId);
    const now = new Date();
    const next: UserConfig = existing
      ? {
        ...existing,
        accountStatus: input.accountStatus ?? existing.accountStatus,
        deletedAt: input.deletedAt ?? existing.deletedAt,
        displayName: input.displayName ?? existing.displayName,
        auth: { ...existing.auth, ...input.auth },
        assistantProfile: {
          ...existing.assistantProfile,
          ...input.assistantProfile,
          profileVersion: input.assistantProfile
            ? existing.assistantProfile.profileVersion + 1
            : existing.assistantProfile.profileVersion
        },
        phoneRouting: normalizeRouting({ ...existing.phoneRouting, ...input.phoneRouting }),
        billing: { ...existing.billing, ...input.billing },
        onboarding: { ...existing.onboarding, ...input.onboarding },
        updatedAt: now
      }
      : createUserConfig({
        ...input,
        phoneRouting: normalizeRouting(input.phoneRouting ?? {}),
        now
      });
    await this.collection().doc(next.userId).set(removeUndefinedDeep(next));
    return next;
  }

  private collection() {
    return this.firestore.collection(COLLECTION);
  }
}

function userConfigFromFirestore(id: string, data: Record<string, unknown>): UserConfig {
  const billing = getRecord(data.billing);
  const phoneRouting = getRecord(data.phoneRouting);
  const onboarding = getRecord(data.onboarding);
  const auth = getRecord(data.auth);
  const assistantProfile = getRecord(data.assistantProfile);
  return {
    userId: getString(data.userId) ?? id,
    accountStatus: getAccountStatus(data.accountStatus),
    deletedAt: firestoreDate(data.deletedAt),
    displayName: getString(data.displayName) ?? "Phone Agent User",
    auth: {
      firebaseUid: getString(auth?.firebaseUid),
      email: getString(auth?.email),
      primaryPhoneVerifiedAt: firestoreDate(auth?.primaryPhoneVerifiedAt),
      phoneNumber: getString(auth?.phoneNumber)
    },
    assistantProfile: parseAssistantProfile(assistantProfile),
    phoneRouting: {
      primaryPhoneNumber: getString(phoneRouting?.primaryPhoneNumber),
      assistantPhoneNumber: getString(phoneRouting?.assistantPhoneNumber) ?? getString(phoneRouting?.retellPhoneNumber),
      voiceAgentId: getString(phoneRouting?.voiceAgentId) ?? getString(phoneRouting?.retellAgentId),
      providerNumberType: getProviderNumberType(phoneRouting?.providerNumberType) ?? getProviderNumberType(phoneRouting?.retellNumberProvider),
      assistantNumberAssignedAt: firestoreDate(phoneRouting?.assistantNumberAssignedAt) ?? firestoreDate(phoneRouting?.retellNumberAssignedAt),
      assistantNumberProvisioningStatus: getProvisioningStatus(phoneRouting?.assistantNumberProvisioningStatus)
        ?? (getString(phoneRouting?.assistantPhoneNumber) || getString(phoneRouting?.retellPhoneNumber) ? "assigned" : undefined),
      assistantNumberLastErrorCode: getString(phoneRouting?.assistantNumberLastErrorCode),
      assistantNumberProvisioningAttemptId: getString(phoneRouting?.assistantNumberProvisioningAttemptId),
      forwardingInstructionsViewedAt: firestoreDate(phoneRouting?.forwardingInstructionsViewedAt),
      transferPhoneNumber: getString(phoneRouting?.transferPhoneNumber)
    },
    billing: {
      plan: getString(billing?.plan) ?? "beta",
      monthlyIncludedMinutes: getNumber(billing?.monthlyIncludedMinutes) ?? 300,
      monthlyClassificationLimit: getNumber(billing?.monthlyClassificationLimit) ?? 1000,
      assistantNumberProvisioningAllowed: getBoolean(billing?.assistantNumberProvisioningAllowed)
        ?? getBoolean(billing?.retellNumberProvisioningAllowed)
        ?? false
    },
    onboarding: {
      accountCreatedAt: firestoreDate(onboarding?.accountCreatedAt),
      assistantProfileConfiguredAt: firestoreDate(onboarding?.assistantProfileConfiguredAt),
      forwardingConfiguredAt: firestoreDate(onboarding?.forwardingConfiguredAt),
      firstTestCallAt: firestoreDate(onboarding?.firstTestCallAt),
      firstUsefulHandledCallAt: firestoreDate(onboarding?.firstUsefulHandledCallAt)
    },
    createdAt: firestoreDate(data.createdAt) ?? new Date(0),
    updatedAt: firestoreDate(data.updatedAt) ?? new Date(0)
  };
}

function normalizeRouting<T extends { primaryPhoneNumber?: string; assistantPhoneNumber?: string; transferPhoneNumber?: string }>(routing: T): T {
  return {
    ...routing,
    primaryPhoneNumber: routing.primaryPhoneNumber ? normalizePhone(routing.primaryPhoneNumber) : undefined,
    assistantPhoneNumber: routing.assistantPhoneNumber ? normalizePhone(routing.assistantPhoneNumber) : undefined,
    transferPhoneNumber: routing.transferPhoneNumber ? normalizePhone(routing.transferPhoneNumber) : undefined
  };
}

function normalizePhone(value: string): string {
  return value.replace(/[^\d+]/g, "");
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? value as Record<string, unknown> : undefined;
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function getBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function getProviderNumberType(value: unknown): "twilio" | "telnyx" | "custom" | undefined {
  return value === "twilio" || value === "telnyx" || value === "custom" ? value : undefined;
}

function getProvisioningStatus(value: unknown): UserConfig["phoneRouting"]["assistantNumberProvisioningStatus"] | undefined {
  return value === "unassigned"
    || value === "provisioning"
    || value === "assigned"
    || value === "failed"
    || value === "needs_operator_review"
    ? value
    : undefined;
}

function getAccountStatus(value: unknown): UserConfig["accountStatus"] {
  return value === "deleted" ? "deleted" : "active";
}

function parseAssistantProfile(value: Record<string, unknown> | undefined): AssistantProfile {
  return createAssistantProfile({
    assistantName: getString(value?.assistantName),
    greetingStyle: getGreetingStyle(value?.greetingStyle),
    disclosureStyle: getDisclosureStyle(value?.disclosureStyle),
    warmth: getRating(value?.warmth),
    brevity: getRating(value?.brevity),
    proactivity: getRating(value?.proactivity),
    unknownCallerPolicy: getUnknownCallerPolicy(value?.unknownCallerPolicy),
    trustedCallerPolicy: getTrustedCallerPolicy(value?.trustedCallerPolicy),
    transferPolicy: getTransferPolicy(value?.transferPolicy),
    calendarPolicy: getCalendarPolicy(value?.calendarPolicy),
    topicMemoryPolicy: getTopicMemoryPolicy(value?.topicMemoryPolicy),
    profileVersion: getNumber(value?.profileVersion)
  });
}

function getGreetingStyle(value: unknown): AssistantProfile["greetingStyle"] | undefined {
  return value === "concise" || value === "warm" || value === "formal" || value === "protective" ? value : undefined;
}

function getDisclosureStyle(value: unknown): AssistantProfile["disclosureStyle"] | undefined {
  return value === "standard" || value === "explicit" ? value : undefined;
}

function getRating(value: unknown): AssistantProfile["warmth"] | undefined {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5 ? value : undefined;
}

function getUnknownCallerPolicy(value: unknown): AssistantProfile["unknownCallerPolicy"] | undefined {
  return value === "screen" || value === "message_only" || value === "ring_me" ? value : undefined;
}

function getTrustedCallerPolicy(value: unknown): AssistantProfile["trustedCallerPolicy"] | undefined {
  return value === "can_interrupt" || value === "ask_first" || value === "message_only" ? value : undefined;
}

function getTransferPolicy(value: unknown): AssistantProfile["transferPolicy"] | undefined {
  return value === "approval_required" || value === "trusted_can_transfer" || value === "never_transfer" ? value : undefined;
}

function getCalendarPolicy(value: unknown): AssistantProfile["calendarPolicy"] | undefined {
  return value === "free_busy_only" || value === "create_events" || value === "disabled" ? value : undefined;
}

function getTopicMemoryPolicy(value: unknown): AssistantProfile["topicMemoryPolicy"] | undefined {
  return value === "use_relevant_threads" || value === "ask_before_using" || value === "disabled" ? value : undefined;
}
