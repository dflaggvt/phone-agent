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
    phoneRouting: {
      primaryPhoneNumber: config.phoneRouting.primaryPhoneNumber,
      assistantPhoneNumber: config.phoneRouting.assistantPhoneNumber,
      transferPhoneNumber: config.phoneRouting.transferPhoneNumber,
      forwardingInstructionsViewedAt: config.phoneRouting.forwardingInstructionsViewedAt,
      assistantNumberAssignedAt: config.phoneRouting.assistantNumberAssignedAt,
      assistantNumberProvisioningStatus: config.phoneRouting.assistantNumberProvisioningStatus
        ?? (config.phoneRouting.assistantPhoneNumber ? "assigned" : "unassigned"),
      assistantNumberLastErrorCode: config.phoneRouting.assistantNumberLastErrorCode
    },
    billing: {
      plan: config.billing.plan,
      monthlyIncludedMinutes: config.billing.monthlyIncludedMinutes,
      monthlyClassificationLimit: config.billing.monthlyClassificationLimit,
      assistantNumberProvisioningAllowed: config.billing.assistantNumberProvisioningAllowed
    },
    onboarding: config.onboarding,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt
  };
}
