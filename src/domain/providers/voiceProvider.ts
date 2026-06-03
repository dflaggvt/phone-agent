import type { CallDirection, CallSummary, TranscriptSegment } from "../calls/callSession.js";

export type VoiceProviderName = "retell" | "twilio" | "telnyx" | "vonage" | "sip" | "custom";

export type VoiceCallEventType =
  | "inbound_call"
  | "call_started"
  | "call_ended"
  | "call_analyzed"
  | "transcript_updated"
  | "recording_available"
  | "transfer_started"
  | "transfer_bridged"
  | "transfer_cancelled"
  | "transfer_ended"
  | "unknown";

export interface VoiceInboundContextRequest {
  provider: VoiceProviderName;
  providerCallId?: string;
  fromNumber: string;
  toNumber: string;
  agentId?: string;
  rawPayload: Record<string, unknown>;
}

export interface VoiceCallEvent {
  provider: VoiceProviderName;
  providerCallId: string;
  eventType: VoiceCallEventType;
  direction: CallDirection;
  fromNumber: string;
  toNumber: string;
  agentId?: string;
  occurredAt: Date;
  startedAt?: Date;
  endedAt?: Date;
  transcript?: string;
  transcriptSegments: TranscriptSegment[];
  summary?: CallSummary;
  metadata: Record<string, unknown>;
  rawPayload: Record<string, unknown>;
}

export interface VoiceTranscriptEvent {
  provider: VoiceProviderName;
  providerCallId: string;
  occurredAt: Date;
  segments: TranscriptSegment[];
  isFinal: boolean;
  rawPayload: Record<string, unknown>;
}

export interface VoiceCallRecordingEvent {
  provider: VoiceProviderName;
  providerCallId: string;
  occurredAt: Date;
  recordingUri: string;
  durationSeconds?: number;
  contentType?: string;
  rawPayload: Record<string, unknown>;
}

export interface VoiceTransferRequest {
  providerCallId: string;
  destinationNumber: string;
  warmHandoffPrompt?: string;
}

export interface VoiceProvider {
  readonly name: VoiceProviderName;
  verifyWebhook(rawBody: string, headers: Record<string, string | string[] | undefined>): Promise<void>;
  parseInboundContextRequest(rawBody: string): VoiceInboundContextRequest;
  normalizeCallEvent(rawBody: string): VoiceCallEvent;
  bridgeToUser?(request: VoiceTransferRequest): Promise<void>;
}

