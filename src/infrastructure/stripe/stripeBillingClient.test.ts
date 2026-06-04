import { describe, expect, it, vi } from "vitest";
import { StripeBillingClient } from "./stripeBillingClient.js";

describe("StripeBillingClient", () => {
  it("creates hosted setup sessions with a currency for current Stripe API versions", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "cs_test_123",
      url: "https://checkout.stripe.test/session"
    });
    const billing = new StripeBillingClient("sk_test_fake");
    (billing as unknown as { client: { checkout: { sessions: { create: typeof create } } } }).client = {
      checkout: {
        sessions: { create }
      }
    };

    const session = await billing.createSetupSession({
      customerId: "cus_123",
      userId: "user_123",
      successUrl: "https://app.example/billing/success",
      cancelUrl: "https://app.example/billing/cancel"
    });

    expect(session).toEqual({
      id: "cs_test_123",
      url: "https://checkout.stripe.test/session"
    });
    expect(create).toHaveBeenCalledWith({
      mode: "setup",
      customer: "cus_123",
      currency: "usd",
      success_url: "https://app.example/billing/success",
      cancel_url: "https://app.example/billing/cancel",
      metadata: {
        phone_agent_user_id: "user_123"
      }
    });
  });

  it("uses a stable idempotency key when creating the Personal subscription", async () => {
    const list = vi.fn().mockResolvedValue({ data: [] });
    const update = vi.fn().mockResolvedValue({});
    const create = vi.fn().mockResolvedValue({
      id: "sub_123",
      status: "active"
    });
    const billing = new StripeBillingClient("sk_test_fake");
    (billing as unknown as {
      client: {
        subscriptions: { list: typeof list; create: typeof create };
        customers: { update: typeof update };
      };
    }).client = {
      subscriptions: { list, create },
      customers: { update }
    };

    const subscription = await billing.ensurePayAsYouGoSubscription({
      customerId: "cus_123",
      userId: "user_123",
      paymentMethodId: "pm_123",
      prices: {
        personalMonthlyPriceId: "price_monthly",
        personalCallMinuteOveragePriceId: "price_overage"
      }
    });

    expect(subscription).toEqual({ id: "sub_123", status: "active" });
    expect(create).toHaveBeenCalledWith(
      {
        customer: "cus_123",
        default_payment_method: "pm_123",
        collection_method: "charge_automatically",
        payment_behavior: "allow_incomplete",
        items: [
          { price: "price_monthly", quantity: 1 },
          { price: "price_overage" }
        ],
        metadata: {
          phone_agent_user_id: "user_123",
          phone_agent_subscription_kind: "personal"
        }
      },
      {
        idempotencyKey: "phone-agent-personal-subscription-cus_123"
      }
    );
  });

  it("cancels the mirrored Personal subscription by id", async () => {
    const cancel = vi.fn().mockResolvedValue({
      id: "sub_123",
      status: "canceled"
    });
    const billing = new StripeBillingClient("sk_test_fake");
    (billing as unknown as {
      client: {
        subscriptions: { cancel: typeof cancel };
      };
    }).client = {
      subscriptions: { cancel }
    };

    const subscription = await billing.cancelSubscription({ subscriptionId: "sub_123" });

    expect(subscription).toEqual({ id: "sub_123", status: "canceled" });
    expect(cancel).toHaveBeenCalledWith("sub_123");
  });
});
