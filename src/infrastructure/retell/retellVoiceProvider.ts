import type {
  VoiceCallEvent,
  VoiceCallEventType,
  VoiceInboundContextRequest,
  VoiceProvider
} from "../../domain/providers/voiceProvider.js";
import {
  parseRetellCallEventWebhook,
  parseRetellInboundWebhook
} from "./retellEventMapper.js";
import type { WebhookVerifier } from "./retellWebhookVerifier.js";

export class RetellVoiceProvider implements VoiceProvider {
  readonly name = "retell" as const;

  constructor(private readonly verifier: WebhookVerifier) {}

  async verifyWebhook(rawBody: string, headers: Record<string, string | string[] | undefined>): Promise<void> {
    await this.verifier.verify(rawBody, headers["x-retell-signature"]);
  }

  parseInboundContextRequest(rawBody: string): VoiceInboundContextRequest {
    const payload = parseRetellInboundWebhook(rawBody);
    return {
      provider: "retell",
      fromNumber: payload.call_inbound.from_number,
      toNumber: payload.call_inbound.to_number,
      agentId: payload.call_inbound.agent_id,
      rawPayload: payload
    };
  }

  normalizeCallEvent(rawBody: string): VoiceCallEvent {
    const normalized = parseRetellCallEventWebhook(rawBody);
    return {
      provider: "retell",
      providerCallId: normalized.providerCallId,
      eventType: mapRetellEventType(normalized.eventType),
      direction: normalized.upsert.direction,
      fromNumber: normalized.upsert.fromNumber,
      toNumber: normalized.upsert.toNumber,
      agentId: normalized.upsert.agentId,
      occurredAt: new Date(),
      startedAt: normalized.upsert.startedAt,
      endedAt: normalized.upsert.endedAt,
      transcript: normalized.upsert.transcript,
      transcriptSegments: normalized.upsert.transcriptSegments ?? [],
      summary: normalized.upsert.summary,
      metadata: normalized.upsert.metadata ?? {},
      rawPayload: normalized.rawPayload
    };
  }
}

function mapRetellEventType(eventType: string): VoiceCallEventType {
  if (eventType === "call_started" || eventType === "call_ended" || eventType === "call_analyzed" || eventType === "transcript_updated") {
    return eventType;
  }
  if (eventType === "transfer_started" || eventType === "transfer_bridged" || eventType === "transfer_cancelled" || eventType === "transfer_ended") {
    return eventType;
  }
  return "unknown";
}
