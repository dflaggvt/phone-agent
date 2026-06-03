import { randomUUID } from "node:crypto";
import type { Firestore } from "@google-cloud/firestore";
import type {
  AgentNote,
  AgentNoteRepository,
  AgentNoteStatus,
  CreateAgentNoteInput,
  UpdateAgentNoteInput
} from "../../domain/agentNotes/agentNote.js";
import { firestoreDate, removeUndefinedDeep } from "./firestoreClient.js";

const AGENT_NOTE_COLLECTION = "agentNotes";

export class FirestoreAgentNoteRepository implements AgentNoteRepository {
  constructor(private readonly firestore: Firestore) {}

  async create(input: CreateAgentNoteInput): Promise<AgentNote> {
    const now = new Date();
    const note: AgentNote = {
      id: randomUUID(),
      userId: input.userId,
      status: "active",
      text: input.text,
      title: input.title,
      targetPhoneNumber: input.targetPhoneNumber,
      targetCallerName: input.targetCallerName,
      topic: input.topic,
      oneTime: input.oneTime ?? false,
      createdAt: now,
      updatedAt: now,
      expiresAt: input.expiresAt
    };
    await this.collection().doc(note.id).set(removeUndefinedDeep(note));
    return note;
  }

  async get(id: string): Promise<AgentNote | undefined> {
    const doc = await this.collection().doc(id).get();
    return doc.exists ? noteFromFirestore(doc.id, doc.data() ?? {}) : undefined;
  }

  async list(userId: string): Promise<AgentNote[]> {
    const snapshot = await this.collection()
      .where("userId", "==", userId)
      .limit(100)
      .get();
    return snapshot.docs
      .map((doc) => noteFromFirestore(doc.id, doc.data()))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async listActiveForCaller(userId: string, phoneNumber?: string, now = new Date()): Promise<AgentNote[]> {
    const normalized = normalizePhone(phoneNumber);
    const snapshot = await this.collection()
      .where("userId", "==", userId)
      .where("status", "==", "active")
      .limit(100)
      .get();

    return snapshot.docs
      .map((doc) => noteFromFirestore(doc.id, doc.data()))
      .filter((note) => !note.expiresAt || note.expiresAt.getTime() > now.getTime())
      .filter((note) => {
        const target = normalizePhone(note.targetPhoneNumber);
        return !target || (normalized && target === normalized);
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async update(id: string, userId: string, input: UpdateAgentNoteInput): Promise<AgentNote | undefined> {
    const docRef = this.collection().doc(id);
    return this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(docRef);
      if (!snapshot.exists) {
        return undefined;
      }
      const existing = noteFromFirestore(snapshot.id, snapshot.data() ?? {});
      if (existing.userId !== userId) {
        return undefined;
      }
      const updated: AgentNote = {
        ...existing,
        ...withoutUndefined(input),
        expiresAt: input.expiresAt === null ? undefined : input.expiresAt ?? existing.expiresAt,
        updatedAt: new Date()
      };
      transaction.set(docRef, removeUndefinedDeep(updated));
      return updated;
    });
  }

  async archive(id: string, userId: string): Promise<AgentNote | undefined> {
    return this.update(id, userId, { status: "archived" });
  }

  async markUsed(id: string): Promise<AgentNote | undefined> {
    const docRef = this.collection().doc(id);
    return this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(docRef);
      if (!snapshot.exists) {
        return undefined;
      }
      const existing = noteFromFirestore(snapshot.id, snapshot.data() ?? {});
      const now = new Date();
      const updated: AgentNote = {
        ...existing,
        status: existing.oneTime ? "archived" : existing.status,
        usedAt: now,
        updatedAt: now
      };
      transaction.set(docRef, removeUndefinedDeep(updated));
      return updated;
    });
  }

  private collection() {
    return this.firestore.collection(AGENT_NOTE_COLLECTION);
  }
}

function noteFromFirestore(id: string, data: Record<string, unknown>): AgentNote {
  return {
    id: getString(data.id) ?? id,
    userId: getString(data.userId) ?? "",
    status: agentNoteStatus(data.status),
    text: getString(data.text) ?? "",
    title: getString(data.title),
    targetPhoneNumber: getString(data.targetPhoneNumber),
    targetCallerName: getString(data.targetCallerName),
    topic: getString(data.topic),
    oneTime: data.oneTime === true,
    createdAt: firestoreDate(data.createdAt) ?? new Date(0),
    updatedAt: firestoreDate(data.updatedAt) ?? new Date(0),
    expiresAt: firestoreDate(data.expiresAt),
    usedAt: firestoreDate(data.usedAt)
  };
}

function agentNoteStatus(value: unknown): AgentNoteStatus {
  return value === "archived" ? value : "active";
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizePhone(value?: string): string | undefined {
  const digits = value?.replace(/\D/g, "");
  return digits && digits.length > 0 ? digits : undefined;
}

function withoutUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, child]) => child !== undefined)) as T;
}
