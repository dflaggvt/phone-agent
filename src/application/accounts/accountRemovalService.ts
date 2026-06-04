import type { BillingAccountService } from "../billing/billingAccountService.js";
import type { PushDeviceTokenRepository } from "../../domain/notifications/pushDeviceToken.js";
import type { UserConfigService } from "../users/userConfigService.js";

export interface AuthAccountAdmin {
  deleteUser(firebaseUid: string): Promise<void>;
}

export class AccountRemovalService {
  constructor(
    private readonly dependencies: {
      billing: BillingAccountService;
      pushDeviceTokens: PushDeviceTokenRepository;
      users: UserConfigService;
      authAccountAdmin: AuthAccountAdmin;
    }
  ) {}

  async removeAccount(input: { userId: string; firebaseUid?: string }): Promise<{ removed: true }> {
    await this.dependencies.billing.cancelSubscription(input.userId);
    const activeTokens = await this.dependencies.pushDeviceTokens.listActiveForUser(input.userId);
    await Promise.all(activeTokens.map((token) => this.dependencies.pushDeviceTokens.disable(token.id, "account_removed")));
    await this.dependencies.users.upsert({
      userId: input.userId,
      accountStatus: "deleted",
      deletedAt: new Date(),
      displayName: "Deleted account",
      phoneRouting: {
        primaryPhoneNumber: "",
        retellPhoneNumber: "",
        retellAgentId: "",
        transferPhoneNumber: ""
      },
      billing: {
        retellNumberProvisioningAllowed: false
      }
    });
    if (input.firebaseUid) {
      await this.dependencies.authAccountAdmin.deleteUser(input.firebaseUid);
    }
    return { removed: true };
  }
}
