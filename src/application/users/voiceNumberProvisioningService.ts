import type { UserConfigService } from "./userConfigService.js";
import type { RetellPhoneNumberClient } from "../../infrastructure/retell/retellClient.js";
import { badRequest } from "../../shared/httpErrors.js";

export interface VoiceNumberAssignment {
  phoneNumber: string;
  provider: "twilio" | "telnyx" | "custom";
  inboundAgentId?: string | null;
  inboundWebhookUrl?: string | null;
  alreadyAssigned: boolean;
}

export class VoiceNumberProvisioningService {
  constructor(
    private readonly dependencies: {
      users: UserConfigService;
      retellPhoneNumbers: RetellPhoneNumberClient;
      defaultRetellAgentId?: string;
      publicBaseUrl?: string;
      selfServeProvisioningEnabled: boolean;
    }
  ) {}

  async assignRetellNumber(input: {
    userId: string;
    areaCode?: number;
    phoneNumber?: string;
  }): Promise<VoiceNumberAssignment> {
    const user = await this.dependencies.users.assertCanProvisionRetellNumber(input.userId);
    if (user.phoneRouting.retellPhoneNumber) {
      return {
        phoneNumber: user.phoneRouting.retellPhoneNumber,
        provider: user.phoneRouting.retellNumberProvider ?? "twilio",
        inboundAgentId: user.phoneRouting.retellAgentId ?? this.dependencies.defaultRetellAgentId,
        inboundWebhookUrl: this.inboundWebhookUrl(),
        alreadyAssigned: true
      };
    }

    if (!this.dependencies.selfServeProvisioningEnabled) {
      throw badRequest(
        "self_serve_retell_provisioning_disabled",
        "Self-serve Retell number provisioning is disabled for this environment."
      );
    }

    const inboundWebhookUrl = this.inboundWebhookUrl();
    const response = await this.dependencies.retellPhoneNumbers.purchasePhoneNumber({
      areaCode: input.areaCode,
      phoneNumber: input.phoneNumber,
      inboundAgentId: user.phoneRouting.retellAgentId ?? this.dependencies.defaultRetellAgentId,
      outboundAgentId: user.phoneRouting.retellAgentId ?? this.dependencies.defaultRetellAgentId,
      inboundWebhookUrl,
      nickname: `${user.displayName} Phone Agent`.slice(0, 100),
      provider: "twilio"
    });

    const provider = response.phone_number_type === "retell-telnyx" ? "telnyx" : "twilio";
    await this.dependencies.users.upsert({
      userId: input.userId,
      phoneRouting: {
        retellPhoneNumber: response.phone_number,
        retellAgentId: response.inbound_agent_id ?? user.phoneRouting.retellAgentId ?? this.dependencies.defaultRetellAgentId,
        retellNumberProvider: provider,
        retellNumberAssignedAt: new Date()
      }
    });

    return {
      phoneNumber: response.phone_number,
      provider,
      inboundAgentId: response.inbound_agent_id,
      inboundWebhookUrl: response.inbound_webhook_url,
      alreadyAssigned: false
    };
  }

  private inboundWebhookUrl(): string {
    if (!this.dependencies.publicBaseUrl) {
      throw badRequest("app_public_base_url_missing", "APP_PUBLIC_BASE_URL is required before assigning Retell numbers.");
    }
    return `${this.dependencies.publicBaseUrl.replace(/\/$/, "")}/webhooks/retell/inbound`;
  }
}
