export type AgentNoteStatus = "active" | "archived";

export interface AgentNote {
  id: string;
  userId: string;
  status: AgentNoteStatus;
  text: string;
  title?: string;
  targetPhoneNumber?: string;
  targetCallerName?: string;
  topic?: string;
  oneTime: boolean;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  usedAt?: Date;
}

export interface CreateAgentNoteInput {
  userId: string;
  text: string;
  title?: string;
  targetPhoneNumber?: string;
  targetCallerName?: string;
  topic?: string;
  oneTime?: boolean;
  expiresAt?: Date;
}

export interface UpdateAgentNoteInput {
  text?: string;
  title?: string;
  targetPhoneNumber?: string;
  targetCallerName?: string;
  topic?: string;
  oneTime?: boolean;
  status?: AgentNoteStatus;
  expiresAt?: Date | null;
}

export interface AgentNoteRepository {
  create(input: CreateAgentNoteInput): Promise<AgentNote>;
  get(id: string): Promise<AgentNote | undefined>;
  list(userId: string): Promise<AgentNote[]>;
  listActiveForCaller(userId: string, phoneNumber?: string, now?: Date): Promise<AgentNote[]>;
  update(id: string, userId: string, input: UpdateAgentNoteInput): Promise<AgentNote | undefined>;
  archive(id: string, userId: string): Promise<AgentNote | undefined>;
  markUsed(id: string): Promise<AgentNote | undefined>;
}
