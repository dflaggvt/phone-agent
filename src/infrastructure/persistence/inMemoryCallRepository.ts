import { randomUUID } from "node:crypto";
import type { CallEvent, CallSession } from "../../domain/calls/callSession.js";
import type { CallRepository, UpsertCallSessionInput } from "../../domain/calls/callRepository.js";

export class InMemoryCallRepository implements CallRepository {
  private readonly sessions = new Map<string, CallSession>();
  private readonly providerIndex = new Map<string, string>();
  private readonly events: CallEvent[] = [];

  async findByProviderCallId(providerCallId: string): Promise<CallSession | undefined> {
    const sessionId = this.providerIndex.get(providerCallId);
    return sessionId ? this.sessions.get(sessionId) : undefined;
  }

  async upsertFromProvider(input: UpsertCallSessionInput): Promise<CallSession> {
    const now = new Date();
    const existing =
      input.providerCallId !== undefined ? await this.findByProviderCallId(input.providerCallId) : undefined;

    const session: CallSession = {
      id: existing?.id ?? randomUUID(),
      provider: "retell",
      providerCallId: input.providerCallId ?? existing?.providerCallId,
      direction: input.direction,
      status: input.status,
      fromNumber: input.fromNumber,
      toNumber: input.toNumber,
      agentId: input.agentId ?? existing?.agentId,
      urgency: existing?.urgency ?? "unknown",
      intent: existing?.intent,
      startedAt: input.startedAt ?? existing?.startedAt,
      endedAt: input.endedAt ?? existing?.endedAt,
      transcript: input.transcript ?? existing?.transcript,
      transcriptSegments: input.transcriptSegments ?? existing?.transcriptSegments ?? [],
      summary: input.summary ?? existing?.summary,
      metadata: { ...(existing?.metadata ?? {}), ...(input.metadata ?? {}) },
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };

    this.sessions.set(session.id, session);
    if (session.providerCallId) {
      this.providerIndex.set(session.providerCallId, session.id);
    }

    return session;
  }

  async addEvent(event: Omit<CallEvent, "id">): Promise<CallEvent> {
    const stored = { ...event, id: randomUUID() };
    this.events.push(stored);
    return stored;
  }

  async listCalls(): Promise<CallSession[]> {
    return [...this.sessions.values()].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async listCallsForRoute(phoneNumber: string, limit = 100): Promise<CallSession[]> {
    const normalized = normalizePhone(phoneNumber);
    if (!normalized) {
      return [];
    }
    return [...this.sessions.values()]
      .filter((session) => normalizePhone(session.toNumber) === normalized || normalizePhone(session.fromNumber) === normalized)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, limit);
  }
}

function normalizePhone(value?: string): string {
  return value?.replace(/[^\d+]/g, "") ?? "";
}
