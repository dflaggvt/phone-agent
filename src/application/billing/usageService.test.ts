import { describe, expect, it } from "vitest";
import { InMemoryBillingAccountRepository } from "../../infrastructure/persistence/inMemoryBillingAccountRepository.js";
import { InMemoryNotificationEventRepository } from "../../infrastructure/persistence/inMemoryNotificationEventRepository.js";
import { InMemoryUsageEventRepository } from "../../infrastructure/persistence/inMemoryUsageEventRepository.js";
import { InMemoryUserConfigRepository } from "../../infrastructure/persistence/inMemoryUserConfigRepository.js";
import { NotificationService } from "../notifications/notificationService.js";
import { UsageService } from "./usageService.js";

describe("UsageService", () => {
  it("rates call-minute overage separately from included minutes and estimated internal cost", async () => {
    const users = new InMemoryUserConfigRepository();
    const billingAccounts = new InMemoryBillingAccountRepository();
    const usageEvents = new InMemoryUsageEventRepository();
    const service = new UsageService({
      users,
      usage: usageEvents,
      billingAccounts,
      rateCard: {
        version: "test-v1",
        callMinuteOverageCents: 39,
        estimatedCallMinuteCostCents: 12,
        classificationRequestCostCents: 1
      }
    });

    await users.upsert({
      userId: "user_123",
      billing: {
        plan: "personal",
        monthlyIncludedMinutes: 50,
        monthlyClassificationLimit: 100,
        retellNumberProvisioningAllowed: true
      }
    });
    await billingAccounts.upsert({
      userId: "user_123",
      providerCustomerId: "cus_123",
      status: "active",
      monthlySpendingCapCents: 4000,
      currentPeriodSpendCents: 1900
    });

    await service.recordCallMinutes({ userId: "user_123", minutes: 55, sourceId: "call_123", provider: "voice" });

    await expect(service.currentUsageWithLimits("user_123")).resolves.toEqual(expect.objectContaining({
      usage: expect.objectContaining({
        callMinutes: 55,
        customerChargeCents: 195,
        internalCostCents: 660,
        marginCents: -465
      }),
      financials: expect.objectContaining({
        customerChargeCents: 195,
        internalCostCents: 660,
        ratingVersion: "test-v1"
      })
    }));
    await expect(billingAccounts.get("user_123")).resolves.toEqual(expect.objectContaining({
      currentPeriodSpendCents: 2095
    }));
  });

  it("does not apply local spend twice for duplicate usage records", async () => {
    const users = new InMemoryUserConfigRepository();
    const billingAccounts = new InMemoryBillingAccountRepository();
    const service = new UsageService({
      users,
      usage: new InMemoryUsageEventRepository(),
      billingAccounts,
      rateCard: {
        version: "test-v1",
        callMinuteOverageCents: 50,
        estimatedCallMinuteCostCents: 10,
        classificationRequestCostCents: 1
      }
    });

    await users.upsert({ userId: "user_123", billing: { plan: "personal", monthlyIncludedMinutes: 0, monthlyClassificationLimit: 100, retellNumberProvisioningAllowed: true } });
    await billingAccounts.upsert({ userId: "user_123", providerCustomerId: "cus_123", status: "active", monthlySpendingCapCents: 4000, currentPeriodSpendCents: 1900 });

    await service.recordCallMinutes({ userId: "user_123", minutes: 2, sourceId: "call_duplicate" });
    await service.recordCallMinutes({ userId: "user_123", minutes: 2, sourceId: "call_duplicate" });

    await expect(billingAccounts.get("user_123")).resolves.toEqual(expect.objectContaining({
      currentPeriodSpendCents: 2000
    }));
  });

  it("creates privacy-safe cap warning notifications when rated usage crosses a threshold", async () => {
    const users = new InMemoryUserConfigRepository();
    const billingAccounts = new InMemoryBillingAccountRepository();
    const notificationRepository = new InMemoryNotificationEventRepository();
    const notifications = new NotificationService({ notifications: notificationRepository });
    const service = new UsageService({
      users,
      usage: new InMemoryUsageEventRepository(),
      billingAccounts,
      notifications,
      rateCard: {
        version: "test-v1",
        callMinuteOverageCents: 100,
        estimatedCallMinuteCostCents: 20,
        classificationRequestCostCents: 1
      }
    });

    await users.upsert({ userId: "user_123", billing: { plan: "personal", monthlyIncludedMinutes: 0, monthlyClassificationLimit: 100, retellNumberProvisioningAllowed: true } });
    await billingAccounts.upsert({ userId: "user_123", providerCustomerId: "cus_123", status: "active", monthlySpendingCapCents: 2500, currentPeriodSpendCents: 1200 });

    await service.recordCallMinutes({ userId: "user_123", minutes: 3, sourceId: "call_warning" });

    await expect(notificationRepository.listForUser("user_123")).resolves.toEqual([
      expect.objectContaining({
        type: "billing_issue",
        title: "50% of spending cap used",
        body: "Your assistant is getting close to the monthly spending cap.",
        detailedBody: undefined
      })
    ]);
  });
});
