import { randomUUID } from "node:crypto";
import type {
  CalendarEventRequest,
  CalendarEventRequestRepository,
  CalendarEventRequestStatus,
  CreateCalendarEventRequestInput
} from "../../domain/calendar/calendarEventRequest.js";

export class InMemoryCalendarEventRequestRepository implements CalendarEventRequestRepository {
  private readonly requests = new Map<string, CalendarEventRequest>();

  async create(input: CreateCalendarEventRequestInput): Promise<CalendarEventRequest> {
    const now = new Date();
    const request: CalendarEventRequest = {
      id: randomUUID(),
      action: input.action ?? "create",
      status: "pending",
      providerCallId: input.providerCallId,
      callerNumber: input.callerNumber,
      callerName: input.callerName,
      title: input.title,
      description: input.description,
      startTime: input.startTime,
      endTime: input.endTime,
      timeZone: input.timeZone,
      reason: input.reason,
      sourceEventRequestId: input.sourceEventRequestId,
      createdEventId: input.createdEventId,
      createdEventHtmlLink: input.createdEventHtmlLink,
      createdAt: now,
      expiresAt: new Date(now.getTime() + (input.timeoutMs ?? 60_000))
    };
    this.requests.set(request.id, request);
    return request;
  }

  async get(id: string): Promise<CalendarEventRequest | undefined> {
    await this.expirePending();
    return this.requests.get(id);
  }

  async listPending(now = new Date()): Promise<CalendarEventRequest[]> {
    await this.expirePending(now);
    return [...this.requests.values()]
      .filter((request) => request.status === "pending")
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async listRecent(limit = 25): Promise<CalendarEventRequest[]> {
    await this.expirePending();
    return [...this.requests.values()]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async listCreatedForCaller(callerNumber?: string, limit = 10): Promise<CalendarEventRequest[]> {
    await this.expirePending();
    return [...this.requests.values()]
      .filter((request) => Boolean(request.createdEventId))
      .filter((request) => !callerNumber || request.callerNumber === callerNumber)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async findCreatedByEventId(eventId: string): Promise<CalendarEventRequest | undefined> {
    await this.expirePending();
    return [...this.requests.values()].find((request) => request.createdEventId === eventId);
  }

  async accept(id: string): Promise<CalendarEventRequest | undefined> {
    return this.decide(id, "accepted");
  }

  async decline(id: string): Promise<CalendarEventRequest | undefined> {
    return this.decide(id, "declined");
  }

  async markCreated(id: string, event: { eventId?: string; htmlLink?: string }): Promise<CalendarEventRequest | undefined> {
    const existing = await this.get(id);
    if (!existing) {
      return undefined;
    }
    const updated = { ...existing, status: "created" as const, createdEventId: event.eventId, createdEventHtmlLink: event.htmlLink, decidedAt: new Date() };
    this.requests.set(id, updated);
    return updated;
  }

  async markUpdated(id: string, event: { eventId?: string; htmlLink?: string }): Promise<CalendarEventRequest | undefined> {
    const existing = await this.get(id);
    if (!existing) {
      return undefined;
    }
    const updated = { ...existing, status: "updated" as const, createdEventId: event.eventId, createdEventHtmlLink: event.htmlLink, decidedAt: new Date() };
    this.requests.set(id, updated);
    return updated;
  }

  async markFailed(id: string, errorMessage: string): Promise<CalendarEventRequest | undefined> {
    const existing = await this.get(id);
    if (!existing) {
      return undefined;
    }
    const updated = { ...existing, status: "failed" as const, errorMessage, decidedAt: new Date() };
    this.requests.set(id, updated);
    return updated;
  }

  async expirePending(now = new Date()): Promise<void> {
    for (const request of this.requests.values()) {
      if (request.status === "pending" && request.expiresAt.getTime() <= now.getTime()) {
        this.requests.set(request.id, { ...request, status: "expired", decidedAt: now });
      }
    }
  }

  private async decide(id: string, status: Extract<CalendarEventRequestStatus, "accepted" | "declined">): Promise<CalendarEventRequest | undefined> {
    await this.expirePending();
    const existing = this.requests.get(id);
    if (!existing) {
      return undefined;
    }
    if (existing.status !== "pending") {
      return existing;
    }
    const updated = { ...existing, status, decidedAt: new Date() };
    this.requests.set(id, updated);
    return updated;
  }
}
