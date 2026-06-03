import { google } from "googleapis";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { CalendarConnectionRepository } from "../../domain/calendar/calendarConnection.js";
import type {
  CalendarEventRequest,
  CalendarEventRequestRepository
} from "../../domain/calendar/calendarEventRequest.js";
import type { AppLogger } from "../../shared/logger.js";
import { badRequest } from "../../shared/httpErrors.js";
import type { NotificationService } from "../notifications/notificationService.js";

export const GOOGLE_CALENDAR_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.freebusy",
  "https://www.googleapis.com/auth/calendar.events.owned"
];

export interface GoogleCalendarServiceConfig {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  stateSecret?: string;
}

export interface CalendarFreeBusyInput {
  userId: string;
  timeMin: Date;
  timeMax: Date;
  timeZone?: string;
}

export interface CalendarEventCreateInput {
  userId: string;
  providerCallId?: string;
  callerNumber?: string;
  callerName?: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  timeZone?: string;
  reason?: string;
}

export interface CalendarEventUpdateInput {
  userId: string;
  providerCallId?: string;
  callerNumber?: string;
  callerName?: string;
  calendarEventRequestId?: string;
  calendarEventId?: string;
  title?: string;
  description?: string;
  startTime?: Date;
  endTime?: Date;
  timeZone?: string;
  reason?: string;
}

export class GoogleCalendarService {
  constructor(
    private readonly dependencies: {
      connections: CalendarConnectionRepository;
      eventRequests: CalendarEventRequestRepository;
      notifications?: NotificationService;
      logger: AppLogger;
      config: GoogleCalendarServiceConfig;
      timeoutMs?: number;
      pollIntervalMs?: number;
    }
  ) {}

  isConfigured(): boolean {
    return Boolean(this.dependencies.config.clientId && this.dependencies.config.clientSecret && this.dependencies.config.redirectUri);
  }

  async status(userId: string) {
    const connection = await this.dependencies.connections.get(userId);
    return {
      configured: this.isConfigured(),
      connected: connection?.connected === true && Boolean(connection.refreshToken),
      provider: "google",
      connectedEmail: connection?.connectedEmail,
      scopes: connection?.scopes ?? GOOGLE_CALENDAR_SCOPES
    };
  }

