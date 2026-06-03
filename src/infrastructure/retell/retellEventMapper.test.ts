import { describe, expect, it } from "vitest";
import { parseRetellCallEventWebhook } from "./retellEventMapper.js";

describe("parseRetellCallEventWebhook", () => {
  it("normalizes call_analyzed into a completed call session update", () => {
    const normalized = parseRetellCallEventWebhook(JSON.stringify({
      event: "call_analyzed",
      call: {
        call_id: "call_123",
        direction: "inbound",
        from_number: "+15551230000",
        to_number: "+15557650000",
        agent_id: "agent_123",
        call_status: "ended",
        start_timestamp: 1714608475945,
        end_timestamp: 1714608491736,
        transcript: "Caller asked for a callback.",
        transcript_object: [
          { role: "agent", content: "Who is calling and why?", start_ms: 0, end_ms: 1200 },
          { role: "user", content: "This is Sam. Please call me back.", start_ms: 1300, end_ms: 3500 }
        ],
        call_analysis: {
          call_summary: "Sam requested a callback.",
          call_successful: true,
          user_sentiment: "Neutral"
        }
      }
    }));

    expect(normalized.eventType).toBe("call_analyzed");
    expect(normalized.providerCallId).toBe("call_123");
    expect(normalized.upsert.status).toBe("completed");
    expect(normalized.upsert.fromNumber).toBe("+15551230000");
    expect(normalized.upsert.summary?.text).toBe("Sam requested a callback.");
    expect(normalized.upsert.transcriptSegments).toHaveLength(2);
  });

  it("maps transfer events to live transfer statuses", () => {
    const transferStarted = parseRetellCallEventWebhook(JSON.stringify({
      event: "transfer_started",
      call: {
        call_id: "call_123",
        direction: "inbound",
        from_number: "+15551230000",
        to_number: "+15557650000"
      },
      transfer_destination: { number: "+15559870000" }
    }));

    const transferBridged = parseRetellCallEventWebhook(JSON.stringify({
      event: "transfer_bridged",
      call: {
        call_id: "call_123",
        direction: "inbound",
        from_number: "+15551230000",
        to_number: "+15557650000"
      }
    }));

    expect(transferStarted.upsert.status).toBe("transfer_requested");
    expect(transferBridged.upsert.status).toBe("bridged");
  });
});

