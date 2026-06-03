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
      userId: input.userId,
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

  async get(id: string, userId: string): Promise<CalendarEventRequest | undefined> {
    await this.expirePending();
    const request = this.requests.get(id);
    return request?.userId === userId ? request : undefined;
  }

  async listPending(userId: string, now = new Date()): Promise<CalendarEventRequest[]> {
    await this.expirePending(now);
    return [...this.requests.values()]
      .filter((request) => request.userId === userId && request.status === "pending")
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async listRecent(userId: string, limit = 25): Promise<CalendarEventRequest[]> {
    await this.expirePending();
    return [...this.requests.values()]
      .filter((request) => request.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async listCreatedForCaller(userId: string, callerNumber?: string, limit = 10): Promise<CalendarEventRequest[]> {
    await this.expirePending();
    return [...this.requests.values()]
      .filter((request) => request.userId === userId)
      .filter((request) => Boolean(request.createdEventId))
      .filter((request) => !callerNumber || request.callerNumber === callerNumber)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async findCreatedByEventId(userId: string, eventId: string): Promise<CalendarEventRequest | undefined> {
    await this.expirePending();
    return [...this.requests.values()].find((request) => request.userId === userId && request.createdEventId === eventId);
  }

  async accept(id: string, userId: string): Promise<CalendarEventRequest | undefined> {
    return this.decide(id, userId, "accepted");
  }

  async decline(id: string, userId: string): Promise<CalendarEventRequest | undefined> {
    return this.decide(id, userId, "declined");
  }

  async markCreated(id: string, event: { eventId?: string; htmlLink?: string }): Promise<CalendarEventRequest | undefined> {
    return this.updateStatus(id, { status: "created", createdEventId: event.eventId, createdEventHtmlLink: event.htmlLink, decidedAt: new Date() });
  }

  async markUpdated(id: string, event: { eventId?: string; htmlLink?: string }): Promise<CalendarEventRequest | undefined> {
    return this.updateStatus(id, { status: "updated", createdEventId: event.eventId, createdEventHtmlLink: event.htmlLink, decidedAt: new Date() });
  }

  async markFailed(id: string, errorMessage: string): Promise<CalendarEventRequest | undefined> {
    return this.updateStatus(id, { status: "failed", errorMessage, decidedAt: new Date() });
  }

  async expirePending(now = new Date()): Promise<void> {
    for (const request of this.requests.values()) {
      if (request.status === "pending" && request.expiresAt.getTime() <= now.getTime()) {
        this.requests.set(request.id, { ...request, status: "expired", decidedAt: now });
      }
    }
  }

  private async decide(id: string, userId: string, status: Extract<CalendarEventRequestStatus, "accepted" | "declined">): Promise<CalendarEventRequest | undefined> {
    await this.expirePending();
    const existing = this.requests.get(id);
    if (!existing || existing.userId !== userId) {
      return undefined;
    }
    if (existing.status !== "pending") {
      return existing;
    }
    const updated = { ...existing, status, decidedAt: new Date() };
    this.requests.set(id, updated);
    return updated;
  }

  private async updateStatus(id: string, input: Partial<CalendarEventRequest>): Promise<CalendarEventRequest | undefined> {
    const existing = this.requests.get(id);
    if (!existing) {
      return undefined;
    }
    const updated = { ...existing, ...input };
    this.requests.set(id, updated);
    return updated;
  }
}
