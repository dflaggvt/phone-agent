export type WebhookProcessingStatus = "processing" | "processed" | "failed";

export interface WebhookEventRecord {
  provider: string;
  eventId: string;
  eventType: string;
  status: WebhookProcessingStatus;
  attempts: number;
  firstSeenAt: Date;
  updatedAt: Date;
  processedAt?: Date;
  lastErrorCode?: string;
  lastErrorMessage?: string;
}

export interface StartWebhookProcessingInput {
  provider: string;
  eventId: string;
  eventType: string;
  now?: Date;
}

export interface WebhookProcessingClaim {
  event: WebhookEventRecord;
  shouldProcess: boolean;
}

export interface WebhookEventRepository {
  startProcessing(input: StartWebhookProcessingInput): Promise<WebhookProcessingClaim>;
  markProcessed(provider: string, eventId: string, processedAt?: Date): Promise<WebhookEventRecord | undefined>;
  markFailed(provider: string, eventId: string, error: WebhookProcessingError, failedAt?: Date): Promise<WebhookEventRecord | undefined>;
}

export interface WebhookProcessingError {
  code: string;
  message: string;
}

