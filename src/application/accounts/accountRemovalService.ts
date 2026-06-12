import type { BillingAccountService } from "../billing/billingAccountService.js";
import type { PushDeviceTokenRepository } from "../../domain/notifications/pushDeviceToken.js";
import type { UserConfigService } from "../users/userConfigService.js";
import type { VoiceNumberProviderClient } from "../../infrastructure/retell/retellClient.js";
import { conflict } from "../../shared/httpErrors.js";

export interface AuthAccountAdmin {
  deleteUser(firebaseUid: string): Promise<void>;
}

export class AccountRemovalService {
  constructor(
    private readonly dependencies: {
      billing: BillingAccountService;
      pushDeviceTokens: PushDeviceTokenRepository;
      users: UserConfigService;
      voiceNumbers: VoiceNumberProviderClient;
      authAccountAdmin: AuthAccountAdmin;
    }
  ) {}

  async removeAccount(input: { userId: string; firebaseUid?: string }): Promise<{ removed: true }> {
    const user = await this.dependencies.users.getOrCreate(input.userId);
    const assistantPhoneNumber = user.phoneRouting.assistantPhoneNumber;

    await this.dependencies.billing.cancelSubscription(input.userId);
    if (assistantPhoneNumber) {
      await this.releaseAssistantNumber(assistantPhoneNumber);
    }

    const activeTokens = await this.dependencies.pushDeviceTokens.listActiveForUser(input.userId);
    await Promise.all(activeTokens.map((token) => this.dependencies.pushDeviceTokens.disable(token.id, "account_removed")));
    await this.dependencies.users.upsert({
      userId: input.userId,
      accountStatus: "deleted",
      deletedAt: new Date(),
      displayName: "Deleted account",
      phoneRouting: {
        primaryPhoneNumber: "",
        assistantPhoneNumber: "",
        voiceAgentId: "",
        assistantNumberProvisioningStatus: "unassigned",
        assistantNumberLastErrorCode: "",
        assistantNumberProvisioningAttemptId: "",
        transferPhoneNumber: ""
      },
      billing: {
        assistantNumberProvisioningAllowed: false
      }
    });
    if (input.firebaseUid) {
      await this.dependencies.authAccountAdmin.deleteUser(input.firebaseUid);
    }
    return { removed: true };
  }

  private async releaseAssistantNumber(assistantPhoneNumber: string): Promise<void> {
    try {
      await this.dependencies.voiceNumbers.releaseNumber(assistantPhoneNumber);
    } catch (error) {
      if (isAlreadyReleasedProviderError(error)) {
        return;
      }
      throw conflict(
        "assistant_number_release_failed",
        "Could not release the assistant number. Please try again or contact support."
      );
    }
  }
}

function isAlreadyReleasedProviderError(error: unknown): boolean {
  const candidate = error as { statusCode?: unknown; status?: unknown; code?: unknown };
  return candidate?.statusCode === 404
    || candidate?.status === 404
    || candidate?.code === "not_found"
    || candidate?.code === "resource_missing";
}
