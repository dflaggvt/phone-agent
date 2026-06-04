import { randomUUID } from "node:crypto";
import type { Firestore } from "@google-cloud/firestore";
import type { CallEvent, CallSession } from "../../domain/calls/callSession.js";
import type { CallRepository, UpsertCallSessionInput } from "../../domain/calls/callRepository.js";
import { firestoreDate, removeUndefinedDeep } from "./firestoreClient.js";

const CALLS_COLLECTION = "callSessions";
const EVENTS_COLLECTION = "callEvents";

export class FirestoreCallRepository implements CallRepository {
  constructor(private readonly firestore: Firestore) {}

  async findByProviderCallId(providerCallId: string): Promise<CallSession | undefined> {
    const snapshot = await this.firestore
      .collection(CALLS_COLLECTION)
      .where("providerCallId", "==", providerCallId)
      .limit(1)
      .get();
    const doc = snapshot.docs[0];
    return doc ? callSessionFromFirestore(doc.id, doc.data()) : undefined;
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

    await this.firestore.collection(CALLS_COLLECTION).doc(session.id).set(removeUndefinedDeep(session));
    return session;
  }

  async addEvent(event: Omit<CallEvent, "id">): Promise<CallEvent> {
    const stored = { ...event, id: randomUUID() };
    await this.firestore.collection(EVENTS_COLLECTION).doc(stored.id).set(removeUndefinedDeep(stored));
    return stored;
  }

  async listCalls(): Promise<CallSession[]> {
    const snapshot = await this.firestore
      .collection(CALLS_COLLECTION)
      .orderBy("updatedAt", "desc")
      .limit(100)
      .get();
    return snapshot.docs.map((doc) => callSessionFromFirestore(doc.id, doc.data()));
  }

  async listCallsForRoute(phoneNumber: string, limit = 100): Promise<CallSession[]> {
    const normalized = normalizePhone(phoneNumber);
    if (!normalized) {
      return [];
    }
    const queryLimit = Math.max(limit, 250);
    const [toSnapshot, fromSnapshot] = await Promise.all([
      this.firestore
        .collection(CALLS_COLLECTION)
        .where("toNumber", "==", normalized)
        .limit(queryLimit)
        .get(),
      this.firestore
        .collection(CALLS_COLLECTION)
        .where("fromNumber", "==", normalized)
        .limit(queryLimit)
        .get()
    ]);
    const byId = new Map<string, CallSession>();
    for (const doc of [...toSnapshot.docs, ...fromSnapshot.docs]) {
      byId.set(doc.id, callSessionFromFirestore(doc.id, doc.data()));
    }
    return [...byId.values()]
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, limit);
  }
}

function callSessionFromFirestore(id: string, data: Record<string, unknown>): CallSession {
  return {
    id,
    provider: data.provider === "retell" ? "retell" : "retell",
    providerCallId: getString(data.providerCallId),
    direction: data.direction === "outbound" ? "outbound" : "inbound",
    status: callStatus(data.status),
    fromNumber: getString(data.fromNumber) ?? "",
    toNumber: getString(data.toNumber) ?? "",
    agentId: getString(data.agentId),
    urgency: callUrgency(data.urgency),
    intent: getString(data.intent),
    startedAt: firestoreDate(data.startedAt),
    endedAt: firestoreDate(data.endedAt),
    transcript: getString(data.transcript),
    transcriptSegments: Array.isArray(data.transcriptSegments) ? data.transcriptSegments as CallSession["transcriptSegments"] : [],
    summary: getRecord(data.summary) as CallSession["summary"],
    metadata: getRecord(data.metadata) ?? {},
    createdAt: firestoreDate(data.createdAt) ?? new Date(0),
    updatedAt: firestoreDate(data.updatedAt) ?? new Date(0)
  };
}

function callStatus(value: unknown): CallSession["status"] {
  return value === "received" ||
    value === "in_progress" ||
    value === "transfer_requested" ||
    value === "bridged" ||
    value === "completed" ||
    value === "failed"
    ? value
    : "received";
}

function callUrgency(value: unknown): CallSession["urgency"] {
  return value === "emergency" ||
    value === "high" ||
    value === "normal" ||
    value === "low" ||
    value === "unknown"
    ? value
    : "unknown";
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? value as Record<string, unknown> : undefined;
}

function normalizePhone(value?: string): string {
  return value?.replace(/[^\d+]/g, "") ?? "";
}
