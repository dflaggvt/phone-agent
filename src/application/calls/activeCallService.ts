import type { ApprovalRequestRepository } from "../../domain/approvals/approvalRequest.js";
import type { AnswerRequestRepository } from "../../domain/answerRequests/answerRequest.js";
import type { CallerMemoryRepository } from "../../domain/callers/callerMemory.js";
import type { CallRepository } from "../../domain/calls/callRepository.js";
import type { CallSession } from "../../domain/calls/callSession.js";

export interface ActiveCallView {
  callSessionId: string;
  provider: CallSession["provider"];
  providerCallId?: string;
  direction: CallSession["direction"];
  status: CallSession["status"];
  substate: "agent_on_call" | "awaiting_user_approval" | "awaiting_user_answer" | "bridging_to_user" | "bridged";
  callerNumber: string;
  callerName?: string;
  relationship: string;
  trustLevel: string;
  intent?: string;
  urgency: CallSession["urgency"];
  startedAt?: Date;
  updatedAt: Date;
  elapsedSeconds?: number;
  stale: boolean;
  pendingApprovalRequestId?: string;
  pendingAnswerRequestId?: string;
}

export class ActiveCallService {
  constructor(
    private readonly dependencies: {
      calls: CallRepository;
      callerMemory: CallerMemoryRepository;
      approvals: ApprovalRequestRepository;
      answerRequests: AnswerRequestRepository;
      staleAfterMs?: number;
      maxActiveAgeMs?: number;
    }
  ) {}

  async getActiveCall(input: { userId?: string; userAssistantPhoneNumber?: string } = {}, now = new Date()): Promise<ActiveCallView | undefined> {
    const sessions = await this.dependencies.calls.listCalls();
    const userAssistantPhoneNumber = normalizePhoneNumber(input.userAssistantPhoneNumber);
    if (!userAssistantPhoneNumber) {
      return undefined;
    }
    const maxActiveAgeMs = this.dependencies.maxActiveAgeMs ?? 2 * 60 * 60 * 1000;
    const active = sessions.find((session) => {
      if (userAssistantPhoneNumber && !sessionMatchesRoute(session, userAssistantPhoneNumber)) {
        return false;
      }
      if (session.status === "completed" || session.status === "failed") {
        return false;
      }
      return now.getTime() - session.updatedAt.getTime() <= maxActiveAgeMs;
    });

    if (!active) {
      return undefined;
    }

    const callerNumber = active.direction === "outbound" ? active.toNumber : active.fromNumber;
    const [profile, pendingApprovals, pendingAnswers] = await Promise.all([
      input.userId ? this.dependencies.callerMemory.findByPhoneNumber(input.userId, callerNumber) : Promise.resolve(undefined),
      this.dependencies.approvals.listPending(now),
      this.dependencies.answerRequests.listPending(now)
    ]);

    const pendingApproval = pendingApprovals.find((approval) => approval.providerCallId === active.providerCallId);
    const pendingAnswer = pendingAnswers.find((answer) => answer.providerCallId === active.providerCallId);
    const startedAt = active.startedAt ?? active.createdAt;
    const staleAfterMs = this.dependencies.staleAfterMs ?? 2 * 60 * 1000;

    return {
      callSessionId: active.id,
      provider: active.provider,
      providerCallId: active.providerCallId,
      direction: active.direction,
      status: active.status,
      substate: substateFor(active, Boolean(pendingApproval), Boolean(pendingAnswer)),
      callerNumber,
      callerName: callerNameFor(active, profile?.displayName),
      relationship: profile?.relationship ?? "unknown",
      trustLevel: profile?.trustLevel ?? "unknown",
      intent: active.intent ?? getCustomString(active, "caller_intent"),
      urgency: active.urgency === "unknown" ? urgencyFor(active) : active.urgency,
      startedAt,
      updatedAt: active.updatedAt,
      elapsedSeconds: Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 1000)),
      stale: now.getTime() - active.updatedAt.getTime() > staleAfterMs,
      pendingApprovalRequestId: pendingApproval?.id,
      pendingAnswerRequestId: pendingAnswer?.id
    };
  }
}

function substateFor(
  session: CallSession,
  hasPendingApproval: boolean,
  hasPendingAnswer: boolean
): ActiveCallView["substate"] {
  if (hasPendingAnswer) {
    return "awaiting_user_answer";
  }
  if (hasPendingApproval) {
    return "awaiting_user_approval";
  }
  if (session.status === "bridged") {
    return "bridged";
  }
  if (session.status === "transfer_requested") {
    return "bridging_to_user";
  }
  return "agent_on_call";
}

function callerNameFor(session: CallSession, profileName?: string): string | undefined {
  return profileName ?? getDynamicVariable(session, "caller_name") ?? getCustomString(session, "caller_name");
}

function urgencyFor(session: CallSession): CallSession["urgency"] {
  const value = getCustomString(session, "urgency");
  return value === "low" || value === "normal" || value === "high" || value === "emergency" ? value : "unknown";
}

function getCustomString(session: CallSession, key: string): string | undefined {
  const structured = session.summary?.structuredData;
  const custom = getRecord(structured?.custom_analysis_data);
  return getString(custom?.[key]);
}

function getDynamicVariable(session: CallSession, key: string): string | undefined {
  const variables = getRecord(session.metadata.retell_dynamic_variables);
  return getString(variables?.[key]);
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? value as Record<string, unknown> : undefined;
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function sessionMatchesRoute(session: CallSession, normalizedAssistantPhoneNumber: string): boolean {
  return normalizePhoneNumber(session.toNumber) === normalizedAssistantPhoneNumber
    || normalizePhoneNumber(session.fromNumber) === normalizedAssistantPhoneNumber;
}

function normalizePhoneNumber(value?: string): string | undefined {
  const digits = value?.replace(/\D/g, "");
  return digits && digits.length > 0 ? digits : undefined;
}
