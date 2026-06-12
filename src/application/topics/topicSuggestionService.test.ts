import { describe, expect, it } from "vitest";
import type { CommunicationClassifier } from "../../domain/topics/communicationClassifier.js";
import { InMemoryCommunicationItemRepository } from "../../infrastructure/persistence/inMemoryCommunicationItemRepository.js";
import { InMemoryTopicSuggestionRepository } from "../../infrastructure/persistence/inMemoryTopicSuggestionRepository.js";
import { InMemoryTopicThreadRepository } from "../../infrastructure/persistence/inMemoryTopicThreadRepository.js";
import { TopicSuggestionService } from "./topicSuggestionService.js";

describe("TopicSuggestionService", () => {
  it("uses a classifier result to create a reviewable topic suggestion and store extracted state", async () => {
    const communicationItems = new InMemoryCommunicationItemRepository();
    const topics = new InMemoryTopicThreadRepository();
    const suggestions = new InMemoryTopicSuggestionRepository();

    const topic = await topics.create({
      userId: "default-user",
      title: "Basement Project",
      description: "Contractor, permit, plumbing, and renovation decisions."
    });
    const item = await communicationItems.create({
      userId: "default-user",
      channel: "phone_call",
      direction: "inbound",
      sourceProvider: "retell",
      providerItemId: "call_classifier_123",
      sender: {
        displayName: "Chris Contractor",
        phoneNumber: "+15551234567"
      },
      summary: "Contractor asked whether the plumbing change order includes permit fees."
    });

    const classifier: CommunicationClassifier = {
      async classify() {
        return {
          topicAction: "existing_topic",
          existingTopicThreadId: topic.id,
          confidence: 0.91,
          reason: "The call is about plumbing and permits in the Basement Project.",
          evidence: ["Mentions plumbing change order and permit fees."],
          extractedFacts: [{ text: "The plumbing change order may include permit fees.", confidence: 0.8 }],
          extractedTasks: [{ title: "Confirm whether permit fees are included.", confidence: 0.82 }],
          extractedDecisions: [],
          extractedOpenQuestions: [{ question: "Does the plumbing change order include permit fees?", confidence: 0.9 }]
        };
      }
    };

    const service = new TopicSuggestionService({
      communicationItems,
      topics,
      suggestions,
      classifier
    });

    const created = await service.analyzeCommunication(item);
    expect(created).toHaveLength(1);
    expect(created[0]?.suggestedTopicThreadId).toBe(topic.id);
    expect(created[0]?.confidence).toBe(0.91);

    const updatedItem = await communicationItems.get(item.id);
    expect(updatedItem?.extractedFacts[0]?.text).toContain("permit fees");
    expect(updatedItem?.extractedTasks[0]?.title).toContain("Confirm");
    expect(updatedItem?.extractedOpenQuestions[0]?.question).toContain("permit fees");

    const pending = await service.listPending("default-user");
    expect(pending[0]?.suggestedTopicTitle).toBe("Basement Project");
    expect(pending[0]?.sourceCommunication?.channelLabel).toBe("Call");
    expect(pending[0]?.sourceCommunication?.displayName).toBe("Chris Contractor");
    expect(pending[0]?.sourceCommunication?.phoneNumber).toBe("+15551234567");
    expect(pending[0]?.sourceCommunication?.summary).toContain("plumbing change order");
  });
});
