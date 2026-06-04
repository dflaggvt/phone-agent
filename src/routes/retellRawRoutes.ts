import { Router, type RequestHandler } from "express";
import { z } from "zod";
import type { LiveAnswerToolInput } from "../application/answerRequests/liveAnswerService.js";
import type { TransferApprovalToolInput } from "../application/approvals/transferApprovalService.js";
import type {
  CalendarEventCreateInput,
  CalendarEventUpdateInput,
  CalendarFreeBusyInput
} from "../application/calendar/googleCalendarService.js";
import { HttpError } from "../shared/httpErrors.js";
import { asyncHandler, rawBody } from "./routeSupport.js";

type RetellSignature = string | string[] | undefined;

interface RetellWebhookHandler {
  handleInbound(rawBody: string, signature: RetellSignature): Promise<unknown>;
  handleCallEvent(rawBody: string, signature: RetellSignature): Promise<void>;
}

interface RetellVerifier {
  verify(rawBody: string, signature: RetellSignature): Promise<void>;
}

interface BillingGate {
  assertPaidRuntimeAllowed(userId: string): Promise<void>;
}

interface TransferApprovalTool {
  requestAndWait(input: TransferApprovalToolInput): Promise<unknown>;
}

interface LiveAnswerTool {
  requestAndWait(input: LiveAnswerToolInput): Promise<unknown>;
}

interface CalendarTool {
  isConfigured(): boolean;
  status(userId: string): Promise<{ connected: boolean }>;
  checkFreeBusy(input: CalendarFreeBusyInput): Promise<unknown>;
  createCalendarEvent(input: CalendarEventCreateInput): Promise<unknown>;
  updateCalendarEvent(input: CalendarEventUpdateInput): Promise<unknown>;
}

