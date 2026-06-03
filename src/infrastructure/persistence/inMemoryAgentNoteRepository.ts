import { randomUUID } from "node:crypto";
import type {
  AgentNote,
  AgentNoteRepository,
  CreateAgentNoteInput,
  UpdateAgentNoteInput
} from "../../domain/agentNotes/agentNote.js";

export class InMemoryAgentNoteRepository implements AgentNoteRepository {
  private readonly notes = new Map<string, AgentNote>();

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
    this.notes.set(note.id, note);
    return note;
  }

  async get(id: string): Promise<AgentNote | undefined> {
    return this.notes.get(id);
  }

  async list(userId: string): Promise<AgentNote[]> {
    return [...this.notes.values()]
      .filter((note) => note.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async listActiveForCaller(userId: string, phoneNumber?: string, now = new Date()): Promise<AgentNote[]> {
    const normalized = normalizePhone(phoneNumber);
    return [...this.notes.values()]
      .filter((note) => note.userId === userId)
      .filter((note) => isActive(note, now))
      .filter((note) => {
        const target = normalizePhone(note.targetPhoneNumber);
        return !target || (normalized && target === normalized);
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async update(id: string, userId: string, input: UpdateAgentNoteInput): Promise<AgentNote | undefined> {
    const existing = this.notes.get(id);
    if (!existing || existing.userId !== userId) {
      return undefined;
    }
    const updated: AgentNote = {
      ...existing,
      ...withoutUndefined(input),
      expiresAt: input.expiresAt === null ? undefined : input.expiresAt ?? existing.expiresAt,
      updatedAt: new Date()
    };
    this.notes.set(id, updated);
    return updated;
  }

  async archive(id: string, userId: string): Promise<AgentNote | undefined> {
    return this.update(id, userId, { status: "archived" });
  }

  async markUsed(id: string): Promise<AgentNote | undefined> {
    const existing = this.notes.get(id);
    if (!existing) {
      return undefined;
    }
    const now = new Date();
    const updated: AgentNote = {
      ...existing,
      status: existing.oneTime ? "archived" : existing.status,
      usedAt: now,
      updatedAt: now
    };
    this.notes.set(id, updated);
    return updated;
  }
}

function isActive(note: AgentNote, now: Date): boolean {
  return note.status === "active" && (!note.expiresAt || note.expiresAt.getTime() > now.getTime());
}

function normalizePhone(value?: string): string | undefined {
  const digits = value?.replace(/\D/g, "");
  return digits && digits.length > 0 ? digits : undefined;
}

function withoutUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, child]) => child !== undefined)) as T;
}
