import { Router } from "express";
import type { ProductAnalyticsEventRepository } from "../domain/analytics/productAnalyticsEvent.js";
import { analyticsEventsSchema } from "./clientSchemas.js";
import { assertSafeAnalyticsAttributes, asyncHandler, currentUserId } from "./routeSupport.js";

export function analyticsRoutes(input: {
  productAnalytics: ProductAnalyticsEventRepository;
}) {
  const router = Router();

  router.post("/events", asyncHandler(async (req, res) => {
    const parsed = analyticsEventsSchema.parse(req.body);
    const userId = currentUserId(res);
    const events = await input.productAnalytics.createMany(parsed.events.map((event) => ({
      userId,
      sessionId: event.sessionId,
      eventName: event.eventName,
      screen: event.screen,
      surface: event.surface,
      action: event.action,
      result: event.result,
      objectType: event.objectType,
      objectId: event.objectId,
      latencyMs: event.latencyMs,
      sequence: event.sequence,
      appVersion: event.appVersion,
      buildType: event.buildType,
      deviceClass: event.deviceClass,
      osVersion: event.osVersion,
      networkStatus: event.networkStatus,
      attributes: assertSafeAnalyticsAttributes(event.attributes ?? {}),
      occurredAt: event.occurredAt
    })));
    res.status(202).json({ accepted: events.length });
  }));

  return router;
}
