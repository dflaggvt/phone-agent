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
