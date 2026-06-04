import type express from "express";
import type { RequestHandler } from "express";
import { HttpError } from "../shared/httpErrors.js";

export function asyncHandler(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function currentUserId(res: express.Response): string {
  return typeof res.locals.userId === "string" && res.locals.userId.length > 0
    ? res.locals.userId
    : "";
}

export function currentFirebaseUid(res: express.Response): string | undefined {
  return typeof res.locals.firebaseUid === "string" && res.locals.firebaseUid.length > 0
    ? res.locals.firebaseUid
    : undefined;
}

export function requireRouteParam(value: string | string[] | undefined, name: string): string {
  if (!value || Array.isArray(value)) {
    throw new HttpError(400, "route_param_missing", `${name} route parameter is required.`);
  }
  return value;
}

export function rawBody(req: express.Request): string {
  if (!Buffer.isBuffer(req.body)) {
    throw new HttpError(400, "raw_body_missing", "Expected raw application/json request body.");
  }

  return req.body.toString("utf-8");
}

export function notificationActionSurface(req: express.Request): "notification_action" | "app_screen" | "api" {
  const surface = req.header("x-phone-agent-action-surface");
  return surface === "notification_action" || surface === "app_screen" ? surface : "api";
}

export function assertSafeAnalyticsAttributes(
  attributes: Record<string, string | number | boolean>
): Record<string, string | number | boolean> {
  const forbidden = [
    "transcript",
    "summary",
    "note",
    "answer",
    "query",
    "search",
    "contact",
    "calendar_description",
    "description",
    "payment",
    "card",
    "secret",
    "token",
    "payload",
    "body",
    "message"
  ];
  for (const key of Object.keys(attributes)) {
    const normalized = key.toLowerCase();
    if (forbidden.some((word) => normalized.includes(word))) {
      throw new HttpError(400, "unsafe_analytics_attribute", "Analytics attributes cannot include private communication content.");
    }
  }
  return attributes;
}
