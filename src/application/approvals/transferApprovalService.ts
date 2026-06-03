import type { ApprovalRequest, ApprovalRequestRepository } from "../../domain/approvals/approvalRequest.js";
import type { NotificationActionSurface } from "../../domain/notifications/notificationActionAudit.js";
import type { NotificationService } from "../notifications/notificationService.js";
import type { AppLogger } from "../../shared/logger.js";

export interface TransferApprovalToolInput {
  userId?: string;
  providerCallId?: string;
  callerNumber?: string;
  callerName?: string;
  reason: string;
  urgency?: ApprovalRequest["urgency"];
  transferToNumber?: string;
}

export interface TransferApprovalToolResult {
  approval_request_id?: string;
  status: "accepted" | "declined" | "expired" | "unavailable";
  transfer_number?: string;
  message: string;
}

export class TransferApprovalService {
  constructor(
    private readonly dependencies: {
      approvals: ApprovalRequestRepository;
      notifications?: NotificationService;
      logger: AppLogger;
      transferToNumber?: string;
      timeoutMs?: number;
      pollIntervalMs?: number;
    }
  ) {}

  async listPending(userId?: string): Promise<ApprovalRequest[]> {
    const approvals = await this.dependencies.approvals.listPending();
    return userId ? approvals.filter((approval) => approval.userId === userId) : approvals;
  }

  async accept(id: string, userId?: string, surface: NotificationActionSurface = "app_screen"): Promise<ApprovalRequest | undefined> {
    if (userId && !(await this.isUserRequest(id, userId))) {
      return undefined;
    }
    const startedAt = Date.now();
    const request = await this.dependencies.approvals.accept(id);
    await this.afterAction(request, "accept", surface, Date.now() - startedAt);
    return request;
  }

  async decline(id: string, userId?: string, surface: NotificationActionSurface = "app_screen"): Promise<ApprovalRequest | undefined> {
    if (userId && !(await this.isUserRequest(id, userId))) {
      return undefined;
    }
    const startedAt = Date.now();
    const request = await this.dependencies.approvals.decline(id);
    await this.afterAction(request, "decline", surface, Date.now() - startedAt);
    return request;
  }

  async requestAndWait(input: TransferApprovalToolInput): Promise<TransferApprovalToolResult> {
    const transferToNumber = input.transferToNumber ?? this.dependencies.transferToNumber;
    if (!transferToNumber) {
      return {
        status: "unavailable",
        message: "The user's live transfer number is not configured. Take a message instead."
      };
    }

    const approval = await this.dependencies.approvals.create({
      userId: input.userId,
      providerCallId: input.providerCallId,
      callerNumber: input.callerNumber,
      callerName: input.callerName,
      reason: input.reason,
      urgency: input.urgency,
      transferToNumber,
      timeoutMs: this.dependencies.timeoutMs
    });
    await this.dependencies.notifications?.createTransferRequest({
      userId: input.userId,
      approvalRequestId: approval.id,
      callerName: approval.callerName,
      callerNumber: approval.callerNumber,
      reason: approval.reason,
      urgency: approval.urgency,
      expiresAt: approval.expiresAt
    });

    this.dependencies.logger.info(
      {
        approvalRequestId: approval.id,
        providerCallId: approval.providerCallId,
        callerNumber: approval.callerNumber,
        urgency: approval.urgency
      },
      "warm transfer approval requested"
    );

    const deadline = approval.expiresAt.getTime();
    while (Date.now() < deadline) {
      const current = await this.dependencies.approvals.get(approval.id);
      if (current?.status === "accepted") {
        return {
          approval_request_id: approval.id,
          status: "accepted",
          transfer_number: transferToNumber,
          message: "The user accepted the transfer. Use the live transfer tool now."
        };
      }

      if (current?.status === "declined") {
        return {
          approval_request_id: approval.id,
          status: "declined",
          message: "The user declined the transfer. Take a concise message instead."
        };
      }

      await sleep(this.dependencies.pollIntervalMs ?? 1000);
    }

    await this.dependencies.approvals.expirePending();
    return {
      approval_request_id: approval.id,
      status: "expired",
      message: "The user did not respond in time. Take a concise message instead."
    };
  }

  private async isUserRequest(id: string, userId: string): Promise<boolean> {
    const approval = await this.dependencies.approvals.get(id);
    return approval?.userId === userId;
  }

  private async afterAction(
    request: ApprovalRequest | undefined,
    action: "accept" | "decline",
    surface: NotificationActionSurface,
    latencyMs: number
  ): Promise<void> {
    if (!request?.userId) {
      return;
    }
    const result = request.status === "accepted"
      ? "accepted"
      : request.status === "declined"
        ? "declined"
        : request.status === "expired"
          ? "expired"
          : "failed";
    await this.dependencies.notifications?.recordAction({
      userId: request.userId,
      sourceType: "approval_request",
      sourceId: request.id,
      action,
      surface,
      result,
      latencyMs,
      errorCode: result === "failed" ? "approval_not_terminal" : undefined
    });
    if (result !== "failed") {
      await this.dependencies.notifications?.dismissBySource(request.userId, "approval_request", request.id);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
