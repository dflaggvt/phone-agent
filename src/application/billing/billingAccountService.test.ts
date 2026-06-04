import type Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { InMemoryBillingAccountRepository } from "../../infrastructure/persistence/inMemoryBillingAccountRepository.js";
import { InMemoryInvoiceMirrorRepository } from "../../infrastructure/persistence/inMemoryInvoiceMirrorRepository.js";
import { InMemoryUserConfigRepository } from "../../infrastructure/persistence/inMemoryUserConfigRepository.js";
import { InMemoryWebhookEventRepository } from "../../infrastructure/persistence/inMemoryWebhookEventRepository.js";
import type {
  BillingProviderClient,
  BillingInvoiceSummary,
  BillingSetupSession,
  BillingPortalSession,
  BillingSubscription
} from "../../infrastructure/stripe/stripeBillingClient.js";
import type { PaymentMethodSummary } from "../../domain/billing/billingAccount.js";
import { UserConfigService } from "../users/userConfigService.js";
import { BillingAccountService } from "./billingAccountService.js";

describe("BillingAccountService", () => {
  it("ignores cancellation webhooks for duplicate subscriptions that are not the mirrored active subscription", async () => {
    const billingAccounts = new InMemoryBillingAccountRepository();
    const service = new BillingAccountService({
      billingAccounts,
      users: new UserConfigService({
        users: new InMemoryUserConfigRepository(),
        defaultConfig: { userId: "unused" }
      }),
      provider: new EventOnlyBillingProvider({
        id: "evt_canceled_duplicate",
        type: "customer.subscription.deleted",
        data: {
          object: {
            id: "sub_duplicate",
            status: "canceled",
            customer: "cus_123"
          }
        }
      } as Stripe.Event),
      webhookEvents: new InMemoryWebhookEventRepository(),
      defaultSpendingCapCents: 4000,
      billingRequiredForProvisioning: true,
      prices: {
        personalMonthlyPriceId: "price_monthly",
        personalCallMinuteOveragePriceId: "price_overage"
      }
    });

    await billingAccounts.upsert({
      userId: "user_123",
      providerCustomerId: "cus_123",
      providerSubscriptionId: "sub_active",
      providerSubscriptionStatus: "active",
      status: "active",
      monthlySpendingCapCents: 4000,
      paymentMethod: {
        provider: "stripe",
        providerPaymentMethodId: "pm_123",
        brand: "visa",
        last4: "4242",
        expMonth: 12,
        expYear: 2034,
        updatedAt: new Date()
      }
    });

    await service.handleStripeWebhook("{}", "signature");

    await expect(billingAccounts.get("user_123")).resolves.toEqual(expect.objectContaining({
      status: "active",
      providerSubscriptionId: "sub_active",
      providerSubscriptionStatus: "active"
    }));
  });

  it("does not reapply duplicate Stripe webhook events after successful processing", async () => {
    const billingAccounts = new InMemoryBillingAccountRepository();
    const provider = new EventOnlyBillingProvider({
      id: "evt_duplicate",
      type: "payment_method.attached",
      data: {
        object: {
          id: "pm_123",
          type: "card",
          customer: "cus_123",
          card: {
            brand: "visa",
            last4: "4242",
            exp_month: 12,
            exp_year: 2034
          }
        }
      }
    } as unknown as Stripe.Event);
    const service = new BillingAccountService({
      billingAccounts,
      users: new UserConfigService({
        users: new InMemoryUserConfigRepository(),
        defaultConfig: { userId: "unused" }
      }),
      provider,
      webhookEvents: new InMemoryWebhookEventRepository(),
      defaultSpendingCapCents: 4000,
      billingRequiredForProvisioning: true,
      prices: {
        personalMonthlyPriceId: "price_monthly",
        personalCallMinuteOveragePriceId: "price_overage"
      }
    });
    await billingAccounts.upsert({
      userId: "user_123",
      providerCustomerId: "cus_123",
      monthlySpendingCapCents: 4000,
      status: "payment_required"
    });

    await service.handleStripeWebhook("{}", "signature");
    const duplicate = await service.handleStripeWebhook("{}", "signature");

    expect(duplicate).toEqual({ handled: false, type: "payment_method.attached" });
    expect(provider.paymentMethodLookupCount).toBe(1);
    await expect(billingAccounts.get("user_123")).resolves.toEqual(expect.objectContaining({
      status: "active",
      paymentMethod: expect.objectContaining({
        providerPaymentMethodId: "pm_123",
        last4: "4242"
      })
    }));
  });

  it("mirrors paid invoice amount into current period spend", async () => {
    const billingAccounts = new InMemoryBillingAccountRepository();
    const invoiceMirrors = new InMemoryInvoiceMirrorRepository();
    const service = new BillingAccountService({
      billingAccounts,
      users: new UserConfigService({
        users: new InMemoryUserConfigRepository(),
        defaultConfig: { userId: "unused" }
      }),
      provider: new EventOnlyBillingProvider({
        id: "evt_invoice_paid",
        type: "invoice.paid",
        data: {
          object: {
            id: "in_123",
            customer: "cus_123",
            amount_due: 1900,
            amount_paid: 1900,
            currency: "usd",
            status: "paid",
            created: 1_715_000_000
          }
        }
      } as unknown as Stripe.Event),
      webhookEvents: new InMemoryWebhookEventRepository(),
      invoiceMirrors,
      defaultSpendingCapCents: 4000,
      billingRequiredForProvisioning: true,
      prices: {
        personalMonthlyPriceId: "price_monthly",
        personalCallMinuteOveragePriceId: "price_overage"
      }
    });
    await billingAccounts.upsert({
      userId: "user_123",
      providerCustomerId: "cus_123",
      providerSubscriptionId: "sub_123",
      providerSubscriptionStatus: "active",
      status: "active",
      monthlySpendingCapCents: 4000,
      currentPeriodSpendCents: 0,
      paymentMethod: {
        provider: "stripe",
        providerPaymentMethodId: "pm_123",
        updatedAt: new Date()
      }
    });

    await service.handleStripeWebhook("{}", "signature");

    await expect(billingAccounts.get("user_123")).resolves.toEqual(expect.objectContaining({
      status: "active",
      currentPeriodSpendCents: 1900
    }));
    await expect(invoiceMirrors.getByProviderInvoiceId("in_123")).resolves.toEqual(expect.objectContaining({
      userId: "user_123",
      status: "paid",
      amountDueCents: 1900,
      amountPaidCents: 1900,
      currency: "usd"
    }));
  });

  it("blocks paid infrastructure when the monthly spending cap is reached", async () => {
    const billingAccounts = new InMemoryBillingAccountRepository();
    const service = new BillingAccountService({
      billingAccounts,
      users: new UserConfigService({
        users: new InMemoryUserConfigRepository(),
        defaultConfig: { userId: "unused" }
      }),
      provider: new EventOnlyBillingProvider({ id: "evt_unused", type: "noop", data: { object: {} } } as unknown as Stripe.Event),
      webhookEvents: new InMemoryWebhookEventRepository(),
      defaultSpendingCapCents: 4000,
      billingRequiredForProvisioning: true,
      prices: {
        personalMonthlyPriceId: "price_monthly",
        personalCallMinuteOveragePriceId: "price_overage"
      }
    });
    await billingAccounts.upsert({
      userId: "user_123",
      providerCustomerId: "cus_123",
      providerSubscriptionId: "sub_123",
      providerSubscriptionStatus: "active",
      status: "active",
      monthlySpendingCapCents: 2500,
      currentPeriodSpendCents: 2500,
      paymentMethod: {
        provider: "stripe",
        providerPaymentMethodId: "pm_123",
        updatedAt: new Date()
      }
    });

    await expect(service.assertPaidInfrastructureAllowed("user_123")).rejects.toMatchObject({
      statusCode: 403,
      code: "billing_cap_reached"
    });
    await expect(billingAccounts.get("user_123")).resolves.toEqual(expect.objectContaining({
      status: "cap_reached"
    }));
  });
});

