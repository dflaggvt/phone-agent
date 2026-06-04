import type { UserConfigService } from "../application/users/userConfigService.js";

export function redactedUserConfig(config: Awaited<ReturnType<UserConfigService["getOrCreate"]>>) {
  return {
    userId: config.userId,
    accountStatus: config.accountStatus,
    deletedAt: config.deletedAt,
    displayName: config.displayName,
    auth: {
      firebaseUid: config.auth.firebaseUid,
      email: config.auth.email,
      primaryPhoneVerifiedAt: config.auth.primaryPhoneVerifiedAt,
      phoneNumber: config.auth.phoneNumber,
      phoneVerificationStatus: config.auth.primaryPhoneVerifiedAt ? "verified" : "not_started"
    },
    assistantProfile: config.assistantProfile,
    phoneRouting: config.phoneRouting,
    billing: config.billing,
    onboarding: config.onboarding,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt
  };
}
