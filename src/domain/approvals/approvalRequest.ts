export type ApprovalRequestStatus = "pending" | "accepted" | "declined" | "expired";

export interface ApprovalRequest {
  id: string;
  userId?: string;
  type: "warm_transfer";
  status: ApprovalRequestStatus;
  providerCallId?: string;
  callerNumber?: string;
  callerName?: string;
  reason: string;
  urgency: "unknown" | "low" | "normal" | "high" | "emergency";
  transferToNumber?: string;
  createdAt: Date;
  expiresAt: Date;
  decidedAt?: Date;
}

export interface CreateApprovalRequestInput {
  userId?: string;
  providerCallId?: string;
  callerNumber?: string;
  callerName?: string;
  reason: string;
  urgency?: ApprovalRequest["urgency"];
  transferToNumber?: string;
  timeoutMs?: number;
}

export interface ApprovalRequestRepository {
  create(input: CreateApprovalRequestInput): Promise<ApprovalRequest>;
  get(id: string): Promise<ApprovalRequest | undefined>;
  listPending(now?: Date): Promise<ApprovalRequest[]>;
  accept(id: string): Promise<ApprovalRequest | undefined>;
  decline(id: string): Promise<ApprovalRequest | undefined>;
  expirePending(now?: Date): Promise<void>;
}
