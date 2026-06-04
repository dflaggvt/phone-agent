import { Router } from "express";
import type { NotificationService } from "../application/notifications/notificationService.js";
import { notFound } from "../shared/httpErrors.js";
import { pushTokenRegistrationSchema } from "./clientSchemas.js";
import { asyncHandler, currentUserId, requireRouteParam } from "./routeSupport.js";

export function notificationRoutes(input: {
  notifications: NotificationService;
}) {
  const router = Router();

  router.get("/notifications", asyncHandler(async (req, res) => {
    const unreadOnly = req.query.unread === "true";
    const events = await input.notifications.list(currentUserId(res), unreadOnly);
    res.status(200).json({ notifications: events.map(redactedNotificationEvent) });
  }));

  router.get("/notifications/action-audits", asyncHandler(async (_req, res) => {
    const audits = await input.notifications.listActionAudits(currentUserId(res));
    res.status(200).json({ audits });
  }));

  router.get("/notifications/deliveries", asyncHandler(async (_req, res) => {
    const deliveries = await input.notifications.listDeliveries(currentUserId(res));
    res.status(200).json({ deliveries });
  }));

  router.post("/push-tokens", asyncHandler(async (req, res) => {
    const parsed = pushTokenRegistrationSchema.parse(req.body);
    const token = await input.notifications.registerPushDeviceToken({
      userId: currentUserId(res),
      token: parsed.token,
      platform: parsed.platform,
      deviceId: parsed.deviceId,
      appVersion: parsed.appVersion
    });
    res.status(200).json({
      pushToken: token
        ? {
          id: token.id,
          platform: token.platform,
          status: token.status,
          lastSeenAt: token.lastSeenAt,
          updatedAt: token.updatedAt
        }
        : { status: "unavailable" }
    });
  }));

  router.post("/notifications/:notificationId/read", asyncHandler(async (req, res) => {
    const notificationId = requireRouteParam(req.params.notificationId, "notificationId");
    const event = await input.notifications.markRead(notificationId, currentUserId(res));
    if (!event) {
      throw notFound("notification_not_found", "Notification was not found.");
    }
    res.status(200).json({ notification: redactedNotificationEvent(event) });
  }));

  router.post("/notifications/:notificationId/dismiss", asyncHandler(async (req, res) => {
    const notificationId = requireRouteParam(req.params.notificationId, "notificationId");
    const event = await input.notifications.dismiss(notificationId, currentUserId(res));
    if (!event) {
      throw notFound("notification_not_found", "Notification was not found.");
    }
    res.status(200).json({ notification: redactedNotificationEvent(event) });
  }));

  return router;
}

function redactedNotificationEvent(event: Awaited<ReturnType<NotificationService["create"]>>) {
  return {
    id: event.id,
    type: event.type,
    priority: event.priority,
    privacy: event.privacy,
    title: event.title,
    body: event.body,
    target: event.target,
    sourceType: event.sourceType,
    sourceId: event.sourceId,
    actions: event.actions,
    status: event.status,
    expiresAt: event.expiresAt,
    createdAt: event.createdAt,
    readAt: event.readAt,
    dismissedAt: event.dismissedAt
  };
}
