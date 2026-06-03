import type {
  AgentNote,
  AgentNoteRepository,
  CreateAgentNoteInput,
  UpdateAgentNoteInput
} from "../../domain/agentNotes/agentNote.js";

export class AgentNoteService {
  constructor(private readonly dependencies: { notes: AgentNoteRepository }) {}

  async create(input: CreateAgentNoteInput): Promise<AgentNote> {
    return this.dependencies.notes.create(input);
  }

  async list(userId: string): Promise<AgentNote[]> {
    return this.dependencies.notes.list(userId);
  }

  async update(id: string, userId: string, input: UpdateAgentNoteInput): Promise<AgentNote | undefined> {
    return this.dependencies.notes.update(id, userId, input);
  }

  async archive(id: string, userId: string): Promise<AgentNote | undefined> {
    return this.dependencies.notes.archive(id, userId);
  }

  async activeContextForCaller(userId: string, phoneNumber?: string): Promise<string> {
    const notes = await this.dependencies.notes.listActiveForCaller(userId, phoneNumber);
    if (notes.length === 0) {
      return "";
    }

    return notes
      .slice(0, 5)
      .map((note, index) => {
        const scope = note.targetPhoneNumber
          ? `for ${note.targetCallerName || note.targetPhoneNumber}`
          : "general";
        const topic = note.topic ? ` Topic: ${note.topic}.` : "";
        return `${index + 1}. User note (${scope}): ${note.text}${topic}`;
      })
      .join(" ");
  }
}
