import { randomUUID } from "node:crypto";
import type { PhoneNumberResponse } from "retell-sdk/resources/phone-number.js";
import type { VoiceNumberProviderClient } from "../../infrastructure/retell/retellClient.js";
import type { UserConfigService } from "./userConfigService.js";
import { badRequest, conflict } from "../../shared/httpErrors.js";

export interface AssistantNumberAssignment {
  assistantPhoneNumber: string;
  providerNumberType: "twilio" | "telnyx" | "custom";
  voiceAgentId?: string | null;
  alreadyAssigned: boolean;
  provisioningStatus: "assigned";
}

export class AssistantNumberProvisioningService {
  constructor(
    private readonly dependencies: {
      users: UserConfigService;
      voiceNumbers: VoiceNumberProviderClient;
      defaultVoiceAgentId?: string;
      publicBaseUrl?: string;
      selfServeProvisioningEnabled: boolean;
    }
  ) {}

  async assignAssistantNumber(input: {
    userId: string;
    areaCode?: number;
  }): Promise<AssistantNumberAssignment> {
    const user = await this.dependencies.users.assertCanProvisionAssistantNumber(input.userId);
    if (user.phoneRouting.assistantPhoneNumber) {
      return {
        assistantPhoneNumber: user.phoneRouting.assistantPhoneNumber,
        providerNumberType: user.phoneRouting.providerNumberType ?? "twilio",
        voiceAgentId: user.phoneRouting.voiceAgentId ?? this.dependencies.defaultVoiceAgentId,
        alreadyAssigned: true,
        provisioningStatus: "assigned"
      };
    }

    if (user.phoneRouting.assistantNumberProvisioningStatus === "provisioning") {
      throw conflict(
        "assistant_number_provisioning_in_progress",
        "Assistant number assignment is already in progress. Please try again shortly."
      );
    }

    if (user.phoneRouting.assistantNumberProvisioningStatus === "needs_operator_review") {
      throw conflict(
        "assistant_number_needs_operator_review",
        "Assistant number assignment may have partially completed and needs support review."
      );
    }

    if (!this.dependencies.selfServeProvisioningEnabled) {
      throw badRequest(
        "self_serve_assistant_number_provisioning_disabled",
        "Self-serve assistant number provisioning is disabled for this environment."
      );
    }

    const attemptId = randomUUID();
    const inboundWebhookUrl = this.inboundWebhookUrl();
    const voiceAgentId = user.phoneRouting.voiceAgentId ?? this.dependencies.defaultVoiceAgentId;
    await this.dependencies.users.upsert({
      userId: input.userId,
      phoneRouting: {
        assistantNumberProvisioningStatus: "provisioning",
        assistantNumberLastErrorCode: undefined,
        assistantNumberProvisioningAttemptId: attemptId
      }
    });

    try {
      const response = await this.dependencies.voiceNumbers.purchaseNumber({
        areaCode: input.areaCode ?? areaCodeFor(user.phoneRouting.primaryPhoneNumber ?? user.auth.phoneNumber),
        inboundAgentId: voiceAgentId,
        outboundAgentId: voiceAgentId,
        inboundWebhookUrl,
        nickname: `${user.displayName} Phone Agent`.slice(0, 100),
        provider: "twilio"
      });
      const assignment = assignmentFromProviderResponse(response);
      await this.dependencies.users.upsert({
        userId: input.userId,
        phoneRouting: {
          assistantPhoneNumber: assignment.assistantPhoneNumber,
          voiceAgentId: assignment.voiceAgentId ?? voiceAgentId,
          providerNumberType: assignment.providerNumberType,
          assistantNumberAssignedAt: new Date(),
          assistantNumberProvisioningStatus: "assigned",
          assistantNumberLastErrorCode: undefined,
          assistantNumberProvisioningAttemptId: attemptId
        }
      });
      return {
        ...assignment,
        voiceAgentId: assignment.voiceAgentId ?? voiceAgentId,
        alreadyAssigned: false,
        provisioningStatus: "assigned"
      };
    } catch (error) {
      const sanitized = sanitizedProviderError(error);
      const status = isAmbiguousProviderFailure(error) ? "needs_operator_review" : "failed";
      await this.dependencies.users.upsert({
        userId: input.userId,
        phoneRouting: {
          assistantNumberProvisioningStatus: status,
          assistantNumberLastErrorCode: sanitized.code,
          assistantNumberProvisioningAttemptId: attemptId
        }
      });
      throw status === "needs_operator_review"
        ? conflict(
          "assistant_number_needs_operator_review",
          "Assistant number assignment may have partially completed and needs support review."
        )
        : badRequest(sanitized.code, sanitized.message);
    }
  }

  private inboundWebhookUrl(): string {
    if (!this.dependencies.publicBaseUrl) {
      throw badRequest("app_public_base_url_missing", "APP_PUBLIC_BASE_URL is required before assigning assistant numbers.");
    }
    return `${this.dependencies.publicBaseUrl.replace(/\/$/, "")}/webhooks/retell/inbound`;
  }
}

function assignmentFromProviderResponse(response: PhoneNumberResponse): Omit<AssistantNumberAssignment, "alreadyAssigned" | "provisioningStatus"> {
  return {
    assistantPhoneNumber: response.phone_number,
    providerNumberType: providerNumberTypeFor(response.phone_number_type),
    voiceAgentId: response.inbound_agent_id
  };
}

function providerNumberTypeFor(value: PhoneNumberResponse["phone_number_type"]): AssistantNumberAssignment["providerNumberType"] {
  if (value === "retell-telnyx") {
    return "telnyx";
  }
  if (value === "custom") {
    return "custom";
  }
  return "twilio";
}

function areaCodeFor(phoneNumber?: string): number | undefined {
  const digits = phoneNumber?.replace(/\D/g, "");
  if (!digits) {
    return undefined;
  }
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  const areaCode = national.slice(0, 3);
  return areaCode.length === 3 ? Number(areaCode) : undefined;
}

function sanitizedProviderError(error: unknown): { code: string; message: string } {
  const candidate = error as { code?: unknown; statusCode?: unknown; message?: unknown };
  const code = typeof candidate?.code === "string"
    ? candidate.code
    : typeof candidate?.statusCode === "number"
      ? `voice_number_provider_status_${candidate.statusCode}`
      : "assistant_number_provider_failed";
  const message = typeof candidate?.message === "string" && candidate.message.length > 0
    ? candidate.message.slice(0, 500)
    : "Assistant number assignment failed.";
  return { code, message };
}

function isAmbiguousProviderFailure(error: unknown): boolean {
  const candidate = error as { code?: unknown; statusCode?: unknown; name?: unknown };
  if (typeof candidate?.statusCode === "number" && candidate.statusCode >= 500) {
    return true;
  }
  const code = typeof candidate?.code === "string" ? candidate.code : "";
  const name = typeof candidate?.name === "string" ? candidate.name : "";
  return [
    "ETIMEDOUT",
    "ECONNRESET",
    "ECONNABORTED",
    "EAI_AGAIN",
    "ENOTFOUND",
    "TimeoutError",
    "APIConnectionError"
  ].includes(code) || name === "TimeoutError" || name === "APIConnectionError";
}
