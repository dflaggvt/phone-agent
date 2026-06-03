import type {
  AssistantProfile,
  UpsertUserConfigInput,
  UserConfig,
  UserConfigRepository
} from "../../domain/users/userConfig.js";
import type { VerifiedAuthUser } from "../auth/authVerifier.js";
import { forbidden } from "../../shared/httpErrors.js";

export class UserConfigService {
  constructor(
    private readonly dependencies: {
      users: UserConfigRepository;
      defaultConfig: UpsertUserConfigInput;
    }
  ) {}

  async getOrCreate(userId: string): Promise<UserConfig> {
    return (await this.dependencies.users.get(userId)) ?? this.dependencies.users.upsert({ ...this.dependencies.defaultConfig, userId });
  }

  async getByRetellPhoneNumber(phoneNumber: string): Promise<UserConfig | undefined> {
    return this.dependencies.users.getByRetellPhoneNumber(phoneNumber);
  }

  upsert(input: UpsertUserConfigInput): Promise<UserConfig> {
    return this.dependencies.users.upsert(input);
  }

  async getOrCreateForFirebaseUser(authUser: VerifiedAuthUser): Promise<UserConfig> {
    const userId = userIdForFirebaseUid(authUser.uid);
    const existing = await this.dependencies.users.get(userId);
    const phoneNumber = normalizePhone(authUser.phoneNumber);
    return this.dependencies.users.upsert({
      ...this.dependencies.defaultConfig,
      userId,
      displayName: existing?.displayName ?? authUser.displayName ?? phoneNumber ?? "Phone Agent User",
      auth: {
        firebaseUid: authUser.uid,
        email: authUser.email,
        phoneNumber,
        primaryPhoneVerifiedAt: phoneNumber ? existing?.auth.primaryPhoneVerifiedAt ?? new Date() : existing?.auth.primaryPhoneVerifiedAt
      },
      phoneRouting: {
        ...existing?.phoneRouting,
        primaryPhoneNumber: existing?.phoneRouting.primaryPhoneNumber ?? phoneNumber,
        transferPhoneNumber: existing?.phoneRouting.transferPhoneNumber ?? phoneNumber
      },
      onboarding: {
        ...existing?.onboarding,
        accountCreatedAt: existing?.onboarding.accountCreatedAt ?? new Date()
      }
    });
  }

  async updateAssistantProfile(userId: string, input: Partial<AssistantProfile>): Promise<UserConfig> {
    return this.dependencies.users.upsert({
      userId,
      assistantProfile: input,
      onboarding: {
        assistantProfileConfiguredAt: new Date()
      }
    });
  }

  async assertCanProvisionRetellNumber(userId: string): Promise<UserConfig> {
    const user = await this.getOrCreate(userId);
    if (!user.auth.primaryPhoneVerifiedAt) {
      throw forbidden("phone_not_verified", "Verify the user's mobile number before assigning an assistant number.");
    }
    if (!user.billing.retellNumberProvisioningAllowed) {
      throw forbidden("retell_number_provisioning_not_allowed", "This account is not allowed to provision paid Retell numbers yet.");
    }
    return user;
  }
}

function normalizePhone(value?: string): string {
  return (value ?? "").replace(/[^\d+]/g, "");
}

export function userIdForFirebaseUid(uid: string): string {
  return `firebase_${uid.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}
