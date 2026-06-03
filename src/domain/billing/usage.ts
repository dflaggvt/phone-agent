export type UsageEventType =
  | "call_minute"
  | "openai_classification"
  | "calendar_write"
  | "outbound_call_attempt";

export interface UsageEvent {
  id: string;
  idempotencyKey: string;
  userId: string;
  type: UsageEventType;
  quantity: number;
  provider?: string;
  sourceId?: string;
  billingMeterEventId?: string;
  billingPublishedAt?: Date;
  billingPublishError?: string;
  occurredAt: Date;
  createdAt: Date;
}

export interface CreateUsageEventInput {
  userId: string;
  type: UsageEventType;
  quantity: number;
  idempotencyKey?: string;
  provider?: string;
  sourceId?: string;
  occurredAt?: Date;
}

export interface UsageSummary {
  userId: string;
  periodStart: Date;
  periodEnd: Date;
  callMinutes: number;
  classificationRequests: number;
  calendarWrites: number;
  outboundCallAttempts: number;
}

export interface UsageEventRepository {
  create(input: CreateUsageEventInput): Promise<UsageEvent>;
  markBillingPublished(id: string, billingMeterEventId: string, publishedAt?: Date): Promise<UsageEvent | undefined>;
  markBillingPublishFailed(id: string, error: string): Promise<UsageEvent | undefined>;
  summarizeForUser(userId: string, periodStart: Date, periodEnd: Date): Promise<UsageSummary>;
}
