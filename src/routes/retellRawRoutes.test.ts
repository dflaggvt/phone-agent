import express, { type ErrorRequestHandler, type RequestHandler } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { HttpError } from "../shared/httpErrors.js";
import { retellRawRoutes } from "./retellRawRoutes.js";

describe("retellRawRoutes", () => {
  it("passes the exact raw inbound webhook body and Retell signature to the webhook service", async () => {
    const harness = createHarness();
    const payload = JSON.stringify({
      event: "call_inbound",
      call_inbound: {
        from_number: "+17035550100",
        to_number: "+19145550100"
      }
    });

    const response = await request(harness.app)
      .post("/webhooks/retell/inbound")
      .type("application/json")
      .set("x-retell-signature", "sig_inbound")
      .send(payload)
      .expect(200);

    expect(response.body).toEqual({ call_inbound: { dynamic_variables: { route: "ok" } } });
    expect(harness.retellWebhooks.inboundCalls).toEqual([
      { rawBody: payload, signature: "sig_inbound" }
    ]);
  });

  it("passes the exact raw event webhook body and Retell signature to the webhook service", async () => {
    const harness = createHarness();
    const payload = JSON.stringify({
      event: "call_analyzed",
      call: {
        call_id: "call_123"
      }
    });

    await request(harness.app)
      .post("/webhooks/retell/events")
      .type("application/json")
      .set("x-retell-signature", "sig_event")
      .send(payload)
      .expect(204);

    expect(harness.retellWebhooks.eventCalls).toEqual([
      { rawBody: payload, signature: "sig_event" }
    ]);
  });

  it("verifies Retell tool requests before creating a transfer approval", async () => {
    const harness = createHarness();
    const payload = JSON.stringify({
      call: {
        call_id: "call_approval",
        from_number: "+17035550101",
        retell_llm_dynamic_variables: {
          phone_agent_user_id: "user_123",
          caller_name: "Taylor",
          user_transfer_phone_number: "+17035550199"
        }
      },
      args: {
        reason: "Caller needs live attention.",
        urgency: "high"
      }
    });

    const response = await request(harness.app)
      .post("/tools/retell/request-transfer")
      .type("application/json")
      .set("x-retell-signature", "sig_tool")
      .send(payload)
      .expect(200);

    expect(response.body).toEqual({ status: "accepted", transfer_number: "+17035550199", message: "ok" });
    expect(harness.verifier.calls).toEqual([
      { rawBody: payload, signature: "sig_tool" }
    ]);
    expect(harness.transferApprovals.requests).toEqual([
      {
        userId: "user_123",
        providerCallId: "call_approval",
        callerNumber: "+17035550101",
        callerName: "Taylor",
        reason: "Caller needs live attention.",
        urgency: "high",
        transferToNumber: "+17035550199"
      }
    ]);
  });

  it("blocks Retell tool side effects when signature verification fails", async () => {
    const harness = createHarness({ rejectSignatures: true });
    const payload = JSON.stringify({
      call: {
        call_id: "call_blocked",
        from_number: "+17035550101",
        retell_llm_dynamic_variables: {
          phone_agent_user_id: "user_123"
        }
      },
      args: {
        question: "What state do you live in?"
      }
    });

    const response = await request(harness.app)
      .post("/tools/retell/request-user-answer")
      .type("application/json")
      .set("x-retell-signature", "bad_sig")
      .send(payload)
      .expect(401);

    expect(response.body.error.code).toBe("retell_signature_invalid");
    expect(harness.verifier.calls).toEqual([
      { rawBody: payload, signature: "bad_sig" }
    ]);
    expect(harness.liveAnswers.requests).toEqual([]);
  });
});

function createHarness(options: { rejectSignatures?: boolean } = {}) {
  const app = express();
  const providerRateLimiter: RequestHandler = (_req, _res, next) => next();
  const rawJson = express.raw({ type: "application/json", limit: "2mb" });
  const verifier = {
    calls: [] as Array<{ rawBody: string; signature: string | string[] | undefined }>,
    async verify(rawBody: string, signature: string | string[] | undefined) {
      this.calls.push({ rawBody, signature });
      if (options.rejectSignatures) {
        throw new HttpError(401, "retell_signature_invalid", "Retell signature could not be verified.");
      }
    }
  };
  const retellWebhooks = {
    inboundCalls: [] as Array<{ rawBody: string; signature: string | string[] | undefined }>,
    eventCalls: [] as Array<{ rawBody: string; signature: string | string[] | undefined }>,
    async handleInbound(rawBody: string, signature: string | string[] | undefined) {
      this.inboundCalls.push({ rawBody, signature });
      return { call_inbound: { dynamic_variables: { route: "ok" } } };
    },
    async handleCallEvent(rawBody: string, signature: string | string[] | undefined) {
      this.eventCalls.push({ rawBody, signature });
    }
  };
  const billing = {
    allowedUserIds: [] as string[],
    async assertPaidRuntimeAllowed(userId: string) {
      this.allowedUserIds.push(userId);
    }
  };
  const transferApprovals = {
    requests: [] as unknown[],
    async requestAndWait(input: unknown) {
      this.requests.push(input);
      return { status: "accepted", transfer_number: "+17035550199", message: "ok" };
    }
  };
  const liveAnswers = {
    requests: [] as unknown[],
    async requestAndWait(input: unknown) {
      this.requests.push(input);
      return { status: "answered", answer: "Virginia", message: "ok" };
    }
  };
  const calendar = {
    isConfigured() {
      return true;
    },
    async status() {
      return { connected: true };
    },
    async checkFreeBusy() {
      return { connected: true, isAvailable: true };
    },
    async createCalendarEvent() {
      return { status: "created" };
    },
    async updateCalendarEvent() {
      return { status: "updated" };
    }
  };

  app.use(retellRawRoutes({
    providerRateLimiter,
    rawJson,
    retellWebhooks,
    retellVerifier: verifier,
    billing,
    transferApprovals,
    liveAnswers,
    calendar
  }));
  app.use(errorHandler);

  return {
    app,
    verifier,
    retellWebhooks,
    billing,
    transferApprovals,
    liveAnswers
  };
}

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
    return;
  }

  res.status(500).json({ error: { code: "internal_error", message: "Internal server error." } });
};
