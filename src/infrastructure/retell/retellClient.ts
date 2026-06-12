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

export interface PurchaseVoiceNumberInput {
  areaCode?: number;
  inboundAgentId?: string;
  outboundAgentId?: string;
  inboundWebhookUrl: string;
  nickname?: string;
  provider?: "twilio" | "telnyx";
}

export interface VoiceNumberProviderClient {
  purchaseNumber(input: PurchaseVoiceNumberInput): Promise<PhoneNumberResponse>;
  retrieveNumber(assistantPhoneNumber: string): Promise<PhoneNumberResponse>;
  listNumbers(): Promise<PhoneNumberResponse[]>;
  updateNumber(assistantPhoneNumber: string, input: {
    inboundAgentId?: string | null;
    outboundAgentId?: string | null;
    inboundWebhookUrl?: string | null;
    nickname?: string | null;
  }): Promise<PhoneNumberResponse>;
  releaseNumber(assistantPhoneNumber: string): Promise<void>;
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

export class RetellVoiceNumberProviderClient implements VoiceNumberProviderClient {
  private readonly client: Retell;

  constructor(apiKey: string) {
    this.client = new Retell({ apiKey });
  }

  purchaseNumber(input: PurchaseVoiceNumberInput): Promise<PhoneNumberResponse> {
    const body: PhoneNumberCreateParams = {
      area_code: input.areaCode,
      inbound_agent_id: input.inboundAgentId ?? null,
      outbound_agent_id: input.outboundAgentId ?? input.inboundAgentId ?? null,
      inbound_webhook_url: input.inboundWebhookUrl,
      nickname: input.nickname,
      number_provider: input.provider ?? "twilio",
      country_code: "US"
    };
    return this.client.phoneNumber.create(body);
  }

  retrieveNumber(assistantPhoneNumber: string): Promise<PhoneNumberResponse> {
    return this.client.phoneNumber.retrieve(assistantPhoneNumber);
  }

  listNumbers(): Promise<PhoneNumberResponse[]> {
    return this.client.phoneNumber.list();
  }

  updateNumber(assistantPhoneNumber: string, input: {
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
    return this.client.phoneNumber.update(assistantPhoneNumber, body);
  }

  releaseNumber(assistantPhoneNumber: string): Promise<void> {
    return this.client.phoneNumber.delete(assistantPhoneNumber);
  }
}

export class MissingRetellCallClient implements RetellCallClient {
  async createOutboundPhoneCall(): Promise<PhoneCallResponse> {
    throw badRequest("retell_api_key_missing", "RETELL_API_KEY is required to create Retell phone calls.");
  }
}

export class MissingVoiceNumberProviderClient implements VoiceNumberProviderClient {
  async purchaseNumber(): Promise<PhoneNumberResponse> {
    throw badRequest("retell_api_key_missing", "RETELL_API_KEY is required to provision Retell phone numbers.");
  }

  async retrieveNumber(): Promise<PhoneNumberResponse> {
    throw badRequest("retell_api_key_missing", "RETELL_API_KEY is required to retrieve Retell phone numbers.");
  }

  async listNumbers(): Promise<PhoneNumberResponse[]> {
    throw badRequest("retell_api_key_missing", "RETELL_API_KEY is required to list Retell phone numbers.");
  }

  async updateNumber(): Promise<PhoneNumberResponse> {
    throw badRequest("retell_api_key_missing", "RETELL_API_KEY is required to update Retell phone numbers.");
  }

  async releaseNumber(): Promise<void> {
    throw badRequest("retell_api_key_missing", "RETELL_API_KEY is required to release Retell phone numbers.");
  }
}
