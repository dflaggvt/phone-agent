import { Router } from "express";
import type { LiveAnswerService } from "../application/answerRequests/liveAnswerService.js";
import type { TransferApprovalService } from "../application/approvals/transferApprovalService.js";
import { conflict, notFound } from "../shared/httpErrors.js";
import { answerRequestReplySchema } from "./clientSchemas.js";
import { asyncHandler, currentUserId, notificationActionSurface, requireRouteParam } from "./routeSupport.js";

export function liveActionRoutes(input: {
  liveAnswers: LiveAnswerService;
  transferApprovals: TransferApprovalService;
}) {
  const router = Router();

  router.get("/approval-requests", asyncHandler(async (_req, res) => {
    const approvalRequests = await input.transferApprovals.listPending(currentUserId(res));
    res.status(200).json({ approvalRequests });
  }));

  router.post("/approval-requests/:approvalRequestId/accept", asyncHandler(async (req, res) => {
    const approvalRequestId = requireRouteParam(req.params.approvalRequestId, "approvalRequestId");
    const approvalRequest = await input.transferApprovals.accept(approvalRequestId, currentUserId(res), notificationActionSurface(req));
    if (!approvalRequest) {
      throw notFound("approval_request_not_found", "Approval request was not found.");
    }
    if (approvalRequest.status === "expired") {
      throw conflict("approval_request_expired", "This transfer request expired.");
    }
    res.status(200).json({ approvalRequest });
  }));

  router.post("/approval-requests/:approvalRequestId/decline", asyncHandler(async (req, res) => {
    const approvalRequestId = requireRouteParam(req.params.approvalRequestId, "approvalRequestId");
    const approvalRequest = await input.transferApprovals.decline(approvalRequestId, currentUserId(res), notificationActionSurface(req));
    if (!approvalRequest) {
      throw notFound("approval_request_not_found", "Approval request was not found.");
    }
    if (approvalRequest.status === "expired") {
      throw conflict("approval_request_expired", "This transfer request expired.");
    }
    res.status(200).json({ approvalRequest });
  }));

  router.get("/answer-requests", asyncHandler(async (_req, res) => {
    const answerRequests = await input.liveAnswers.listPending(currentUserId(res));
    res.status(200).json({ answerRequests });
  }));

  router.post("/answer-requests/:answerRequestId/reply", asyncHandler(async (req, res) => {
    const answerRequestId = requireRouteParam(req.params.answerRequestId, "answerRequestId");
    const parsed = answerRequestReplySchema.parse(req.body);
    const answerRequest = await input.liveAnswers.answer(answerRequestId, parsed.answer, currentUserId(res), notificationActionSurface(req));
    if (!answerRequest) {
      throw notFound("answer_request_not_found", "Answer request was not found.");
    }
    if (answerRequest.status === "expired") {
      throw conflict("answer_request_expired", "This answer request expired.");
    }
    res.status(200).json({ answerRequest });
  }));

  router.post("/answer-requests/:answerRequestId/decline", asyncHandler(async (req, res) => {
    const answerRequestId = requireRouteParam(req.params.answerRequestId, "answerRequestId");
    const answerRequest = await input.liveAnswers.decline(answerRequestId, currentUserId(res), notificationActionSurface(req));
    if (!answerRequest) {
      throw notFound("answer_request_not_found", "Answer request was not found.");
    }
    if (answerRequest.status === "expired") {
      throw conflict("answer_request_expired", "This answer request expired.");
    }
    res.status(200).json({ answerRequest });
  }));

  return router;
}
