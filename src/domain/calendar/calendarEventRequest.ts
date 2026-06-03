export type CalendarEventRequestStatus = "pending" | "accepted" | "declined" | "expired" | "created" | "updated" | "failed";
export type CalendarEventAction = "create" | "update";

export interface CalendarEventRequest {
  id: string;
  userId: string;
  action: CalendarEventAction;
  status: CalendarEventRequestStatus;
  providerCallId?: string;
  callerNumber?: string;
  callerName?: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  timeZone: string;
  reason?: string;
  sourceEventRequestId?: string;
  createdEventId?: string;
  createdEventHtmlLink?: string;
  errorMessage?: string;
  createdAt: Date;
  expiresAt: Date;
  decidedAt?: Date;
}

export interface CreateCalendarEventRequestInput {
  userId: string;
  action?: CalendarEventAction;
  providerCallId?: string;
  callerNumber?: string;
  callerName?: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  timeZone: string;
  reason?: string;
  sourceEventRequestId?: string;
  createdEventId?: string;
  createdEventHtmlLink?: string;
  timeoutMs?: number;
}

export interface CalendarEventRequestRepository {
  create(input: CreateCalendarEventRequestInput): Promise<CalendarEventRequest>;
  get(id: string, userId: string): Promise<CalendarEventRequest | undefined>;
  listPending(userId: string, now?: Date): Promise<CalendarEventRequest[]>;
  listRecent(userId: string, limit?: number): Promise<CalendarEventRequest[]>;
  listCreatedForCaller(userId: string, callerNumber?: string, limit?: number): Promise<CalendarEventRequest[]>;
  findCreatedByEventId(userId: string, eventId: string): Promise<CalendarEventRequest | undefined>;
  accept(id: string, userId: string): Promise<CalendarEventRequest | undefined>;
  decline(id: string, userId: string): Promise<CalendarEventRequest | undefined>;
  markCreated(id: string, event: { eventId?: string; htmlLink?: string }): Promise<CalendarEventRequest | undefined>;
  markUpdated(id: string, event: { eventId?: string; htmlLink?: string }): Promise<CalendarEventRequest | undefined>;
  markFailed(id: string, errorMessage: string): Promise<CalendarEventRequest | undefined>;
  expirePending(now?: Date): Promise<void>;
}
