import { describe, expect, it } from "vitest";
import { RetellVoiceProvider } from "./retellVoiceProvider.js";
import type { WebhookVerifier } from "./retellWebhookVerifier.js";

const verifier: WebhookVerifier = {
  async verify() {
    return undefined;
  }
};

describe("RetellVoiceProvider", () => {
  it("normalizes Retell inbound calls into provider-neutral context requests", () => {
    const provider = new RetellVoiceProvider(verifier);

    const inbound = provider.parseInboundContextRequest(JSON.stringify({
      event: "call_inbound",
      call_inbound: {
        agent_id: "agent_123",
        from_number: "+15551230000",
        to_number: "+19143593659"
      }
    }));

    expect(inbound.provider).toBe("retell");
    expect(inbound.fromNumber).toBe("+15551230000");
    expect(inbound.toNumber).toBe("+19143593659");
    expect(inbound.agentId).toBe("agent_123");
  });

  it("normalizes Retell lifecycle events into provider-neutral voice call events", () => {
    const provider = new RetellVoiceProvider(verifier);

    const event = provider.normalizeCallEvent(JSON.stringify({
      event: "call_analyzed",
      call: {
        call_id: "call_123",
        direction: "inbound",
        from_number: "+15551230000",
        to_number: "+19143593659",
        agent_id: "agent_123",
        call_status: "ended",
        transcript: "Caller asked about the basement estimate.",
        call_analysis: {
          call_summary: "Caller asked whether the estimate includes permits.",
          call_successful: true
        }
      }
    }));

    expect(event.provider).toBe("retell");
    expect(event.providerCallId).toBe("call_123");
    expect(event.eventType).toBe("call_analyzed");
    expect(event.direction).toBe("inbound");
    expect(event.summary?.text).toContain("estimate");
    expect(event.transcript).toContain("basement");
  });
});
