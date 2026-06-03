import { describe, expect, it } from "vitest";
import { createTopicThreadSkeleton } from "./topicThread.js";

describe("topic thread domain skeleton", () => {
  it("creates an active topic thread with participant permissions", () => {
    const now = new Date("2026-05-27T12:00:00.000Z");

    const topic = createTopicThreadSkeleton({
      id: "topic_basement",
      userId: "user_123",
      title: "  Basement Project  ",
      description: "  Renovation coordination  ",
      participantIds: ["participant_contractor"],
      now
    });

    expect(topic.title).toBe("Basement Project");
    expect(topic.description).toBe("Renovation coordination");
    expect(topic.status).toBe("active");
    expect(topic.participants).toEqual([
      {
        participantId: "participant_contractor",
        role: "participant",
        addedAt: now,
        permissions: ["read_thread_summary", "comment"]
      }
    ]);
    expect(topic.communicationItemIds).toEqual([]);
    expect(topic.decisions).toEqual([]);
    expect(topic.openQuestions).toEqual([]);
    expect(topic.tasks).toEqual([]);
  });
});

