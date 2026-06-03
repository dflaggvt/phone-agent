import { randomUUID } from "node:crypto";
import type {
  ApprovalRequest,
  ApprovalRequestRepository,
  CreateApprovalRequestInput
} from "../../domain/approvals/approvalRequest.js";

export class InMemoryApprovalRequestRepository implements ApprovalRequestRepository {
  private readonly approvals = new Map<string, ApprovalRequest>();

  async create(input: CreateApprovalRequestInput): Promise<ApprovalRequest> {
    const now = new Date();
    const approval: ApprovalRequest = {
      id: randomUUID(),
      userId: input.userId,
      type: "warm_transfer",
      status: "pending",
      providerCallId: input.providerCallId,
      callerNumber: input.callerNumber,
      callerName: input.callerName,
      reason: input.reason,
      urgency: input.urgency ?? "unknown",
      transferToNumber: input.transferToNumber,
      createdAt: now,
      expiresAt: new Date(now.getTime() + (input.timeoutMs ?? 45_000))
    };
    this.approvals.set(approval.id, approval);
    return approval;
  }

  async get(id: string): Promise<ApprovalRequest | undefined> {
    await this.expirePending();
    return this.approvals.get(id);
  }

  async listPending(now = new Date()): Promise<ApprovalRequest[]> {
    await this.expirePending(now);
    return [...this.approvals.values()]
      .filter((approval) => approval.status === "pending")
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async accept(id: string): Promise<ApprovalRequest | undefined> {
    return this.decide(id, "accepted");
  }

  async decline(id: string): Promise<ApprovalRequest | undefined> {
    return this.decide(id, "declined");
  }

  async expirePending(now = new Date()): Promise<void> {
    for (const approval of this.approvals.values()) {
      if (approval.status === "pending" && approval.expiresAt.getTime() <= now.getTime()) {
        this.approvals.set(approval.id, { ...approval, status: "expired", decidedAt: now });
      }
    }
  }

  private async decide(id: string, status: "accepted" | "declined"): Promise<ApprovalRequest | undefined> {
    await this.expirePending();
    const existing = this.approvals.get(id);
    if (!existing) {
      return undefined;
    }
    if (existing.status !== "pending") {
      return existing;
    }
    const updated = { ...existing, status, decidedAt: new Date() };
    this.approvals.set(id, updated);
    return updated;
  }
}
