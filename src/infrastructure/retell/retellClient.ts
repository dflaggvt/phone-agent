import Retell from "retell-sdk";
import type { CallCreatePhoneCallParams, PhoneCallResponse } from "retell-sdk/resources/call.js";
import type { PhoneNumberCreateParams, PhoneNumberResponse, PhoneNumberUpdateParams } from "retell-sdk/resources/phone-number.js";
import { badRequest } from "../../shared/httpErrors.js";

export interface CreateOutboundPhoneCallInput {
  fromNumber: string;
  toNumber: string;
  overrideAgentId?: string;
  metadata?: Record<string, unknown>;
  dynamicVariables?: Record<string, unknown>;
}

export interface RetellCallClient {
  createOutboundPhoneCall(input: CreateOutboundPhoneCallInput): Promise<PhoneCallResponse>;
}

export interface PurchaseRetellPhoneNumberInput {
  areaCode?: number;
  phoneNumber?: string;
  inboundAgentId?: string;
  outboundAgentId?: string;
  inboundWebhookUrl: string;
  nickname?: string;
  provider?: "twilio" | "telnyx";
}

export interface RetellPhoneNumberClient {
  purchasePhoneNumber(input: PurchaseRetellPhoneNumberInput): Promise<PhoneNumberResponse>;
  updatePhoneNumber(phoneNumber: string, input: {
    inboundAgentId?: string | null;
    outboundAgentId?: string | null;
    inboundWebhookUrl?: string | null;
    nickname?: string | null;
  }): Promise<PhoneNumberResponse>;
}

export class RetellSdkCallClient implements RetellCallClient {
  private readonly client: Retell;

  constructor(apiKey: string) {
    this.client = new Retell({ apiKey });
  }

  async createOutboundPhoneCall(input: CreateOutboundPhoneCallInput): Promise<PhoneCallResponse> {
    const body: CallCreatePhoneCallParams = {
      from_number: input.fromNumber,
      to_number: input.toNumber,
      override_agent_id: input.overrideAgentId,
      metadata: input.metadata,
      retell_llm_dynamic_variables: input.dynamicVariables
    };

    return this.client.call.createPhoneCall(body);
  }
}

export class RetellSdkPhoneNumberClient implements RetellPhoneNumberClient {
  private readonly client: Retell;

  constructor(apiKey: string) {
    this.client = new Retell({ apiKey });
  }

  purchasePhoneNumber(input: PurchaseRetellPhoneNumberInput): Promise<PhoneNumberResponse> {
    const body: PhoneNumberCreateParams = {
      area_code: input.areaCode,
      phone_number: input.phoneNumber,
      inbound_agent_id: input.inboundAgentId ?? null,
      outbound_agent_id: input.outboundAgentId ?? input.inboundAgentId ?? null,
      inbound_webhook_url: input.inboundWebhookUrl,
      nickname: input.nickname,
      number_provider: input.provider ?? "twilio",
      country_code: "US"
    };
    return this.client.phoneNumber.create(body);
  }

  updatePhoneNumber(phoneNumber: string, input: {
    inboundAgentId?: string | null;
    outboundAgentId?: string | null;
    inboundWebhookUrl?: string | null;
    nickname?: string | null;
  }): Promise<PhoneNumberResponse> {
    const body: PhoneNumberUpdateParams = {
      inbound_agent_id: input.inboundAgentId,
      outbound_agent_id: input.outboundAgentId,
      inbound_webhook_url: input.inboundWebhookUrl,
      nickname: input.nickname
    };
    return this.client.phoneNumber.update(phoneNumber, body);
  }
}

export class MissingRetellCallClient implements RetellCallClient {
  async createOutboundPhoneCall(): Promise<PhoneCallResponse> {
    throw badRequest("retell_api_key_missing", "RETELL_API_KEY is required to create Retell phone calls.");
  }
}

export class MissingRetellPhoneNumberClient implements RetellPhoneNumberClient {
  async purchasePhoneNumber(): Promise<PhoneNumberResponse> {
    throw badRequest("retell_api_key_missing", "RETELL_API_KEY is required to provision Retell phone numbers.");
  }

  async updatePhoneNumber(): Promise<PhoneNumberResponse> {
    throw badRequest("retell_api_key_missing", "RETELL_API_KEY is required to update Retell phone numbers.");
  }
}
