import type { CallEvent, CallSession } from "./callSession.js";

export interface UpsertCallSessionInput {
  providerCallId?: string;
  direction: CallSession["direction"];
  status: CallSession["status"];
  fromNumber: string;
  toNumber: string;
  agentId?: string;
  startedAt?: Date;
  endedAt?: Date;
  transcript?: string;
  transcriptSegments?: CallSession["transcriptSegments"];
  summary?: CallSession["summary"];
  metadata?: Record<string, unknown>;
}

export interface CallRepository {
  findByProviderCallId(providerCallId: string): Promise<CallSession | undefined>;
  upsertFromProvider(input: UpsertCallSessionInput): Promise<CallSession>;
  addEvent(event: Omit<CallEvent, "id">): Promise<CallEvent>;
  listCalls(): Promise<CallSession[]>;
}