class EventOnlyBillingProvider implements BillingProviderClient {
  paymentMethodLookupCount = 0;

  constructor(private readonly event: Stripe.Event) {}

  constructWebhookEvent(): Stripe.Event {
    return this.event;
  }

  async createCustomer(): Promise<string> {
    throw new Error("not implemented");
  }

  async createSetupSession(): Promise<BillingSetupSession> {
    throw new Error("not implemented");
  }

  async createPortalSession(): Promise<BillingPortalSession> {
    throw new Error("not implemented");
  }

  async listInvoices(): Promise<BillingInvoiceSummary[]> {
    return [];
  }

  async paymentMethodFromSetupIntent(): Promise<PaymentMethodSummary | undefined> {
    throw new Error("not implemented");
  }

  async paymentMethodFromId(): Promise<PaymentMethodSummary | undefined> {
    this.paymentMethodLookupCount += 1;
    return {
      provider: "stripe",
      providerPaymentMethodId: "pm_123",
      brand: "visa",
      last4: "4242",
      expMonth: 12,
      expYear: 2034,
      updatedAt: new Date()
    };
  }

  async ensurePayAsYouGoSubscription(): Promise<BillingSubscription> {
    return { id: "sub_123", status: "active" };
  }

  async publishMeterEvent(): Promise<{ identifier: string }> {
    throw new Error("not implemented");
  }
}
