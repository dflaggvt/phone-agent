import { describe, expect, it } from "vitest";
import type { CommunicationClassifier } from "../../domain/topics/communicationClassifier.js";
import type { TopicSuggestion, TopicSuggestionRepository } from "../../domain/topics/topicSuggestion.js";
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

  it("updates the pending suggestion for a communication when classifier wording changes", async () => {
    const communicationItems = new InMemoryCommunicationItemRepository();
    const topics = new InMemoryTopicThreadRepository();
    const suggestions = new InMemoryTopicSuggestionRepository();
    const item = await communicationItems.create({
      userId: "default-user",
      channel: "phone_call",
      direction: "inbound",
      sourceProvider: "retell",
      providerItemId: "call_summit_health",
      sender: {
        displayName: "Summit Health",
        phoneNumber: "+19145550100"
      },
      summary: "Primary care called about Daryl's June 6 appointment."
    });

    let title = "Daryl's Summit Health Appointment on June 6, 2026";
    const classifier: CommunicationClassifier = {
      async classify() {
        return {
          topicAction: "new_topic",
          proposedTopicTitle: title,
          proposedTopicDescription: "Primary care appointment logistics.",
          confidence: title.startsWith("Summit") ? 0.95 : 0.88,
          reason: "The call is about the same Summit Health appointment.",
          evidence: ["Mentions Summit Health and June 6 appointment."],
          extractedFacts: [],
          extractedTasks: [],
          extractedDecisions: [],
          extractedOpenQuestions: []
        };
      }
    };
    const service = new TopicSuggestionService({ communicationItems, topics, suggestions, classifier });

    const first = await service.analyzeCommunication(item);
    title = "Summit Health Primary Care Appointment for Daryl Flagg";
    const second = await service.analyzeCommunication(item);
    const pending = await service.listPending("default-user");

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
    expect(second[0]?.id).toBe(first[0]?.id);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.suggestedTopicTitle).toBe("Summit Health Primary Care Appointment");
    expect(pending[0]?.confidence).toBe(0.95);
  });

  it("normalizes generated headline-style new topic titles before display and creation", async () => {
    const communicationItems = new InMemoryCommunicationItemRepository();
    const topics = new InMemoryTopicThreadRepository();
    const suggestions = new InMemoryTopicSuggestionRepository();
    const item = await communicationItems.create({
      userId: "default-user",
      channel: "phone_call",
      direction: "inbound",
      sourceProvider: "retell",
      providerItemId: "call_verbose_topic_title",
      sender: { displayName: "John" },
      summary: "John called about doctor appointment schedule coordination."
    });
    const classifier: CommunicationClassifier = {
      async classify() {
        return {
          topicAction: "new_topic",
          proposedTopicTitle: "Scheduling and Coordination for Daryl Flagg's Doctor Appointments",
          proposedTopicDescription: "Appointment scheduling and logistics.",
          confidence: 0.91,
          reason: "The call is about doctor appointment scheduling.",
          evidence: ["Mentions doctor appointment schedule."],
          extractedFacts: [],
          extractedTasks: [],
          extractedDecisions: [],
          extractedOpenQuestions: []
        };
      }
    };
    const service = new TopicSuggestionService({ communicationItems, topics, suggestions, classifier });

    const [created] = await service.analyzeCommunication(item);
    const pending = await service.listPending("default-user");
    const accepted = await service.acceptSuggestion(created!.id, "default-user");

    expect(created?.suggestedTitle).toBe("Doctor Appointments");
    expect(pending[0]?.suggestedTopicTitle).toBe("Doctor Appointments");
    expect(accepted?.topic.title).toBe("Doctor Appointments");
  });

  it("normalizes stored pending suggestion titles from earlier classifier versions", async () => {
    const communicationItems = new InMemoryCommunicationItemRepository();
    const topics = new InMemoryTopicThreadRepository();
    const suggestions = new InMemoryTopicSuggestionRepository();
    const item = await communicationItems.create({
      userId: "default-user",
      channel: "phone_call",
      direction: "inbound",
      sourceProvider: "retell",
      providerItemId: "call_legacy_verbose_topic_title",
      summary: "A cleaner visit was coordinated."
    });
    await suggestions.upsertPending({
      userId: "default-user",
      communicationItemId: item.id,
      targetType: "new_topic",
      suggestedTitle: "Cleaner Visit Coordination for Daryl Flagg",
      suggestedDescription: "Cleaner visit logistics.",
      confidence: 0.86,
      reason: "The call is about the cleaner visit.",
      evidence: []
    });
    const service = new TopicSuggestionService({ communicationItems, topics, suggestions });

    const pending = await service.listPending("default-user");
    const accepted = await service.acceptSuggestion(pending[0]!.id, "default-user");

    expect(pending[0]?.suggestedTopicTitle).toBe("Cleaner Visit");
    expect(accepted?.topic.title).toBe("Cleaner Visit");
  });

  it("does not reopen a topic suggestion after the user dismisses it", async () => {
    const communicationItems = new InMemoryCommunicationItemRepository();
    const topics = new InMemoryTopicThreadRepository();
    const suggestions = new InMemoryTopicSuggestionRepository();
    const item = await communicationItems.create({
      userId: "default-user",
      channel: "phone_call",
      direction: "inbound",
      sourceProvider: "retell",
      providerItemId: "call_dismissed_topic",
      summary: "A caller asked about appointment logistics."
    });
    const classifier: CommunicationClassifier = {
      async classify() {
        return {
          topicAction: "new_topic",
          proposedTopicTitle: "Appointment Logistics",
          confidence: 0.9,
          reason: "The call is about appointment logistics.",
          evidence: ["Mentions appointment logistics."],
          extractedFacts: [],
          extractedTasks: [],
          extractedDecisions: [],
          extractedOpenQuestions: []
        };
      }
    };
    const service = new TopicSuggestionService({ communicationItems, topics, suggestions, classifier });

    const [created] = await service.analyzeCommunication(item);
    await service.dismissSuggestion(created!.id, "default-user");
    const reopened = await service.analyzeCommunication(item);
    const pending = await service.listPending("default-user");

    expect(reopened).toHaveLength(0);
    expect(pending).toHaveLength(0);
  });

  it("collapses stored duplicate pending suggestions and resolves siblings on dismiss", async () => {
    const communicationItems = new InMemoryCommunicationItemRepository();
    const topics = new InMemoryTopicThreadRepository();
    const item = await communicationItems.create({
      userId: "default-user",
      channel: "phone_call",
      direction: "inbound",
      sourceProvider: "retell",
      providerItemId: "call_duplicate_suggestions",
      sender: { displayName: "Summit Health" },
      summary: "Summit Health called about a June 6 appointment."
    });
    const now = new Date("2026-06-04T13:10:00.000Z");
    const store = new Map<string, TopicSuggestion>([
      ["lower-confidence", {
        id: "lower-confidence",
        userId: "default-user",
        communicationItemId: item.id,
        targetType: "new_topic",
        suggestedTitle: "Daryl's Summit Health Appointment on June 6, 2026",
        confidence: 0.84,
        reason: "This is about a Summit Health appointment.",
        evidence: [],
        status: "pending",
        createdAt: new Date(now.getTime() - 1000),
        updatedAt: new Date(now.getTime() - 1000)
      }],
      ["higher-confidence", {
        id: "higher-confidence",
        userId: "default-user",
        communicationItemId: item.id,
        targetType: "new_topic",
        suggestedTitle: "Summit Health Primary Care Appointment for Daryl",
        confidence: 0.96,
        reason: "This is about the same Summit Health appointment.",
        evidence: [],
        status: "pending",
        createdAt: now,
        updatedAt: now
      }]
    ]);
    const suggestions: TopicSuggestionRepository = {
      async upsertPending() {
        throw new Error("not used");
      },
      async get(id) {
        return store.get(id);
      },
      async listForCommunication(userId, communicationItemId) {
        return [...store.values()].filter((suggestion) =>
          suggestion.userId === userId && suggestion.communicationItemId === communicationItemId
        );
      },
      async listPendingForUser(userId) {
        return [...store.values()].filter((suggestion) =>
          suggestion.userId === userId && suggestion.status === "pending"
        );
      },
      async accept(id) {
        return updateStoredSuggestion(store, id, "accepted");
      },
      async dismiss(id) {
        return updateStoredSuggestion(store, id, "dismissed");
      },
      async dismissPendingForCommunication(input) {
        const dismissed: TopicSuggestion[] = [];
        for (const suggestion of store.values()) {
          if (
            suggestion.status === "pending"
            && suggestion.userId === input.userId
            && suggestion.communicationItemId === input.communicationItemId
            && suggestion.id !== input.exceptId
          ) {
            const updated = updateStoredSuggestion(store, suggestion.id, "dismissed");
            if (updated) dismissed.push(updated);
          }
        }
        return dismissed;
      }
    };
    const service = new TopicSuggestionService({ communicationItems, topics, suggestions });

    const pending = await service.listPending("default-user");
    expect(pending).toHaveLength(1);
    expect(pending[0]?.id).toBe("higher-confidence");

    await service.dismissSuggestion("higher-confidence", "default-user");
    expect([...store.values()].filter((suggestion) => suggestion.status === "pending")).toHaveLength(0);
  });
});

function updateStoredSuggestion(
  store: Map<string, TopicSuggestion>,
  id: string,
  status: "accepted" | "dismissed"
): TopicSuggestion | undefined {
  const existing = store.get(id);
  if (!existing) {
    return undefined;
  }
  const now = new Date();
  const updated: TopicSuggestion = { ...existing, status, updatedAt: now, decidedAt: now };
  store.set(id, updated);
  return updated;
}
