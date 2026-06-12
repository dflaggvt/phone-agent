import { Router } from "express";
import type { TopicSuggestionService } from "../application/topics/topicSuggestionService.js";
import type { TopicThreadService } from "../application/topics/topicThreadService.js";
import type { CommunicationItem, CommunicationChannel, CommunicationItemRepository } from "../domain/communications/communicationItem.js";
import type { TopicThread } from "../domain/topics/topicThread.js";
import { notFound } from "../shared/httpErrors.js";
import {
  decisionCreateSchema,
  openQuestionCreateSchema,
  topicAttachCommunicationSchema,
  topicCreateSchema,
  topicTaskCreateSchema
} from "./clientSchemas.js";
import { asyncHandler, currentUserId, requireRouteParam } from "./routeSupport.js";

export function topicRoutes(input: {
  topicThreads: TopicThreadService;
  topicSuggestions: TopicSuggestionService;
  communicationItems: CommunicationItemRepository;
}) {
  const router = Router();

  router.get("/topics", asyncHandler(async (_req, res) => {
    const userId = currentUserId(res);
    const topics = await input.topicThreads.list(userId);
    res.status(200).json({ topics: await presentTopicsWithTimeline(topics, input.communicationItems, userId) });
  }));

  router.post("/topics", asyncHandler(async (req, res) => {
    const parsed = topicCreateSchema.parse(req.body);
    const topic = await input.topicThreads.create({ userId: currentUserId(res), ...parsed });
    res.status(201).json({ topic });
  }));

  router.get("/topics/:topicThreadId", asyncHandler(async (req, res) => {
    const topicThreadId = requireRouteParam(req.params.topicThreadId, "topicThreadId");
    const userId = currentUserId(res);
    const topic = await requireUserTopic(input.topicThreads, topicThreadId, userId);
    const [presentedTopic] = await presentTopicsWithTimeline([topic], input.communicationItems, userId);
    res.status(200).json({ topic: presentedTopic });
  }));

  router.post("/topics/:topicThreadId/communications", asyncHandler(async (req, res) => {
    const topicThreadId = requireRouteParam(req.params.topicThreadId, "topicThreadId");
    const parsed = topicAttachCommunicationSchema.parse(req.body);
    const item = await input.communicationItems.get(parsed.communicationItemId);
    if (!item || item.userId !== currentUserId(res)) {
      throw notFound("communication_item_not_found", "Communication item was not found.");
    }
    await requireUserTopic(input.topicThreads, topicThreadId, currentUserId(res));
    const topic = await input.topicThreads.attachCommunication({ topicThreadId, ...parsed });
    if (!topic) {
      throw notFound("topic_thread_not_found", "Topic thread was not found.");
    }
    res.status(200).json({ topic });
  }));

  router.post("/topics/:topicThreadId/decisions", asyncHandler(async (req, res) => {
    const topicThreadId = requireRouteParam(req.params.topicThreadId, "topicThreadId");
    const parsed = decisionCreateSchema.parse(req.body);
    await requireUserTopic(input.topicThreads, topicThreadId, currentUserId(res));
    const topic = await input.topicThreads.addDecision(topicThreadId, parsed);
    if (!topic) {
      throw notFound("topic_thread_not_found", "Topic thread was not found.");
    }
    res.status(201).json({ topic, decision: topic.decisions.at(-1) });
  }));

  router.post("/topics/:topicThreadId/open-questions", asyncHandler(async (req, res) => {
    const topicThreadId = requireRouteParam(req.params.topicThreadId, "topicThreadId");
    const parsed = openQuestionCreateSchema.parse(req.body);
    await requireUserTopic(input.topicThreads, topicThreadId, currentUserId(res));
    const topic = await input.topicThreads.addOpenQuestion(topicThreadId, parsed);
    if (!topic) {
      throw notFound("topic_thread_not_found", "Topic thread was not found.");
    }
    res.status(201).json({ topic, openQuestion: topic.openQuestions.at(-1) });
  }));

  router.post("/topics/:topicThreadId/tasks", asyncHandler(async (req, res) => {
    const topicThreadId = requireRouteParam(req.params.topicThreadId, "topicThreadId");
    const parsed = topicTaskCreateSchema.parse(req.body);
    await requireUserTopic(input.topicThreads, topicThreadId, currentUserId(res));
    const topic = await input.topicThreads.addTask(topicThreadId, parsed);
    if (!topic) {
      throw notFound("topic_thread_not_found", "Topic thread was not found.");
    }
    res.status(201).json({ topic, task: topic.tasks.at(-1) });
  }));

  router.get("/topic-suggestions", asyncHandler(async (_req, res) => {
    const suggestions = await input.topicSuggestions.listPending(currentUserId(res));
    res.status(200).json({ suggestions });
  }));

  router.post("/topic-suggestions/:suggestionId/accept", asyncHandler(async (req, res) => {
    const suggestionId = requireRouteParam(req.params.suggestionId, "suggestionId");
    const result = await input.topicSuggestions.acceptSuggestion(suggestionId, currentUserId(res));
    if (!result) {
      throw notFound("topic_suggestion_not_found", "Topic suggestion was not found.");
    }
    res.status(200).json(result);
  }));

  router.post("/topic-suggestions/:suggestionId/dismiss", asyncHandler(async (req, res) => {
    const suggestionId = requireRouteParam(req.params.suggestionId, "suggestionId");
    const suggestion = await input.topicSuggestions.dismissSuggestion(suggestionId, currentUserId(res));
    if (!suggestion) {
      throw notFound("topic_suggestion_not_found", "Topic suggestion was not found.");
    }
    res.status(200).json({ suggestion });
  }));

  return router;
}

