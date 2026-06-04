import type { BillingAccount, BillingAccountRepository } from "../../domain/billing/billingAccount.js";
import type { UsageEvent, UsageEventRepository } from "../../domain/billing/usage.js";
import type { UserConfigRepository } from "../../domain/users/userConfig.js";
import type { BillingProviderClient } from "../../infrastructure/stripe/stripeBillingClient.js";
import type { AppLogger } from "../../shared/logger.js";
import type { NotificationService } from "../notifications/notificationService.js";

export interface UsageRateCard {
  version: string;
  callMinuteOverageCents: number;
  estimatedCallMinuteCostCents: number;
  classificationRequestCostCents: number;
}

export class UsageService {
  private readonly rateCard: UsageRateCard;
  private readonly capWarningThresholds: number[];

  constructor(
    private readonly dependencies: {
      usage: UsageEventRepository;
      users: UserConfigRepository;
      billingAccounts?: BillingAccountRepository;
      billingProvider?: BillingProviderClient;
      notifications?: NotificationService;
      logger?: AppLogger;
      rateCard?: Partial<UsageRateCard>;
      capWarningThresholds?: number[];
    }
  ) {
    this.rateCard = {
      version: dependencies.rateCard?.version ?? "personal-v1",
      callMinuteOverageCents: dependencies.rateCard?.callMinuteOverageCents ?? 39,
      estimatedCallMinuteCostCents: dependencies.rateCard?.estimatedCallMinuteCostCents ?? 12,
      classificationRequestCostCents: dependencies.rateCard?.classificationRequestCostCents ?? 1
    };
    this.capWarningThresholds = dependencies.capWarningThresholds ?? [0.5, 0.8];
  }

  async recordCallMinutes(input: { userId: string; minutes: number; sourceId?: string; provider?: string }): Promise<void> {
    if (input.minutes <= 0) {
      return;
    }
    const [config, summary] = await Promise.all([
      this.dependencies.users.get(input.userId),
      this.currentSummary(input.userId)
    ]);
    const includedMinutes = config?.billing.monthlyIncludedMinutes ?? 0;
    const includedMinutesRemaining = Math.max(0, includedMinutes - summary.callMinutes);
    const overageMinutes = Math.max(0, input.minutes - includedMinutesRemaining);
    const event = await this.dependencies.usage.create({
      userId: input.userId,
      type: "call_minute",
      quantity: input.minutes,
      sourceId: input.sourceId,
      idempotencyKey: ["call_minute", input.userId, input.sourceId ?? "unknown"].join(":"),
      provider: input.provider,
      customerChargeCents: cents(overageMinutes * this.rateCard.callMinuteOverageCents),
      internalCostCents: cents(input.minutes * this.rateCard.estimatedCallMinuteCostCents),
      ratingVersion: this.rateCard.version
    });
    await this.applyLocalSpend(event);
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
      provider: input.provider,
      customerChargeCents: 0,
      internalCostCents: this.rateCard.classificationRequestCostCents,
      ratingVersion: this.rateCard.version
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
      },
      financials: {
        customerChargeCents: summary.customerChargeCents,
        internalCostCents: summary.internalCostCents,
        marginCents: summary.marginCents,
        grossMarginPercentage: summary.grossMarginPercentage,
        ratingVersion: this.rateCard.version
      }
    };
  }

  private currentSummary(userId: string) {
    const now = new Date();
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    return this.dependencies.usage.summarizeForUser(userId, periodStart, periodEnd);
  }

  private async applyLocalSpend(event: UsageEvent): Promise<void> {
    if (!this.dependencies.billingAccounts || !event.customerChargeCents || event.customerChargeCents <= 0) {
      return;
    }
    const claimed = await this.dependencies.usage.claimLocalSpendApplication(event.id);
    if (!claimed) {
      return;
    }
    const accountBefore = await this.dependencies.billingAccounts.get(event.userId);
    const accountAfter = await this.dependencies.billingAccounts.incrementCurrentPeriodSpend(
      event.userId,
      event.customerChargeCents
    );
    if (!accountBefore || !accountAfter) {
      this.dependencies.logger?.warn({ usageEventId: event.id, userId: event.userId }, "rated usage could not update billing account spend");
      return;
    }
    await this.createCapWarnings(accountBefore, accountAfter);
  }

  private async createCapWarnings(before: BillingAccount, after: BillingAccount): Promise<void> {
    if (!this.dependencies.notifications || after.monthlySpendingCapCents <= 0) {
      return;
    }
    const beforeRatio = before.currentPeriodSpendCents / before.monthlySpendingCapCents;
    const afterRatio = after.currentPeriodSpendCents / after.monthlySpendingCapCents;

    for (const threshold of this.capWarningThresholds) {
      if (beforeRatio < threshold && afterRatio >= threshold && afterRatio < 1) {
        const percentage = Math.round(threshold * 100);
        await this.dependencies.notifications.createBillingIssue({
          userId: after.userId,
          code: `billing_cap_warning_${percentage}`,
          title: `${percentage}% of spending cap used`,
          body: "Your assistant is getting close to the monthly spending cap."
        });
      }
    }

    if (beforeRatio < 1 && afterRatio >= 1) {
      await this.dependencies.billingAccounts?.upsert({ userId: after.userId, status: "cap_reached" });
      await this.dependencies.notifications.createBillingIssue({
        userId: after.userId,
        code: "billing_cap_reached",
        title: "Spending cap reached",
        body: "Increase your monthly cap before your assistant can continue paid work."
      });
    }
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

function cents(value: number): number {
  return Math.round(value);
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
