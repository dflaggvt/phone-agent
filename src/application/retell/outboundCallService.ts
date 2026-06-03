import { z } from "zod";
import type { CallRepository } from "../../domain/calls/callRepository.js";
import type { RetellCallClient } from "../../infrastructure/retell/retellClient.js";
import { forbidden } from "../../shared/httpErrors.js";
import type { AppLogger } from "../../shared/logger.js";

const e164Schema = z.string().regex(/^\+[1-9]\d{1,14}$/, "Must be an E.164 phone number.");

export const createOutboundCallRequestSchema = z.object({
  approved: z.literal(true),
  fromNumber: e164Schema.optional(),
  toNumber: e164Schema,
  overrideAgentId: z.string().min(1).optional(),
  reason: z.string().min(1).max(500),
  metadata: z.record(z.unknown()).optional(),
  dynamicVariables: z.record(z.unknown()).optional()
});

export type CreateOutboundCallRequest = z.infer<typeof createOutboundCallRequestSchema>;

export class OutboundCallService {
  constructor(
    private readonly dependencies: {
      retell: RetellCallClient;
      calls: CallRepository;
      logger: AppLogger;
      defaultAgentId?: string;
      defaultFromNumber?: string;
    }
  ) {}

  async createApprovedCall(rawInput: unknown) {
    const input = createOutboundCallRequestSchema.parse(rawInput);

    if (!input.approved) {
      throw forbidden("outbound_call_not_approved", "Outbound calls require explicit user approval.");
    }

    const fromNumber = input.fromNumber ?? this.dependencies.defaultFromNumber;
    if (!fromNumber) {
      throw forbidden("outbound_from_number_missing", "fromNumber is required when RETELL_DEFAULT_FROM_NUMBER is not configured.");
    }

    const response = await this.dependencies.retell.createOutboundPhoneCall({
      fromNumber,
      toNumber: input.toNumber,
      overrideAgentId: input.overrideAgentId ?? this.dependencies.defaultAgentId,
      metadata: {
        ...(input.metadata ?? {}),
        phone_agent_managed: true,
        approval_reason: input.reason
      },
      dynamicVariables: {
        ...(input.dynamicVariables ?? {}),
        product_name: "Phone Agent",
        outbound_reason: input.reason,
        ai_disclosure: "I am an AI assistant calling on behalf of this person."
      }
    });

    const session = await this.dependencies.calls.upsertFromProvider({
      providerCallId: response.call_id,
      direction: "outbound",
      status: "received",
      fromNumber,
      toNumber: input.toNumber,
      agentId: response.agent_id,
      metadata: {
        retell_call_status: response.call_status,
        retell_agent_version: response.agent_version,
        outbound_approval_reason: input.reason
      }
    });

    await this.dependencies.calls.addEvent({
      callSessionId: session.id,
      type: "outbound_call_created",
      provider: "retell",
      providerCallId: response.call_id,
      occurredAt: new Date(),
      payload: {
        event: "phone_agent_outbound_call_created",
        retell_response: response
      }
    });

    this.dependencies.logger.info(
      {
        callSessionId: session.id,
        providerCallId: response.call_id,
        fromNumber,
        toNumber: input.toNumber
      },
      "approved outbound Retell phone call created"
    );

    return {
      callSessionId: session.id,
      providerCallId: response.call_id,
      status: response.call_status,
      agentId: response.agent_id
    };
  }
}
