import { describe, expect, it } from "vitest";
import { createTopicThreadSkeleton } from "../domain/topics/topicThread.js";
import { InMemoryCommunicationItemRepository } from "../infrastructure/persistence/inMemoryCommunicationItemRepository.js";
import { presentTopicThreads } from "./topicPresenters.js";

describe("topic presenters", () => {
  it("hydrates compact topic timelines from attached user-owned communications", async () => {
    const communicationItems = new InMemoryCommunicationItemRepository();
    const older = await communicationItems.create({
      userId: "user_123",
      channel: "phone_call",
      direction: "inbound",
      sourceProvider: "retell",
      providerItemId: "call_old",
      sender: { displayName: "John", phoneNumber: "+12035550100" },
      occurredAt: new Date("2026-06-05T15:00:00.000Z"),
      summary: "John confirmed the cleaner visit."
    });
    const newer = await communicationItems.create({
      userId: "user_123",
      channel: "email",
      direction: "inbound",
      sourceProvider: "gmail",
      providerItemId: "email_new",
      sender: { displayName: "Summit Health" },
      occurredAt: new Date("2026-06-06T15:00:00.000Z"),
      bodyText: "Appointment schedule details."
    });
    const otherUserItem = await communicationItems.create({
      userId: "user_other",
      channel: "phone_call",
      direction: "inbound",
      sourceProvider: "retell",
      providerItemId: "call_private",
      sender: { displayName: "Private Caller" },
      occurredAt: new Date("2026-06-07T15:00:00.000Z"),
      summary: "This must not leak into another user topic."
    });
    const topic = {
      ...createTopicThreadSkeleton({
        id: "topic_123",
        userId: "user_123",
        title: "Appointments",
        description: "Scheduling and cleaner coordination"
      }),
      communicationItemIds: [older.id, otherUserItem.id, newer.id]
    };

    const [presented] = await presentTopicThreads({
      topics: [topic],
      communicationItems,
      userId: "user_123"
    });

    expect(presented?.communicationCount).toBe(3);
    expect(presented?.timeline).toHaveLength(2);
    expect(presented?.timeline.map((item) => item.communicationItemId)).toEqual([newer.id, older.id]);
    expect(presented?.timeline[0]).toMatchObject({
      channelLabel: "Email",
      title: "Email from Summit Health",
      summary: "Appointment schedule details."
    });
    expect(presented?.timeline[1]).toMatchObject({
      channelLabel: "Call",
      title: "Call from John",
      summary: "John confirmed the cleaner visit."
    });
  });

  it("compacts long timeline summaries", async () => {
    const communicationItems = new InMemoryCommunicationItemRepository();
    const longSummary = `${"Follow up details. ".repeat(20)}Final sentence should be truncated.`;
    const item = await communicationItems.create({
      userId: "user_123",
      channel: "manual_note",
      direction: "internal",
      sourceProvider: "phone_agent",
      sender: { displayName: "Assistant" },
      occurredAt: new Date("2026-06-05T15:00:00.000Z"),
      summary: longSummary
    });
    const topic = {
      ...createTopicThreadSkeleton({
        id: "topic_123",
        userId: "user_123",
        title: "Cleaner Visit"
      }),
      communicationItemIds: [item.id]
    };

    const [presented] = await presentTopicThreads({
      topics: [topic],
      communicationItems,
      userId: "user_123"
    });

    expect(presented).toBeDefined();
    const [timelineItem] = presented!.timeline;
    expect(timelineItem).toBeDefined();
    expect(timelineItem!.summary.length).toBeLessThanOrEqual(240);
    expect(timelineItem!.summary.endsWith("...")).toBe(true);
  });
});