async function requireUserTopic(topicThreads: TopicThreadService, topicThreadId: string, userId: string) {
  const topic = await topicThreads.get(topicThreadId);
  if (!topic || topic.userId !== userId) {
    throw notFound("topic_thread_not_found", "Topic thread was not found.");
  }
  return topic;
}

async function presentTopicsWithTimeline(
  topics: TopicThread[],
  communicationItems: CommunicationItemRepository,
  userId: string
) {
  const ids = topics.flatMap((topic) => topic.communicationItemIds);
  const items = await communicationItems.listByIdsForUser(userId, ids);
  const itemById = new Map(items.map((item) => [item.id, item]));

  return topics.map((topic) => {
    const timeline = topic.communicationItemIds
      .map((id) => itemById.get(id))
      .filter((item): item is CommunicationItem => item !== undefined)
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
      .slice(0, 8)
      .map(presentTopicTimelineItem);

    return {
      ...topic,
      communicationCount: topic.communicationItemIds.length,
      timeline
    };
  });
}

function presentTopicTimelineItem(item: CommunicationItem) {
  const channelLabel = communicationChannelLabel(item.channel);
  const senderName = item.sender?.displayName || item.sender?.phoneNumber || "Unknown";
  return {
    id: item.id,
    communicationItemId: item.id,
    channel: item.channel,
    channelLabel,
    title: item.channel === "phone_call" ? `Call from ${senderName}` : `${channelLabel} from ${senderName}`,
    summary: compactTimelineText(item.summary || item.bodyText || item.transcriptText || "No summary is available yet."),
    occurredAt: item.occurredAt.toISOString(),
    senderName
  };
}

function communicationChannelLabel(channel: CommunicationChannel): string {
  switch (channel) {
    case "sms":
      return "SMS";
    case "email":
      return "Email";
    case "calendar_event":
      return "Calendar";
    case "document":
      return "Document";
    case "manual_note":
      return "Note";
    case "agent_message":
      return "Agent message";
    case "phone_call":
    default:
      return "Call";
  }
}

function compactTimelineText(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 240 ? `${normalized.slice(0, 237).trimEnd()}...` : normalized;
}