  getConnectUrl(userId: string): string {
    const oauth = this.oauthClient();
    return oauth.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: GOOGLE_CALENDAR_SCOPES,
      include_granted_scopes: true,
      state: this.signState(userId)
    });
  }

  async handleCallback(code: string, state: string | undefined) {
    const userId = this.verifyState(state);
    const oauth = this.oauthClient();
    const { tokens } = await oauth.getToken(code);
    if (!tokens.refresh_token) {
      const existing = await this.dependencies.connections.get(userId);
      if (!existing?.refreshToken) {
        throw new Error("Google did not return a refresh token. Reconnect with consent prompt.");
      }
      tokens.refresh_token = existing.refreshToken;
    }

    oauth.setCredentials(tokens);
    const connectedEmail = await this.connectedEmail(oauth);
    const now = new Date();
    return this.dependencies.connections.save({
      id: userId,
      userId,
      provider: "google",
      connected: true,
      refreshToken: tokens.refresh_token,
      scopes: typeof tokens.scope === "string" ? tokens.scope.split(/\s+/) : GOOGLE_CALENDAR_SCOPES,
      connectedEmail,
      createdAt: (await this.dependencies.connections.get(userId))?.createdAt ?? now,
      updatedAt: now
    });
  }

  async disconnect(userId: string) {
    return this.dependencies.connections.disconnect(userId);
  }

  async checkFreeBusy(input: CalendarFreeBusyInput) {
    const calendar = await this.calendarClient(input.userId);
    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: input.timeMin.toISOString(),
        timeMax: input.timeMax.toISOString(),
        timeZone: input.timeZone ?? "America/New_York",
        items: [{ id: "primary" }]
      }
    });
    const busy = response.data.calendars?.primary?.busy ?? [];
    return {
      connected: true,
      timeMin: input.timeMin.toISOString(),
      timeMax: input.timeMax.toISOString(),
      timeZone: input.timeZone ?? "America/New_York",
      busy: busy.map((block) => ({ start: block.start, end: block.end })),
      isAvailable: busy.length === 0
    };
  }

  async listPendingEventRequests(userId: string): Promise<CalendarEventRequest[]> {
    return this.dependencies.eventRequests.listPending(userId);
  }

  async listRecentEventRequests(userId: string): Promise<CalendarEventRequest[]> {
    return this.dependencies.eventRequests.listRecent(userId);
  }

  async acceptEventRequest(id: string, userId: string): Promise<CalendarEventRequest | undefined> {
    return this.dependencies.eventRequests.accept(id, userId);
  }

  async declineEventRequest(id: string, userId: string): Promise<CalendarEventRequest | undefined> {
    return this.dependencies.eventRequests.decline(id, userId);
  }

  async createCalendarEvent(input: CalendarEventCreateInput) {
    const status = await this.status(input.userId);
    if (!status.configured) {
      return { status: "unavailable", message: "Google Calendar OAuth is not configured. Take a message instead." };
    }
    if (!status.connected) {
      return { status: "unavailable", message: "The user's Google Calendar is not connected yet. Take a message instead." };
    }

    const request = await this.dependencies.eventRequests.create({
      userId: input.userId,
      action: "create",
      providerCallId: input.providerCallId,
      callerNumber: input.callerNumber,
      callerName: input.callerName,
      title: input.title,
      description: input.description,
      startTime: input.startTime,
      endTime: input.endTime,
      timeZone: input.timeZone ?? "America/New_York",
      reason: input.reason
    });

    try {
      const created = await this.createEvent(request);
      const marked = await this.dependencies.eventRequests.markCreated(request.id, created);
      await this.dependencies.notifications?.createCalendarChange({
        userId: input.userId,
        calendarEventRequestId: request.id,
        status: marked?.status ?? "created",
        title: request.title
      });
      this.dependencies.logger.info(
        { calendarEventRequestId: request.id, providerCallId: request.providerCallId, eventId: created.eventId, title: request.title },
        "calendar event created by assistant"
      );
      return {
        calendar_event_request_id: request.id,
        status: "created",
        event_id: created.eventId,
        event_link: created.htmlLink,
        message: "The calendar event has been created. The user will be notified of the calendar change."
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Calendar event creation failed.";
      const failed = await this.dependencies.eventRequests.markFailed(request.id, message);
      await this.dependencies.notifications?.createCalendarChange({
        userId: input.userId,
        calendarEventRequestId: request.id,
        status: failed?.status ?? "failed",
        title: request.title
      });
      return {
        calendar_event_request_id: request.id,
        status: "failed",
        message: "Calendar event creation failed. Take a concise message instead."
      };
    }
  }

  async updateCalendarEvent(input: CalendarEventUpdateInput) {
    const status = await this.status(input.userId);
    if (!status.configured) {
      return { status: "unavailable", message: "Google Calendar OAuth is not configured. Take a message instead." };
    }
    if (!status.connected) {
      return { status: "unavailable", message: "The user's Google Calendar is not connected yet. Take a message instead." };
    }

    const source = await this.findAgentCreatedEvent(input);
    if (!source?.createdEventId) {
      return {
        status: "not_allowed",
        message: "I can only update calendar events that I previously created. Take a concise message instead."
      };
    }

    if (!input.title && !input.description && !input.startTime && !input.endTime && !input.timeZone) {
      return {
        status: "missing_changes",
        message: "No calendar changes were provided. Ask one brief clarifying question."
      };
    }

    const request = await this.dependencies.eventRequests.create({
      userId: input.userId,
      action: "update",
      providerCallId: input.providerCallId,
      callerNumber: input.callerNumber ?? source.callerNumber,
      callerName: input.callerName ?? source.callerName,
      title: input.title ?? source.title,
      description: input.description ?? source.description,
      startTime: input.startTime ?? source.startTime,
      endTime: input.endTime ?? source.endTime,
      timeZone: input.timeZone ?? source.timeZone,
      reason: input.reason,
      sourceEventRequestId: source.id,
      createdEventId: source.createdEventId,
      createdEventHtmlLink: source.createdEventHtmlLink
    });

    try {
      const updated = await this.updateEvent(source.createdEventId, request);
      const marked = await this.dependencies.eventRequests.markUpdated(request.id, updated);
      await this.dependencies.notifications?.createCalendarChange({
        userId: input.userId,
        calendarEventRequestId: request.id,
        status: marked?.status ?? "updated",
        title: request.title
      });
      this.dependencies.logger.info(
        {
          calendarEventRequestId: request.id,
          sourceEventRequestId: source.id,
          providerCallId: request.providerCallId,
          eventId: updated.eventId
        },
        "calendar event updated by assistant"
      );
      return {
        calendar_event_request_id: request.id,
        source_calendar_event_request_id: source.id,
        status: "updated",
        event_id: updated.eventId,
        event_link: updated.htmlLink,
        message: "The calendar event has been updated. The user will be notified of the calendar change."
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Calendar event update failed.";
      const failed = await this.dependencies.eventRequests.markFailed(request.id, message);
      await this.dependencies.notifications?.createCalendarChange({
        userId: input.userId,
        calendarEventRequestId: request.id,
        status: failed?.status ?? "failed",
        title: request.title
      });
      return {
        calendar_event_request_id: request.id,
        source_calendar_event_request_id: source.id,
        status: "failed",
        message: "Calendar event update failed. Take a concise message instead."
      };
    }
  }

  private async createEvent(request: CalendarEventRequest): Promise<{ eventId?: string; htmlLink?: string }> {
    const calendar = await this.calendarClient(request.userId);
    const response = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: request.title,
        description: request.description,
        start: { dateTime: request.startTime.toISOString(), timeZone: request.timeZone },
        end: { dateTime: request.endTime.toISOString(), timeZone: request.timeZone }
      }
    });
    return { eventId: response.data.id ?? undefined, htmlLink: response.data.htmlLink ?? undefined };
  }

  private async updateEvent(eventId: string, request: CalendarEventRequest): Promise<{ eventId?: string; htmlLink?: string }> {
    const calendar = await this.calendarClient(request.userId);
    const response = await calendar.events.patch({
      calendarId: "primary",
      eventId,
      requestBody: {
        summary: request.title,
        description: request.description,
        start: { dateTime: request.startTime.toISOString(), timeZone: request.timeZone },
        end: { dateTime: request.endTime.toISOString(), timeZone: request.timeZone }
      }
    });
    return { eventId: response.data.id ?? eventId, htmlLink: response.data.htmlLink ?? request.createdEventHtmlLink };
  }

  private async findAgentCreatedEvent(input: CalendarEventUpdateInput): Promise<CalendarEventRequest | undefined> {
    if (input.calendarEventRequestId) {
      return this.dependencies.eventRequests.get(input.calendarEventRequestId, input.userId);
    }
    if (input.calendarEventId) {
      return this.dependencies.eventRequests.findCreatedByEventId(input.userId, input.calendarEventId);
    }
    const recent = await this.dependencies.eventRequests.listCreatedForCaller(input.userId, input.callerNumber, 1);
    return recent[0];
  }

  private async calendarClient(userId: string) {
    const connection = await this.dependencies.connections.get(userId);
    if (!connection?.connected || !connection.refreshToken) {
      throw new Error("Google Calendar is not connected.");
    }
    const oauth = this.oauthClient();
    oauth.setCredentials({ refresh_token: connection.refreshToken });
    return google.calendar({ version: "v3", auth: oauth });
  }

  private signState(userId: string): string {
    const payload = Buffer.from(JSON.stringify({
      userId,
      nonce: randomUUID(),
      issuedAt: new Date().toISOString()
    })).toString("base64url");
    const signature = createHmac("sha256", this.stateSecret()).update(payload).digest("base64url");
    return `${payload}.${signature}`;
  }

  private verifyState(state: string | undefined): string {
    if (!state) {
      throw badRequest("google_oauth_state_missing", "Google OAuth state is missing.");
    }
    const [payload, signature] = state.split(".");
    if (!payload || !signature) {
      throw badRequest("google_oauth_state_invalid", "Google OAuth state is invalid.");
    }
    const expected = createHmac("sha256", this.stateSecret()).update(payload).digest("base64url");
    if (!safeEqual(signature, expected)) {
      throw badRequest("google_oauth_state_invalid", "Google OAuth state could not be verified.");
    }
    const parsed = parseStatePayload(payload);
    if (typeof parsed.userId !== "string" || parsed.userId.length === 0) {
      throw badRequest("google_oauth_state_invalid", "Google OAuth state does not contain a user.");
    }
    if (typeof parsed.issuedAt === "string") {
      const issuedAt = new Date(parsed.issuedAt);
      const ageMs = Date.now() - issuedAt.getTime();
      if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > 15 * 60_000) {
        throw badRequest("google_oauth_state_expired", "Google OAuth state expired.");
      }
    }
    return parsed.userId;
  }

  private stateSecret(): string {
    return this.dependencies.config.stateSecret ?? this.dependencies.config.clientSecret ?? "";
  }

  private oauthClient() {
    const { clientId, clientSecret, redirectUri } = this.dependencies.config;
    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error("Google Calendar OAuth is not configured.");
    }
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  private async connectedEmail(oauth: InstanceType<typeof google.auth.OAuth2>): Promise<string | undefined> {
    try {
      const oauth2 = google.oauth2({ version: "v2", auth: oauth });
      const response = await oauth2.userinfo.get();
      return response.data.email ?? undefined;
    } catch (error) {
      this.dependencies.logger.warn({ error }, "could not fetch google userinfo");
      return undefined;
    }
  }
}

function safeEqual(signature: string, expected: string): boolean {
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return signatureBuffer.length === expectedBuffer.length && timingSafeEqual(signatureBuffer, expectedBuffer);
}

function parseStatePayload(payload: string): { userId?: unknown; issuedAt?: unknown } {
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { userId?: unknown; issuedAt?: unknown };
  } catch {
    throw badRequest("google_oauth_state_invalid", "Google OAuth state is invalid.");
  }
}
