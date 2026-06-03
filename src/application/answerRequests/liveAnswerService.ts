import type { AnswerRequest, AnswerRequestRepository } from "../../domain/answerRequests/answerRequest.js";
import type { NotificationActionSurface } from "../../domain/notifications/notificationActionAudit.js";
import type { NotificationService } from "../notifications/notificationService.js";
import type { AppLogger } from "../../shared/logger.js";

export interface LiveAnswerToolInput {
  userId?: string;
  providerCallId?: string;
  callerNumber?: string;
  callerName?: string;
  question: string;
  reason?: string;
  urgency?: AnswerRequest["urgency"];
}

export interface LiveAnswerToolResult {
  answer_request_id?: string;
  status: "answered" | "declined" | "expired";
  answer?: string;
  message: string;
}

export class LiveAnswerService {
  constructor(
    private readonly dependencies: {
      answerRequests: AnswerRequestRepository;
      notifications?: NotificationService;
      logger: AppLogger;
      timeoutMs?: number;
      pollIntervalMs?: number;
    }
  ) {}

  async listPending(userId?: string): Promise<AnswerRequest[]> {
    const requests = await this.dependencies.answerRequests.listPending();
    return userId ? requests.filter((request) => request.userId === userId) : requests;
  }

  async answer(id: string, answer: string, userId?: string, surface: NotificationActionSurface = "app_screen"): Promise<AnswerRequest | undefined> {
    if (userId && !(await this.isUserRequest(id, userId))) {
      return undefined;
    }
    const startedAt = Date.now();
    const request = await this.dependencies.answerRequests.answer(id, answer);
    await this.afterAction(request, "reply", surface, Date.now() - startedAt);
    return request;
  }

  async decline(id: string, userId?: string, surface: NotificationActionSurface = "app_screen"): Promise<AnswerRequest | undefined> {
    if (userId && !(await this.isUserRequest(id, userId))) {
      return undefined;
    }
    const startedAt = Date.now();
    const request = await this.dependencies.answerRequests.decline(id);
    await this.afterAction(request, "decline", surface, Date.now() - startedAt);
    return request;
  }

  async requestAndWait(input: LiveAnswerToolInput): Promise<LiveAnswerToolResult> {
    const request = await this.dependencies.answerRequests.create({
      userId: input.userId,
      providerCallId: input.providerCallId,
      callerNumber: input.callerNumber,
      callerName: input.callerName,
      question: input.question,
      reason: input.reason,
      urgency: input.urgency,
      timeoutMs: this.dependencies.timeoutMs
    });
    await this.dependencies.notifications?.createLiveAnswerRequest({
      userId: input.userId,
      answerRequestId: request.id,
      callerName: request.callerName,
      callerNumber: request.callerNumber,
      question: request.question,
      urgency: request.urgency,
      expiresAt: request.expiresAt
    });

    this.dependencies.logger.info(
      {
        answerRequestId: request.id,
        providerCallId: request.providerCallId,
        callerNumber: request.callerNumber,
        urgency: request.urgency
      },
      "live answer requested"
    );

    const deadline = request.expiresAt.getTime();
    while (Date.now() < deadline) {
      const current = await this.dependencies.answerRequests.get(request.id);
      if (current?.status === "answered" && current.answer) {
        return {
          answer_request_id: request.id,
          status: "answered",
          answer: current.answer,
          message: "The user answered. Relay the answer naturally and briefly to the caller."
        };
      }

      if (current?.status === "declined") {
        return {
          answer_request_id: request.id,
          status: "declined",
          message: "The user declined to answer right now. Take a concise message instead."
        };
      }

      await sleep(this.dependencies.pollIntervalMs ?? 1000);
    }

    await this.dependencies.answerRequests.expirePending();
    return {
      answer_request_id: request.id,
      status: "expired",
      message: "The user did not answer in time. Take a concise message instead."
    };
  }

  private async isUserRequest(id: string, userId: string): Promise<boolean> {
    const request = await this.dependencies.answerRequests.get(id);
    return request?.userId === userId;
  }

  private async afterAction(
    request: AnswerRequest | undefined,
    action: "reply" | "decline",
    surface: NotificationActionSurface,
    latencyMs: number
  ): Promise<void> {
    if (!request?.userId) {
      return;
    }
    const result = request.status === "answered"
      ? "answered"
      : request.status === "declined"
        ? "declined"
        : request.status === "expired"
          ? "expired"
          : "failed";
    await this.dependencies.notifications?.recordAction({
      userId: request.userId,
      sourceType: "answer_request",
      sourceId: request.id,
      action,
      surface,
      result,
      latencyMs,
      errorCode: result === "failed" ? "answer_not_terminal" : undefined
    });
    if (result !== "failed") {
      await this.dependencies.notifications?.dismissBySource(request.userId, "answer_request", request.id);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
