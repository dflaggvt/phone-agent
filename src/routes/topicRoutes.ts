import { Router } from "express";
import type { TopicSuggestionService } from "../application/topics/topicSuggestionService.js";
import type { TopicThreadService } from "../application/topics/topicThreadService.js";
import type { CommunicationItemRepository } from "../domain/communications/communicationItem.js";
import type { TopicThread } from "../domain/topics/topicThread.js";
import { notFound } from "../shared/httpErrors.js";
import {
  decisionCreateSchema,
  openQuestionCreateSchema,
  topicAttachCommunicationSchema,
  topicCreateSchema,
  topicTaskCreateSchema
} from "./clientSchemas.js";
import { presentTopicThreads } from "./topicPresenters.js";
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
    res.status(200).json({
      topics: await presentTopicThreads({ topics, communicationItems: input.communicationItems, userId })
    });
  }));

  router.post("/topics", asyncHandler(async (req, res) => {
    const parsed = topicCreateSchema.parse(req.body);
    const userId = currentUserId(res);
    const topic = await input.topicThreads.create({ userId, ...parsed });
    res.status(201).json({
      topic: await presentTopic(topic, input.communicationItems, userId)
    });
  }));

  router.get("/topics/:topicThreadId", asyncHandler(async (req, res) => {
    const topicThreadId = requireRouteParam(req.params.topicThreadId, "topicThreadId");
    const userId = currentUserId(res);
    const topic = await requireUserTopic(input.topicThreads, topicThreadId, userId);
    const [presentedTopic] = await presentTopicThreads({
      topics: [topic],
      communicationItems: input.communicationItems,
      userId
    });
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
    res.status(200).json({
      topic: await presentTopic(topic, input.communicationItems, currentUserId(res))
    });
  }));

  router.post("/topics/:topicThreadId/decisions", asyncHandler(async (req, res) => {
    const topicThreadId = requireRouteParam(req.params.topicThreadId, "topicThreadId");
    const parsed = decisionCreateSchema.parse(req.body);
    await requireUserTopic(input.topicThreads, topicThreadId, currentUserId(res));
    const topic = await input.topicThreads.addDecision(topicThreadId, parsed);
    if (!topic) {
      throw notFound("topic_thread_not_found", "Topic thread was not found.");
    }
    res.status(201).json({
      topic: await presentTopic(topic, input.communicationItems, currentUserId(res)),
      decision: topic.decisions.at(-1)
    });
  }));

  router.post("/topics/:topicThreadId/open-questions", asyncHandler(async (req, res) => {
    const topicThreadId = requireRouteParam(req.params.topicThreadId, "topicThreadId");
    const parsed = openQuestionCreateSchema.parse(req.body);
    await requireUserTopic(input.topicThreads, topicThreadId, currentUserId(res));
    const topic = await input.topicThreads.addOpenQuestion(topicThreadId, parsed);
    if (!topic) {
      throw notFound("topic_thread_not_found", "Topic thread was not found.");
    }
    res.status(201).json({
      topic: await presentTopic(topic, input.communicationItems, currentUserId(res)),
      openQuestion: topic.openQuestions.at(-1)
    });
  }));

  router.post("/topics/:topicThreadId/tasks", asyncHandler(async (req, res) => {
    const topicThreadId = requireRouteParam(req.params.topicThreadId, "topicThreadId");
    const parsed = topicTaskCreateSchema.parse(req.body);
    await requireUserTopic(input.topicThreads, topicThreadId, currentUserId(res));
    const topic = await input.topicThreads.addTask(topicThreadId, parsed);
    if (!topic) {
      throw notFound("topic_thread_not_found", "Topic thread was not found.");
    }
    res.status(201).json({
      topic: await presentTopic(topic, input.communicationItems, currentUserId(res)),
      task: topic.tasks.at(-1)
    });
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
    res.status(200).json({
      ...result,
      topic: await presentTopic(result.topic, input.communicationItems, currentUserId(res))
    });
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

async function presentTopic(
  topic: TopicThread,
  communicationItems: CommunicationItemRepository,
  userId: string
) {
  const [presentedTopic] = await presentTopicThreads({ topics: [topic], communicationItems, userId });
  if (!presentedTopic) {
    throw new Error("Topic presenter returned no topic for a single-topic input.");
  }
  return presentedTopic;
}
