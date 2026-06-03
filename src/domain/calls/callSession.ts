export type CallDirection = "inbound" | "outbound";

export type CallSessionStatus =
  | "received"
  | "in_progress"
  | "transfer_requested"
  | "bridged"
  | "completed"
  | "failed";

export type CallUrgency = "unknown" | "low" | "normal" | "high" | "emergency";

export type NormalizedCallEventType =
  | "call_inbound"
  | "call_started"
  | "call_ended"
  | "call_analyzed"
  | "transcript_updated"
  | "outbound_call_created"
  | "transfer_started"
  | "transfer_bridged"
  | "transfer_cancelled"
  | "transfer_ended"
  | "unknown";

export interface CallParticipant {
  phoneNumber: string;
  displayName?: string;
  contactId?: string;
}

export interface CallSummary {
  text?: string;
  successful?: boolean;
  sentiment?: string;
  structuredData?: Record<string, unknown>;
}

export interface TranscriptSegment {
  speaker?: string;
  text: string;
  startMs?: number;
  endMs?: number;
  confidence?: number;
}

export interface CallSession {
  id: string;
  provider: "retell";
  providerCallId?: string;
  direction: CallDirection;
  status: CallSessionStatus;
  fromNumber: string;
  toNumber: string;
  agentId?: string;
  urgency: CallUrgency;
  intent?: string;
  startedAt?: Date;
  endedAt?: Date;
  transcript?: string;
  transcriptSegments: TranscriptSegment[];
  summary?: CallSummary;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CallEvent {
  id: string;
  callSessionId: string;
  type: NormalizedCallEventType;
  provider: "retell";
  providerCallId?: string;
  occurredAt: Date;
  payload: Record<string, unknown>;
}
