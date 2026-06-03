export interface ProductAnalyticsEvent {
  id: string;
  userId: string;
  sessionId: string;
  eventName: string;
  screen?: string;
  surface?: string;
  action?: string;
  result?: string;
  objectType?: string;
  objectId?: string;
  latencyMs?: number;
  sequence?: number;
  appVersion?: string;
  buildType?: string;
  deviceClass?: string;
  osVersion?: string;
  networkStatus?: string;
  attributes: Record<string, string | number | boolean>;
  occurredAt: Date;
  receivedAt: Date;
}

export interface CreateProductAnalyticsEventInput {
  userId: string;
  sessionId: string;
  eventName: string;
  screen?: string;
  surface?: string;
  action?: string;
  result?: string;
  objectType?: string;
  objectId?: string;
  latencyMs?: number;
  sequence?: number;
  appVersion?: string;
  buildType?: string;
  deviceClass?: string;
  osVersion?: string;
  networkStatus?: string;
  attributes?: Record<string, string | number | boolean>;
  occurredAt?: Date;
}

export interface ProductAnalyticsEventRepository {
  createMany(events: CreateProductAnalyticsEventInput[]): Promise<ProductAnalyticsEvent[]>;
  listForUser(userId: string, limit?: number): Promise<ProductAnalyticsEvent[]>;
}
