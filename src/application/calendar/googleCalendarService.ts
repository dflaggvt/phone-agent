import { google } from "googleapis";
import type { CalendarConnectionRepository } from "../../domain/calendar/calendarConnection.js";
import type {
  CalendarEventRequest,
  CalendarEventRequestRepository
} from "../../domain/calendar/calendarEventRequest.js";
import type { AppLogger } from "../../shared/logger.js";
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
}

export interface CalendarFreeBusyInput {
  timeMin: Date;
  timeMax: Date;
  timeZone?: string;
}

export interface CalendarEventCreateInput {
  userId?: string;
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
  userId?: string;
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

  async status() {
    const connection = await this.dependencies.connections.get();
    return {
      configured: this.isConfigured(),
      connected: connection?.connected === true && Boolean(connection.refreshToken),
      provider: "google",
      connectedEmail: connection?.connectedEmail,
      scopes: connection?.scopes ?? GOOGLE_CALENDAR_SCOPES
    };
  }

  getConnectUrl(): string {
    const oauth = this.oauthClient();
    return oauth.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: GOOGLE_CALENDAR_SCOPES,
      include_granted_scopes: true,
      state: "primary"
    });
  }

  async handleCallback(code: string) {
    const oauth = this.oauthClient();
    const { tokens } = await oauth.getToken(code);
    if (!tokens.refresh_token) {
      const existing = await this.dependencies.connections.get();
      if (!existing?.refreshToken) {
        throw new Error("Google did not return a refresh token. Reconnect with consent prompt.");
      }
      tokens.refresh_token = existing.refreshToken;
    }

    oauth.setCredentials(tokens);
    const connectedEmail = await this.connectedEmail(oauth);
    const now = new Date();
    return this.dependencies.connections.save({
      id: "primary",
      provider: "google",
      connected: true,
      refreshToken: tokens.refresh_token,
      scopes: typeof tokens.scope === "string" ? tokens.scope.split(/\s+/) : GOOGLE_CALENDAR_SCOPES,
      connectedEmail,
      createdAt: (await this.dependencies.connections.get())?.createdAt ?? now,
      updatedAt: now
    });
  }

  async disconnect() {
    return this.dependencies.connections.disconnect();
  }

  async checkFreeBusy(input: CalendarFreeBusyInput) {
    const calendar = await this.calendarClient();
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

  async listPendingEventRequests(): Promise<CalendarEventRequest[]> {
    return this.dependencies.eventRequests.listPending();
  }

  async listRecentEventRequests(): Promise<CalendarEventRequest[]> {
    return this.dependencies.eventRequests.listRecent();
  }

  async acceptEventRequest(id: string): Promise<CalendarEventRequest | undefined> {
    return this.dependencies.eventRequests.accept(id);
  }

  async declineEventRequest(id: string): Promise<CalendarEventRequest | undefined> {
    return this.dependencies.eventRequests.decline(id);
  }

  async createCalendarEvent(input: CalendarEventCreateInput) {
    const status = await this.status();
    if (!status.configured) {
      return { status: "unavailable", message: "Google Calendar OAuth is not configured. Take a message instead." };
    }
    if (!status.connected) {
      return { status: "unavailable", message: "The user's Google Calendar is not connected yet. Take a message instead." };
    }

    const request = await this.dependencies.eventRequests.create({
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
    const status = await this.status();
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
    const calendar = await this.calendarClient();
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
    const calendar = await this.calendarClient();
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
      return this.dependencies.eventRequests.get(input.calendarEventRequestId);
    }
    if (input.calendarEventId) {
      return this.dependencies.eventRequests.findCreatedByEventId(input.calendarEventId);
    }
    const recent = await this.dependencies.eventRequests.listCreatedForCaller(input.callerNumber, 1);
    return recent[0];
  }

  private async calendarClient() {
    const connection = await this.dependencies.connections.get();
    if (!connection?.connected || !connection.refreshToken) {
      throw new Error("Google Calendar is not connected.");
    }
    const oauth = this.oauthClient();
    oauth.setCredentials({ refresh_token: connection.refreshToken });
    return google.calendar({ version: "v3", auth: oauth });
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