export function retellRawRoutes(input: {
  providerRateLimiter: RequestHandler;
  rawJson: RequestHandler;
  retellWebhooks: RetellWebhookHandler;
  retellVerifier: RetellVerifier;
  billing: BillingGate;
  transferApprovals: TransferApprovalTool;
  liveAnswers: LiveAnswerTool;
  calendar: CalendarTool;
}) {
  const router = Router();
  const rawMiddleware = [input.providerRateLimiter, input.rawJson];

  router.post("/webhooks/retell/inbound", rawMiddleware, asyncHandler(async (req, res) => {
    const decision = await input.retellWebhooks.handleInbound(rawBody(req), req.headers["x-retell-signature"]);
    res.status(200).json(decision);
  }));

  router.post("/webhooks/retell/events", rawMiddleware, asyncHandler(async (req, res) => {
    await input.retellWebhooks.handleCallEvent(rawBody(req), req.headers["x-retell-signature"]);
    res.status(204).send();
  }));

  router.post("/tools/retell/request-transfer", rawMiddleware, asyncHandler(async (req, res) => {
    const body = rawBody(req);
    await input.retellVerifier.verify(body, req.headers["x-retell-signature"]);
    const request = retellTransferToolSchema.parse(JSON.parse(body));
    const billingGate = await retellToolBillingGate(input.billing, retellToolUserId(request));
    if (!billingGate.allowed) {
      res.status(200).json({ status: "unavailable", message: billingGate.message });
      return;
    }
    const args = request.args ?? {};
    const result = await input.transferApprovals.requestAndWait({
      userId: request.call?.retell_llm_dynamic_variables?.phone_agent_user_id,
      providerCallId: request.call?.call_id,
      callerNumber: request.call?.from_number,
      callerName: args.caller_name ?? request.call?.retell_llm_dynamic_variables?.caller_name,
      reason: args.reason ?? "Caller requested live attention.",
      urgency: args.urgency,
      transferToNumber: request.call?.retell_llm_dynamic_variables?.user_transfer_phone_number
    });
    res.status(200).json(result);
  }));

  router.post("/tools/retell/request-user-answer", rawMiddleware, asyncHandler(async (req, res) => {
    const body = rawBody(req);
    await input.retellVerifier.verify(body, req.headers["x-retell-signature"]);
    const request = retellAnswerToolSchema.parse(JSON.parse(body));
    const billingGate = await retellToolBillingGate(input.billing, retellToolUserId(request));
    if (!billingGate.allowed) {
      res.status(200).json({ status: "unavailable", message: billingGate.message });
      return;
    }
    const args = request.args ?? {};
    const result = await input.liveAnswers.requestAndWait({
      userId: request.call?.retell_llm_dynamic_variables?.phone_agent_user_id,
      providerCallId: request.call?.call_id,
      callerNumber: request.call?.from_number,
      callerName: args.caller_name ?? request.call?.retell_llm_dynamic_variables?.caller_name,
      question: args.question,
      reason: args.reason,
      urgency: args.urgency
    });
    res.status(200).json(result);
  }));

  router.post("/tools/retell/check-calendar-freebusy", rawMiddleware, asyncHandler(async (req, res) => {
    const body = rawBody(req);
    await input.retellVerifier.verify(body, req.headers["x-retell-signature"]);
    const request = retellFreeBusyToolSchema.parse(JSON.parse(body));
    const billingGate = await retellToolBillingGate(input.billing, retellToolUserId(request));
    if (!billingGate.allowed) {
      res.status(200).json({ connected: false, status: "unavailable", message: billingGate.message });
      return;
    }
    if (!input.calendar.isConfigured()) {
      res.status(200).json({ connected: false, status: "unavailable", message: "Google Calendar OAuth is not configured." });
      return;
    }
    const userId = retellToolUserId(request);
    if (!userId) {
      res.status(200).json({ connected: false, status: "unavailable", message: "The assistant account could not be verified." });
      return;
    }
    const status = await input.calendar.status(userId);
    if (!status.connected) {
      res.status(200).json({ connected: false, status: "unavailable", message: "The user's Google Calendar is not connected." });
      return;
    }
    const result = await input.calendar.checkFreeBusy({
      userId,
      timeMin: new Date(request.args.time_min),
      timeMax: new Date(request.args.time_max),
      timeZone: request.args.time_zone
    });
    res.status(200).json(result);
  }));

  router.post("/tools/retell/request-calendar-event", rawMiddleware, asyncHandler(async (req, res) => {
    const body = rawBody(req);
    await input.retellVerifier.verify(body, req.headers["x-retell-signature"]);
    const request = retellCalendarEventToolSchema.parse(JSON.parse(body));
    const billingGate = await retellToolBillingGate(input.billing, retellToolUserId(request));
    if (!billingGate.allowed) {
      res.status(200).json({ status: "unavailable", message: billingGate.message });
      return;
    }
    const args = request.args;
    const userId = retellToolUserId(request);
    if (!userId) {
      res.status(200).json({ status: "unavailable", message: "The assistant account could not be verified. Take a concise message instead." });
      return;
    }
    const result = await input.calendar.createCalendarEvent({
      userId,
      providerCallId: request.call?.call_id,
      callerNumber: request.call?.from_number,
      callerName: args.caller_name ?? request.call?.retell_llm_dynamic_variables?.caller_name,
      title: args.title,
      description: args.description,
      startTime: new Date(args.start_time),
      endTime: new Date(args.end_time),
      timeZone: args.time_zone,
      reason: args.reason
    });
    res.status(200).json(result);
  }));

  router.post("/tools/retell/update-calendar-event", rawMiddleware, asyncHandler(async (req, res) => {
    const body = rawBody(req);
    await input.retellVerifier.verify(body, req.headers["x-retell-signature"]);
    const request = retellCalendarEventUpdateToolSchema.parse(JSON.parse(body));
    const billingGate = await retellToolBillingGate(input.billing, retellToolUserId(request));
    if (!billingGate.allowed) {
      res.status(200).json({ status: "unavailable", message: billingGate.message });
      return;
    }
    const args = request.args;
    const userId = retellToolUserId(request);
    if (!userId) {
      res.status(200).json({ status: "unavailable", message: "The assistant account could not be verified. Take a concise message instead." });
      return;
    }
    const result = await input.calendar.updateCalendarEvent({
      userId,
      providerCallId: request.call?.call_id,
      callerNumber: request.call?.from_number,
      callerName: args.caller_name ?? request.call?.retell_llm_dynamic_variables?.caller_name,
      calendarEventRequestId: args.calendar_event_request_id,
      calendarEventId: args.calendar_event_id,
      title: args.title,
      description: args.description,
      startTime: args.start_time ? new Date(args.start_time) : undefined,
      endTime: args.end_time ? new Date(args.end_time) : undefined,
      timeZone: args.time_zone,
      reason: args.reason
    });
    res.status(200).json(result);
  }));

  return router;
}

