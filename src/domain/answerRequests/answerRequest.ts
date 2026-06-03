export type AnswerRequestStatus = "pending" | "answered" | "declined" | "expired";

export interface AnswerRequest {
  id: string;
  userId?: string;
  type: "live_answer";
  status: AnswerRequestStatus;
  providerCallId?: string;
  callerNumber?: string;
  callerName?: string;
  question: string;
  reason?: string;
  urgency: "unknown" | "low" | "normal" | "high" | "emergency";
  answer?: string;
  createdAt: Date;
  expiresAt: Date;
  respondedAt?: Date;
}

export interface CreateAnswerRequestInput {
  userId?: string;
  providerCallId?: string;
  callerNumber?: string;
  callerName?: string;
  question: string;
  reason?: string;
  urgency?: AnswerRequest["urgency"];
  timeoutMs?: number;
}

export interface AnswerRequestRepository {
  create(input: CreateAnswerRequestInput): Promise<AnswerRequest>;
  get(id: string): Promise<AnswerRequest | undefined>;
  listPending(now?: Date): Promise<AnswerRequest[]>;
  answer(id: string, answer: string): Promise<AnswerRequest | undefined>;
  decline(id: string): Promise<AnswerRequest | undefined>;
  expirePending(now?: Date): Promise<void>;
}
