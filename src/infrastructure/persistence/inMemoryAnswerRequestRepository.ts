import { randomUUID } from "node:crypto";
import type {
  AnswerRequest,
  AnswerRequestRepository,
  AnswerRequestStatus,
  CreateAnswerRequestInput
} from "../../domain/answerRequests/answerRequest.js";

export class InMemoryAnswerRequestRepository implements AnswerRequestRepository {
  private readonly answerRequests = new Map<string, AnswerRequest>();

  async create(input: CreateAnswerRequestInput): Promise<AnswerRequest> {
    const now = new Date();
    const answerRequest: AnswerRequest = {
      id: randomUUID(),
      userId: input.userId,
      type: "live_answer",
      status: "pending",
      providerCallId: input.providerCallId,
      callerNumber: input.callerNumber,
      callerName: input.callerName,
      question: input.question,
      reason: input.reason,
      urgency: input.urgency ?? "unknown",
      createdAt: now,
      expiresAt: new Date(now.getTime() + (input.timeoutMs ?? 45_000))
    };
    this.answerRequests.set(answerRequest.id, answerRequest);
    return answerRequest;
  }

  async get(id: string): Promise<AnswerRequest | undefined> {
    await this.expirePending();
    return this.answerRequests.get(id);
  }

  async listPending(now = new Date()): Promise<AnswerRequest[]> {
    await this.expirePending(now);
    return [...this.answerRequests.values()]
      .filter((request) => request.status === "pending")
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async answer(id: string, answer: string): Promise<AnswerRequest | undefined> {
    return this.decide(id, "answered", answer);
  }

  async decline(id: string): Promise<AnswerRequest | undefined> {
    return this.decide(id, "declined");
  }

  async expirePending(now = new Date()): Promise<void> {
    for (const request of this.answerRequests.values()) {
      if (request.status === "pending" && request.expiresAt.getTime() <= now.getTime()) {
        this.answerRequests.set(request.id, { ...request, status: "expired", respondedAt: now });
      }
    }
  }

  private async decide(
    id: string,
    status: Extract<AnswerRequestStatus, "answered" | "declined">,
    answer?: string
  ): Promise<AnswerRequest | undefined> {
    await this.expirePending();
    const existing = this.answerRequests.get(id);
    if (!existing) {
      return undefined;
    }
    if (existing.status !== "pending") {
      return existing;
    }
    const updated = { ...existing, status, answer, respondedAt: new Date() };
    this.answerRequests.set(id, updated);
    return updated;
  }
}
