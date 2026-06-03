import { badRequest } from "../../shared/httpErrors.js";
import type { CallSessionStatus, TranscriptSegment } from "../../domain/calls/callSession.js";
import type { UpsertCallSessionInput } from "../../domain/calls/callRepository.js";
import {
  retellCallEventWebhookSchema,
  retellInboundWebhookSchema,
  type RetellCallEventWebhook,
  type RetellInboundWebhook
} from "./retellTypes.js";

export interface NormalizedRetellEvent {
  eventType: RetellCallEventWebhook["event"];
  providerCallId: string;
  upsert: UpsertCallSessionInput;
  rawPayload: Record<string, unknown>;
}

export function parseRetellInboundWebhook(rawBody: string): RetellInboundWebhook {
  return parseJson(rawBody, retellInboundWebhookSchema.parse);
}

export function parseRetellCallEventWebhook(rawBody: string): NormalizedRetellEvent {
  const payload = parseJson(rawBody, retellCallEventWebhookSchema.parse);
  const { call } = payload;

  const status = mapStatus(payload.event, call.call_status, call.disconnection_reason);
  const transcriptSegments = normalizeTranscriptSegments(call.transcript_object ?? call.transcript_with_tool_calls ?? []);

  return {
    eventType: payload.event,
    providerCallId: call.call_id,
    upsert: {
      providerCallId: call.call_id,
      direction: call.direction ?? "inbound",
      status,
      fromNumber: call.from_number ?? "unknown",
      toNumber: call.to_number ?? "unknown",
      agentId: call.agent_id,
      startedAt: toDate(call.start_timestamp),
      endedAt: toDate(call.end_timestamp),
      transcript: call.transcript,
      transcriptSegments,
      summary: normalizeCallSummary(call.call_analysis),
      metadata: {
        retell_call_status: call.call_status,
        retell_disconnection_reason: call.disconnection_reason,
        retell_dynamic_variables: call.retell_llm_dynamic_variables,
        retell_metadata: call.metadata,
        retell_opt_out_sensitive_data_storage: call.opt_out_sensitive_data_storage,
        transfer_destination: payload.transfer_destination,
        transfer_option: payload.transfer_option
      }
    },
    rawPayload: payload
  };
}

function parseJson<T>(rawBody: string, parser: (value: unknown) => T): T {
  try {
    return parser(JSON.parse(rawBody));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON payload.";
    throw badRequest("retell_payload_invalid", message);
  }
}

function mapStatus(
  eventType: RetellCallEventWebhook["event"],
  callStatus: string | undefined,
  disconnectionReason: string | undefined
): CallSessionStatus {
  if (eventType === "transfer_started") {
    return "transfer_requested";
  }

  if (eventType === "transfer_bridged") {
    return "bridged";
  }

  if (eventType === "transfer_cancelled") {
    return "in_progress";
  }

  if (eventType === "call_ended" || eventType === "call_analyzed" || eventType === "transfer_ended") {
    return disconnectionReason?.startsWith("error") || callStatus === "error" ? "failed" : "completed";
  }

  return "in_progress";
}

function toDate(timestamp: number | undefined): Date | undefined {
  return timestamp === undefined ? undefined : new Date(timestamp);
}

function normalizeTranscriptSegments(rawSegments: unknown[]): TranscriptSegment[] {
  const normalized: TranscriptSegment[] = [];

  for (const segment of rawSegments) {
    if (typeof segment !== "object" || segment === null) {
      continue;
    }

    const record = segment as Record<string, unknown>;
    const text = pickString(record, ["content", "text", "words", "transcript"]);
    if (!text) {
      continue;
    }

    normalized.push({
      speaker: pickString(record, ["role", "speaker"]),
      text,
      startMs: pickNumber(record, ["start_ms", "start", "start_timestamp"]),
      endMs: pickNumber(record, ["end_ms", "end", "end_timestamp"]),
      confidence: pickNumber(record, ["confidence"])
    });
  }

  return normalized;
}

function normalizeCallSummary(callAnalysis: Record<string, unknown> | undefined) {
  if (!callAnalysis) {
    return undefined;
  }

  return {
    text: typeof callAnalysis.call_summary === "string" ? callAnalysis.call_summary : undefined,
    successful: typeof callAnalysis.call_successful === "boolean" ? callAnalysis.call_successful : undefined,
    sentiment: typeof callAnalysis.user_sentiment === "string" ? callAnalysis.user_sentiment : undefined,
    structuredData: callAnalysis
  };
}

function pickString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return undefined;
}

function pickNumber(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number") {
      return value;
    }
  }

  return undefined;
}