const retellTransferToolSchema = z.object({
  name: z.string().optional(),
  call: z
    .object({
      call_id: z.string().optional(),
      from_number: z.string().optional(),
      retell_llm_dynamic_variables: z.record(z.string()).optional()
    })
    .optional(),
  args: z
    .object({
      caller_name: z.string().optional(),
      reason: z.string().optional(),
      urgency: z.enum(["unknown", "low", "normal", "high", "emergency"]).optional()
    })
    .optional()
});

const retellAnswerToolSchema = z.object({
  name: z.string().optional(),
  call: z
    .object({
      call_id: z.string().optional(),
      from_number: z.string().optional(),
      retell_llm_dynamic_variables: z.record(z.string()).optional()
    })
    .optional(),
  args: z.object({
    caller_name: z.string().optional(),
    question: z.string().min(1).max(500),
    reason: z.string().max(500).optional(),
    urgency: z.enum(["unknown", "low", "normal", "high", "emergency"]).optional()
  })
});

const retellFreeBusyToolSchema = z.object({
  name: z.string().optional(),
  call: z
    .object({
      retell_llm_dynamic_variables: z.record(z.string()).optional()
    })
    .optional(),
  args: z.object({
    time_min: z.string().datetime({ offset: true }),
    time_max: z.string().datetime({ offset: true }),
    time_zone: z.string().min(1).max(100).optional()
  })
});

const retellCalendarEventToolSchema = z.object({
  name: z.string().optional(),
  call: z
    .object({
      call_id: z.string().optional(),
      from_number: z.string().optional(),
      retell_llm_dynamic_variables: z.record(z.string()).optional()
    })
    .optional(),
  args: z.object({
    caller_name: z.string().optional(),
    title: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
    start_time: z.string().datetime({ offset: true }),
    end_time: z.string().datetime({ offset: true }),
    time_zone: z.string().min(1).max(100).optional(),
    reason: z.string().max(500).optional()
  })
});

const retellCalendarEventUpdateToolSchema = z.object({
  name: z.string().optional(),
  call: z
    .object({
      call_id: z.string().optional(),
      from_number: z.string().optional(),
      retell_llm_dynamic_variables: z.record(z.string()).optional()
    })
    .optional(),
  args: z.object({
    caller_name: z.string().optional(),
    calendar_event_request_id: z.string().min(1).max(200).optional(),
    calendar_event_id: z.string().min(1).max(500).optional(),
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).optional(),
    start_time: z.string().datetime({ offset: true }).optional(),
    end_time: z.string().datetime({ offset: true }).optional(),
    time_zone: z.string().min(1).max(100).optional(),
    reason: z.string().max(500).optional()
  })
});

function retellToolUserId(request: {
  call?: {
    retell_llm_dynamic_variables?: Record<string, string>;
  };
}): string | undefined {
  return request.call?.retell_llm_dynamic_variables?.phone_agent_user_id;
}

async function retellToolBillingGate(
  billing: BillingGate,
  userId: string | undefined
): Promise<{ allowed: true } | { allowed: false; message: string }> {
  if (!userId) {
    return {
      allowed: false,
      message: "The assistant account could not be verified. Take a concise message instead."
    };
  }

  try {
    await billing.assertPaidRuntimeAllowed(userId);
    return { allowed: true };
  } catch (error) {
    if (error instanceof HttpError && (error.code === "billing_payment_required" || error.code === "billing_cap_reached")) {
      return {
        allowed: false,
        message: "The assistant is unavailable because billing needs attention. Take a concise message instead."
      };
    }
    throw error;
  }
}
