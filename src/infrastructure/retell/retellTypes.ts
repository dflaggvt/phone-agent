import { z } from "zod";

export const retellEventTypeSchema = z.enum([
  "call_started",
  "call_ended",
  "call_analyzed",
  "transcript_updated",
  "transfer_started",
  "transfer_bridged",
  "transfer_cancelled",
  "transfer_ended"
]);

export type RetellEventType = z.infer<typeof retellEventTypeSchema>;

export const retellInboundWebhookSchema = z.object({
  event: z.literal("call_inbound"),
  call_inbound: z.object({
    agent_id: z.string().optional(),
    agent_version: z.number().optional(),
    from_number: z.string(),
    to_number: z.string()
  })
});

export type RetellInboundWebhook = z.infer<typeof retellInboundWebhookSchema>;

export const retellCallSchema = z
  .object({
    call_id: z.string(),
    call_type: z.string().optional(),
    direction: z.enum(["inbound", "outbound"]).optional(),
    from_number: z.string().optional(),
    to_number: z.string().optional(),
    agent_id: z.string().optional(),
    call_status: z.string().optional(),
    start_timestamp: z.number().optional(),
    end_timestamp: z.number().optional(),
    disconnection_reason: z.string().optional(),
    transcript: z.string().optional(),
    transcript_object: z.array(z.unknown()).optional(),
    transcript_with_tool_calls: z.array(z.unknown()).optional(),
    call_analysis: z.record(z.unknown()).optional(),
    metadata: z.record(z.unknown()).optional(),
    retell_llm_dynamic_variables: z.record(z.unknown()).optional(),
    opt_out_sensitive_data_storage: z.boolean().optional()
  })
  .passthrough();

export const retellCallEventWebhookSchema = z
  .object({
    event: retellEventTypeSchema,
    call: retellCallSchema,
    transfer_destination: z.unknown().optional(),
    transfer_option: z.unknown().optional()
  })
  .passthrough();

export type RetellCallEventWebhook = z.infer<typeof retellCallEventWebhookSchema>;

