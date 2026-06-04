import Stripe from "stripe";
import type { PaymentMethodSummary } from "../../domain/billing/billingAccount.js";
import { badRequest } from "../../shared/httpErrors.js";

export interface BillingSetupSession {
  id: string;
  url: string;
}

export interface BillingPortalSession {
  url: string;
}

export interface BillingSubscription {
  id: string;
  status: string;
}

export interface BillingInvoiceSummary {
  id: string;
  status?: string;
  amountDueCents: number;
  amountPaidCents: number;
  currency: string;
  hostedInvoiceUrl?: string;
  invoicePdfUrl?: string;
  createdAt: Date;
}

export interface BillingPriceConfig {
  personalMonthlyPriceId?: string;
  personalCallMinuteOveragePriceId?: string;
}

export interface BillingProviderClient {
  createCustomer(input: {
    userId: string;
    email?: string;
    name?: string;
    phone?: string;
  }): Promise<string>;
  createSetupSession(input: {
    customerId: string;
    userId: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<BillingSetupSession>;
  createPortalSession(input: {
    customerId: string;
    returnUrl: string;
  }): Promise<BillingPortalSession>;
  listInvoices(input: { customerId: string; limit?: number }): Promise<BillingInvoiceSummary[]>;
  constructWebhookEvent(rawBody: string, signature: string | string[] | undefined): Stripe.Event;
  paymentMethodFromSetupIntent(setupIntentId: string): Promise<PaymentMethodSummary | undefined>;
  paymentMethodFromId(paymentMethodId: string): Promise<PaymentMethodSummary | undefined>;
  ensurePayAsYouGoSubscription(input: {
    customerId: string;
    userId: string;
    paymentMethodId: string;
    prices: Required<BillingPriceConfig>;
  }): Promise<BillingSubscription>;
  cancelSubscription(input: {
    subscriptionId: string;
  }): Promise<BillingSubscription>;
  publishMeterEvent(input: {
    customerId: string;
    eventName: string;
    value: number;
    identifier: string;
    timestamp: Date;
  }): Promise<{ identifier: string }>;
}

export class StripeBillingClient implements BillingProviderClient {
  private readonly client: Stripe;

  constructor(
    secretKey: string,
    private readonly webhookSecret?: string
  ) {
    this.client = new Stripe(secretKey);
  }

  async createCustomer(input: {
    userId: string;
    email?: string;
    name?: string;
    phone?: string;
  }): Promise<string> {
    const customer = await this.client.customers.create({
      email: input.email,
      name: input.name,
      phone: input.phone,
      metadata: {
        phone_agent_user_id: input.userId
      }
    });
    return customer.id;
  }

  async createSetupSession(input: {
    customerId: string;
    userId: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<BillingSetupSession> {
    const session = await this.client.checkout.sessions.create({
      mode: "setup",
      customer: input.customerId,
      currency: "usd",
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      metadata: {
        phone_agent_user_id: input.userId
      }
    });
    if (!session.url) {
      throw badRequest("stripe_checkout_url_missing", "Stripe did not return a checkout URL.");
    }
    return { id: session.id, url: session.url };
  }

  async createPortalSession(input: {
    customerId: string;
    returnUrl: string;
  }): Promise<BillingPortalSession> {
    const session = await this.client.billingPortal.sessions.create({
      customer: input.customerId,
      return_url: input.returnUrl
    });
    return { url: session.url };
  }

  async listInvoices(input: { customerId: string; limit?: number }): Promise<BillingInvoiceSummary[]> {
    const invoices = await this.client.invoices.list({
      customer: input.customerId,
      limit: input.limit ?? 12
    });
    return invoices.data.map((invoice) => ({
      id: invoice.id,
      status: invoice.status ?? undefined,
      amountDueCents: invoice.amount_due,
      amountPaidCents: invoice.amount_paid,
      currency: invoice.currency,
      hostedInvoiceUrl: invoice.hosted_invoice_url ?? undefined,
      invoicePdfUrl: invoice.invoice_pdf ?? undefined,
      createdAt: new Date(invoice.created * 1000)
    }));
  }

  constructWebhookEvent(rawBody: string, signature: string | string[] | undefined): Stripe.Event {
    if (!this.webhookSecret) {
      throw badRequest("stripe_webhook_secret_missing", "STRIPE_WEBHOOK_SECRET is required before Stripe webhooks can be processed.");
    }
    const signatureValue = Array.isArray(signature) ? signature[0] : signature;
    if (!signatureValue) {
      throw badRequest("stripe_signature_missing", "Stripe signature header is required.");
    }
    return this.client.webhooks.constructEvent(rawBody, signatureValue, this.webhookSecret);
  }

  async paymentMethodFromSetupIntent(setupIntentId: string): Promise<PaymentMethodSummary | undefined> {
    const setupIntent = await this.client.setupIntents.retrieve(setupIntentId, {
      expand: ["payment_method"]
    });
    const paymentMethod = typeof setupIntent.payment_method === "string"
      ? await this.client.paymentMethods.retrieve(setupIntent.payment_method)
      : setupIntent.payment_method;
    return paymentMethod ? paymentMethodSummary(paymentMethod) : undefined;
  }

  async paymentMethodFromId(paymentMethodId: string): Promise<PaymentMethodSummary | undefined> {
    const paymentMethod = await this.client.paymentMethods.retrieve(paymentMethodId);
    return paymentMethodSummary(paymentMethod);
  }

  async ensurePayAsYouGoSubscription(input: {
    customerId: string;
    userId: string;
    paymentMethodId: string;
    prices: Required<BillingPriceConfig>;
  }): Promise<BillingSubscription> {
    const existing = await this.findPersonalSubscription(input.customerId);
    if (existing) {
      return { id: existing.id, status: existing.status };
    }

    await this.client.customers.update(input.customerId, {
      invoice_settings: {
        default_payment_method: input.paymentMethodId
      }
    });

    const subscription = await this.client.subscriptions.create(
      {
        customer: input.customerId,
        default_payment_method: input.paymentMethodId,
        collection_method: "charge_automatically",
        payment_behavior: "allow_incomplete",
        items: [
          { price: input.prices.personalMonthlyPriceId, quantity: 1 },
          { price: input.prices.personalCallMinuteOveragePriceId }
        ],
        metadata: {
          phone_agent_user_id: input.userId,
          phone_agent_subscription_kind: "personal"
        }
      },
      {
        idempotencyKey: `phone-agent-personal-subscription-${input.customerId}`
      }
    );

    return { id: subscription.id, status: subscription.status };
  }

  async cancelSubscription(input: { subscriptionId: string }): Promise<BillingSubscription> {
    const subscription = await this.client.subscriptions.cancel(input.subscriptionId);
    return { id: subscription.id, status: subscription.status };
  }

  async publishMeterEvent(input: {
    customerId: string;
    eventName: string;
    value: number;
    identifier: string;
    timestamp: Date;
  }): Promise<{ identifier: string }> {
    const event = await this.client.billing.meterEvents.create({
      event_name: input.eventName,
      identifier: input.identifier,
      timestamp: Math.floor(input.timestamp.getTime() / 1000),
      payload: {
        stripe_customer_id: input.customerId,
        value: String(input.value)
      }
    });
    return { identifier: event.identifier };
  }

  private async findPersonalSubscription(customerId: string): Promise<Stripe.Subscription | undefined> {
    const subscriptions = await this.client.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 100
    });
    return subscriptions.data.find((subscription) =>
      subscription.metadata?.phone_agent_subscription_kind === "personal" &&
      subscription.status !== "canceled" &&
      subscription.status !== "incomplete_expired"
    );
  }
}

export class MissingBillingProviderClient implements BillingProviderClient {
  async createCustomer(): Promise<string> {
    throw badRequest("stripe_not_configured", "Stripe is not configured.");
  }

  async createSetupSession(): Promise<BillingSetupSession> {
    throw badRequest("stripe_not_configured", "Stripe is not configured.");
  }

  async createPortalSession(): Promise<BillingPortalSession> {
    throw badRequest("stripe_not_configured", "Stripe is not configured.");
  }

  async listInvoices(): Promise<BillingInvoiceSummary[]> {
    throw badRequest("stripe_not_configured", "Stripe is not configured.");
  }

  constructWebhookEvent(): Stripe.Event {
    throw badRequest("stripe_not_configured", "Stripe is not configured.");
  }

  async paymentMethodFromSetupIntent(): Promise<PaymentMethodSummary | undefined> {
    throw badRequest("stripe_not_configured", "Stripe is not configured.");
  }

  async paymentMethodFromId(): Promise<PaymentMethodSummary | undefined> {
    throw badRequest("stripe_not_configured", "Stripe is not configured.");
  }

  async ensurePayAsYouGoSubscription(): Promise<BillingSubscription> {
    throw badRequest("stripe_not_configured", "Stripe is not configured.");
  }

  async cancelSubscription(): Promise<BillingSubscription> {
    throw badRequest("stripe_not_configured", "Stripe is not configured.");
  }

  async publishMeterEvent(): Promise<{ identifier: string }> {
    throw badRequest("stripe_not_configured", "Stripe is not configured.");
  }
}

function paymentMethodSummary(paymentMethod: Stripe.PaymentMethod): PaymentMethodSummary | undefined {
  if (paymentMethod.type !== "card" || !paymentMethod.card) {
    return undefined;
  }
  return {
    provider: "stripe",
    providerPaymentMethodId: paymentMethod.id,
    brand: paymentMethod.card.brand,
    last4: paymentMethod.card.last4,
    expMonth: paymentMethod.card.exp_month,
    expYear: paymentMethod.card.exp_year,
    updatedAt: new Date()
  };
}
