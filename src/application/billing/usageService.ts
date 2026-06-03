import type { BillingAccountRepository } from "../../domain/billing/billingAccount.js";
import type { UsageEvent, UsageEventRepository } from "../../domain/billing/usage.js";
import type { UserConfigRepository } from "../../domain/users/userConfig.js";
import type { BillingProviderClient } from "../../infrastructure/stripe/stripeBillingClient.js";
import type { AppLogger } from "../../shared/logger.js";

export class UsageService {
  constructor(
    private readonly dependencies: {
      usage: UsageEventRepository;
      users: UserConfigRepository;
      billingAccounts?: BillingAccountRepository;
      billingProvider?: BillingProviderClient;
      logger?: AppLogger;
    }
  ) {}

  async recordCallMinutes(input: { userId: string; minutes: number; sourceId?: string; provider?: string }): Promise<void> {
    if (input.minutes <= 0) {
      return;
    }
    const event = await this.dependencies.usage.create({
      userId: input.userId,
      type: "call_minute",
      quantity: input.minutes,
      sourceId: input.sourceId,
      idempotencyKey: ["call_minute", input.userId, input.sourceId ?? "unknown"].join(":"),
      provider: input.provider
    });
    await this.publishIfReady(event);
  }

  async canClassify(userId: string): Promise<boolean> {
    const [config, summary] = await Promise.all([
      this.dependencies.users.get(userId),
      this.currentSummary(userId)
    ]);
    const limit = config?.billing.monthlyClassificationLimit ?? 0;
    return limit === 0 ? false : summary.classificationRequests < limit;
  }

  async recordClassification(input: { userId: string; sourceId?: string; provider?: string }): Promise<void> {
    const event = await this.dependencies.usage.create({
      userId: input.userId,
      type: "openai_classification",
      quantity: 1,
      sourceId: input.sourceId,
      idempotencyKey: ["openai_classification", input.userId, input.sourceId ?? "unknown"].join(":"),
      provider: input.provider
    });
    await this.publishIfReady(event);
  }

  async currentUsageWithLimits(userId: string) {
    const [config, summary] = await Promise.all([
      this.dependencies.users.get(userId),
      this.currentSummary(userId)
    ]);
    return {
      usage: summary,
      limits: {
        plan: config?.billing.plan ?? "unknown",
        monthlyIncludedMinutes: config?.billing.monthlyIncludedMinutes ?? 0,
        monthlyClassificationLimit: config?.billing.monthlyClassificationLimit ?? 0
      },
      status: {
        callMinutesExceeded: config ? summary.callMinutes >= config.billing.monthlyIncludedMinutes : false,
        classificationLimitExceeded: config ? summary.classificationRequests >= config.billing.monthlyClassificationLimit : false
      }
    };
  }

  private currentSummary(userId: string) {
    const now = new Date();
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    return this.dependencies.usage.summarizeForUser(userId, periodStart, periodEnd);
  }

  private async publishIfReady(event: UsageEvent): Promise<void> {
    if (event.billingPublishedAt || event.quantity <= 0) {
      return;
    }
    const meter = billingMeterFor(event.type);
    if (!meter || !this.dependencies.billingAccounts || !this.dependencies.billingProvider) {
      return;
    }
    try {
      const account = await this.dependencies.billingAccounts.get(event.userId);
      if (!account?.providerCustomerId || account.status !== "active") {
        return;
      }
      const published = await this.dependencies.billingProvider.publishMeterEvent({
        customerId: account.providerCustomerId,
        eventName: meter,
        value: event.quantity,
        identifier: event.idempotencyKey,
        timestamp: event.occurredAt
      });
      await this.dependencies.usage.markBillingPublished(event.id, published.identifier);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown billing publish error.";
      await this.dependencies.usage.markBillingPublishFailed(event.id, message);
      this.dependencies.logger?.warn({ usageEventId: event.id, type: event.type }, "billing meter publish failed");
    }
  }
}

function billingMeterFor(type: UsageEvent["type"]): string | undefined {
  if (type === "call_minute") {
    return "phone_agent_call_minutes";
  }
  if (type === "openai_classification") {
    return undefined;
  }
  return undefined;
}
