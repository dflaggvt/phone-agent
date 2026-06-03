import { describe, expect, it } from "vitest";
import { InMemoryCallRepository } from "../../infrastructure/persistence/inMemoryCallRepository.js";
import type { RetellCallClient } from "../../infrastructure/retell/retellClient.js";
import { createLogger } from "../../shared/logger.js";
import { OutboundCallService } from "./outboundCallService.js";

describe("OutboundCallService", () => {
  it("creates an approved Retell outbound phone call and stores a call session", async () => {
    const calls = new InMemoryCallRepository();
    const fakeRetell: RetellCallClient = {
      async createOutboundPhoneCall(input) {
        expect(input.fromNumber).toBe("+15551230000");
        expect(input.toNumber).toBe("+15557650000");
        expect(input.dynamicVariables?.outbound_reason).toBe("Return a missed urgent call.");

        return {
          call_type: "phone_call",
          call_id: "call_outbound_123",
          direction: "outbound",
          from_number: input.fromNumber,
          to_number: input.toNumber,
          agent_id: "agent_default",
          agent_version: 1,
          call_status: "registered",
          metadata: input.metadata ?? {}
        } as never;
      }
    };

    const service = new OutboundCallService({
      retell: fakeRetell,
      calls,
      logger: createLogger("silent"),
      defaultAgentId: "agent_default",
      defaultFromNumber: "+15551230000"
    });

    const created = await service.createApprovedCall({
      approved: true,
      toNumber: "+15557650000",
      reason: "Return a missed urgent call."
    });

    expect(created.providerCallId).toBe("call_outbound_123");
    expect(created.status).toBe("registered");

    const sessions = await calls.listCalls();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.direction).toBe("outbound");
  });
});
