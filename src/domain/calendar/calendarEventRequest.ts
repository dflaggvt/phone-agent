export type CalendarEventRequestStatus = "pending" | "accepted" | "declined" | "expired" | "created" | "updated" | "failed";
export type CalendarEventAction = "create" | "update";

export interface CalendarEventRequest {
  id: string;
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
  get(id: string): Promise<CalendarEventRequest | undefined>;
  listPending(now?: Date): Promise<CalendarEventRequest[]>;
  listRecent(limit?: number): Promise<CalendarEventRequest[]>;
  listCreatedForCaller(callerNumber?: string, limit?: number): Promise<CalendarEventRequest[]>;
  findCreatedByEventId(eventId: string): Promise<CalendarEventRequest | undefined>;
  accept(id: string): Promise<CalendarEventRequest | undefined>;
  decline(id: string): Promise<CalendarEventRequest | undefined>;
  markCreated(id: string, event: { eventId?: string; htmlLink?: string }): Promise<CalendarEventRequest | undefined>;
  markUpdated(id: string, event: { eventId?: string; htmlLink?: string }): Promise<CalendarEventRequest | undefined>;
  markFailed(id: string, errorMessage: string): Promise<CalendarEventRequest | undefined>;
  expirePending(now?: Date): Promise<void>;
}
