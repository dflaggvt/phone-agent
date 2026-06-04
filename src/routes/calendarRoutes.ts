import { Router } from "express";
import type { GoogleCalendarService } from "../application/calendar/googleCalendarService.js";
import { HttpError, notFound } from "../shared/httpErrors.js";
import { asyncHandler, currentUserId, requireRouteParam } from "./routeSupport.js";

export function calendarRoutes(input: {
  calendar: GoogleCalendarService;
}) {
  const router = Router();

  router.get("/v1/calendar/status", asyncHandler(async (_req, res) => {
    res.status(200).json(await input.calendar.status(currentUserId(res)));
  }));

  router.get("/v1/calendar/connect-url", asyncHandler(async (_req, res) => {
    if (!input.calendar.isConfigured()) {
      throw new HttpError(400, "google_calendar_oauth_not_configured", "Google Calendar OAuth credentials are not configured.");
    }
    res.status(200).json({ url: input.calendar.getConnectUrl(currentUserId(res)) });
  }));

  router.get("/oauth/google/calendar/callback", asyncHandler(async (req, res) => {
    const code = typeof req.query.code === "string" ? req.query.code : undefined;
    const state = typeof req.query.state === "string" ? req.query.state : undefined;
    if (!code) {
      throw new HttpError(400, "oauth_code_missing", "Google OAuth callback did not include a code.");
    }
    await input.calendar.handleCallback(code, state);
    res.status(200).send("<html><body><h1>Google Calendar connected</h1><p>You can return to Phone Agent.</p></body></html>");
  }));

  router.post("/v1/calendar/disconnect", asyncHandler(async (_req, res) => {
    const connection = await input.calendar.disconnect(currentUserId(res));
    res.status(200).json({ connection: connection ?? null });
  }));

  router.get("/v1/calendar/event-requests", asyncHandler(async (_req, res) => {
    const eventRequests = await input.calendar.listRecentEventRequests(currentUserId(res));
    res.status(200).json({ eventRequests });
  }));

  router.post("/v1/calendar/event-requests/:eventRequestId/accept", asyncHandler(async (req, res) => {
    const eventRequestId = requireRouteParam(req.params.eventRequestId, "eventRequestId");
    const eventRequest = await input.calendar.acceptEventRequest(eventRequestId, currentUserId(res));
    if (!eventRequest) {
      throw notFound("calendar_event_request_not_found", "Calendar event request was not found.");
    }
    res.status(200).json({ eventRequest });
  }));

  router.post("/v1/calendar/event-requests/:eventRequestId/decline", asyncHandler(async (req, res) => {
    const eventRequestId = requireRouteParam(req.params.eventRequestId, "eventRequestId");
    const eventRequest = await input.calendar.declineEventRequest(eventRequestId, currentUserId(res));
    if (!eventRequest) {
      throw notFound("calendar_event_request_not_found", "Calendar event request was not found.");
    }
    res.status(200).json({ eventRequest });
  }));

  return router;
}
