import type Stripe from "stripe";
import {
  billingStatusFor,
  type BillingAccount,
  type BillingAccountRepository,
  type BillingStatus,
  type PaymentMethodSummary
} from "../../domain/billing/billingAccount.js";
import type { UserConfigService } from "../users/userConfigService.js";
import type { NotificationService } from "../notifications/notificationService.js";
import type { BillingInvoiceSummary, BillingPriceConfig, BillingProviderClient } from "../../infrastructure/stripe/stripeBillingClient.js";
import { badRequest, forbidden } from "../../shared/httpErrors.js";
import type { WebhookEventRepository } from "../../domain/webhooks/webhookEvent.js";
import type { InvoiceMirrorRepository, InvoiceMirrorStatus } from "../../domain/billing/invoiceMirror.js";

export class BillingAccountService {
  constructor(
    private readonly dependencies: {
      billingAccounts: BillingAccountRepository;
      users: UserConfigService;
      provider: BillingProviderClient;
      webhookEvents: WebhookEventRepository;
      invoiceMirrors?: InvoiceMirrorRepository;
      notifications?: NotificationService;
      publicBaseUrl?: string;
      defaultSpendingCapCents: number;
      billingRequiredForProvisioning: boolean;
      prices: BillingPriceConfig;
    }
  ) {}

  async getOrCreateAccount(userId: string): Promise<BillingAccount> {
    const existing = await this.dependencies.billingAccounts.get(userId);
    if (existing) {
      return existing;
    }
    return this.dependencies.billingAccounts.upsert({
      userId,
      monthlySpendingCapCents: this.dependencies.defaultSpendingCapCents,
      status: "payment_required"
    });
  }

  async setSpendingLimit(userId: string, monthlySpendingCapCents: number): Promise<BillingAccount> {
    if (monthlySpendingCapCents < 500) {
      throw badRequest("spending_cap_too_low", "Monthly spending cap must be at least $5.");
    }
    const existing = await this.getOrCreateAccount(userId);
    const updated = await this.dependencies.billingAccounts.upsert({
      userId,
      monthlySpendingCapCents,
      status: billingStatusFor({ ...existing, monthlySpendingCapCents })
    });
    return this.activateIfReady(updated);
  }

  async createSetupSession(userId: string): Promise<{ account: BillingAccount; session: { id: string; url: string } }> {
    const account = await this.ensureProviderCustomer(userId);
    const baseUrl = this.publicBaseUrl();
    const session = await this.dependencies.provider.createSetupSession({
      customerId: requireProviderCustomerId(account),
      userId,
      successUrl: `${baseUrl}/billing/stripe/success`,
      cancelUrl: `${baseUrl}/billing/stripe/cancel`
    });
    return { account, session };
  }

  async createPortalSession(userId: string): Promise<{ url: string }> {
    const account = await this.ensureProviderCustomer(userId);
    return this.dependencies.provider.createPortalSession({
      customerId: requireProviderCustomerId(account),
      returnUrl: `${this.publicBaseUrl()}/billing`
    });
  }

  async listInvoices(userId: string): Promise<BillingInvoiceSummary[]> {
    const account = await this.getOrCreateAccount(userId);
    const mirrored = await this.dependencies.invoiceMirrors?.listForUser(userId, 12);
    if (mirrored && mirrored.length > 0) {
      return mirrored.map((invoice) => ({
        id: invoice.providerInvoiceId,
        status: invoice.status,
        amountDueCents: invoice.amountDueCents,
        amountPaidCents: invoice.amountPaidCents,
        currency: invoice.currency,
        hostedInvoiceUrl: invoice.hostedInvoiceUrl,
        invoicePdfUrl: invoice.invoicePdfUrl,
        createdAt: invoice.providerCreatedAt ?? invoice.createdAt
      }));
    }
    return this.dependencies.provider.listInvoices({
      customerId: requireProviderCustomerId(account),
      limit: 12
    });
  }

  async activateBilling(userId: string): Promise<BillingAccount> {
    const account = await this.getOrCreateAccount(userId);
    return this.activateIfReady(account);
  }

  async cancelSubscription(userId: string): Promise<BillingAccount> {
    const account = await this.getOrCreateAccount(userId);
    if (account.providerSubscriptionId && account.providerSubscriptionStatus !== "canceled") {
      await this.dependencies.provider.cancelSubscription({
        subscriptionId: account.providerSubscriptionId
      });
    }
      await this.dependencies.users.upsert({
        userId,
        billing: {
          assistantNumberProvisioningAllowed: false
        }
      });
    return this.dependencies.billingAccounts.upsert({
      userId,
      providerSubscriptionStatus: "canceled",
      status: "canceled"
    });
  }

  async handleStripeWebhook(rawBody: string, signature: string | string[] | undefined): Promise<{ handled: boolean; type: string }> {
    const event = this.dependencies.provider.constructWebhookEvent(rawBody, signature);
    const claim = await this.dependencies.webhookEvents.startProcessing({
      provider: "stripe",
      eventId: event.id,
      eventType: event.type
    });
    if (!claim.shouldProcess) {
      return { handled: false, type: event.type };
    }
    try {
      await this.applyStripeEvent(event);
      await this.dependencies.webhookEvents.markProcessed("stripe", event.id);
    } catch (error) {
      await this.dependencies.webhookEvents.markFailed("stripe", event.id, sanitizedWebhookError(error));
      throw error;
    }
    return { handled: true, type: event.type };
  }

  async assertPaidInfrastructureAllowed(userId: string): Promise<void> {
    await this.assertPaidActionAllowed(
      userId,
      "Add a payment method and spending cap before assigning an assistant number.",
      "Increase the monthly spending cap before assigning paid assistant resources."
    );
  }

  async assertPaidRuntimeAllowed(userId: string): Promise<void> {
    await this.assertPaidActionAllowed(
      userId,
      "Add a payment method and spending cap before your assistant can answer calls.",
      "Increase the monthly spending cap before your assistant can answer more calls."
    );
  }

  private async assertPaidActionAllowed(
    userId: string,
    inactiveMessage: string,
    capReachedMessage: string
  ): Promise<void> {
    if (!this.dependencies.billingRequiredForProvisioning) {
      return;
    }
    const account = await this.getOrCreateAccount(userId);
    const status = billingStatusFor(account);
    if (status !== "active") {
      await this.createBillingIssue(
        userId,
        "billing_payment_required",
        "Billing needs attention",
        "Add a payment method before your assistant can continue paid work."
      );
      throw forbidden("billing_payment_required", inactiveMessage);
    }
    if (account.currentPeriodSpendCents >= account.monthlySpendingCapCents) {
      await this.dependencies.billingAccounts.upsert({ userId, status: "cap_reached" });
      await this.createBillingIssue(
        userId,
        "billing_cap_reached",
        "Spending cap reached",
        "Increase your monthly cap before your assistant can continue paid work."
      );
      throw forbidden("billing_cap_reached", capReachedMessage);
    }
  }

  private async createBillingIssue(
    userId: string,
    code: "billing_payment_required" | "billing_cap_reached",
    title: string,
    body: string
  ): Promise<void> {
    await this.dependencies.notifications?.createBillingIssue({
      userId,
      code,
      title,
      body
    });
  }

  private async ensureProviderCustomer(userId: string): Promise<BillingAccount> {
    const existing = await this.getOrCreateAccount(userId);
    if (existing.providerCustomerId) {
      return existing;
    }
    const user = await this.dependencies.users.getOrCreate(userId);
    const providerCustomerId = await this.dependencies.provider.createCustomer({
      userId,
      email: user.auth.email,
      name: user.displayName,
      phone: user.auth.phoneNumber
    });
    return this.dependencies.billingAccounts.upsert({ userId, providerCustomerId });
  }

  private async applyStripeEvent(event: Stripe.Event): Promise<void> {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.phone_agent_user_id;
      const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
      const setupIntentId = typeof session.setup_intent === "string" ? session.setup_intent : session.setup_intent?.id;
      if (!userId || !customerId) {
        return;
      }
      const paymentMethod = setupIntentId
        ? await this.dependencies.provider.paymentMethodFromSetupIntent(setupIntentId)
        : undefined;
      await this.updatePaymentMethod(userId, customerId, paymentMethod);
      return;
    }

    if (event.type === "payment_method.attached") {
      const paymentMethod = event.data.object as Stripe.PaymentMethod;
      const customerId = typeof paymentMethod.customer === "string" ? paymentMethod.customer : paymentMethod.customer?.id;
      if (!customerId) {
        return;
      }
      const account = await this.dependencies.billingAccounts.getByProviderCustomerId(customerId);
      if (!account) {
        return;
      }
      await this.updatePaymentMethod(account.userId, customerId, await this.dependencies.provider.paymentMethodFromId(paymentMethod.id));
      return;
    }

    if (event.type === "invoice.payment_failed") {
      await this.updateStatusForCustomer(event.data.object as Stripe.Invoice, "past_due");
      return;
    }

    if (event.type === "invoice.paid") {
      await this.updateStatusForCustomer(event.data.object as Stripe.Invoice, "active");
      return;
    }

    if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
      await this.updateSubscription(event.data.object as Stripe.Subscription);
      return;
    }

    if (event.type === "customer.subscription.deleted") {
      await this.updateSubscription(event.data.object as Stripe.Subscription, "canceled");
    }
  }

  private async updatePaymentMethod(
    userId: string,
    providerCustomerId: string,
    paymentMethod: PaymentMethodSummary | undefined
  ): Promise<void> {
    const existing = await this.getOrCreateAccount(userId);
    const updated = await this.dependencies.billingAccounts.upsert({
      userId,
      providerCustomerId,
      paymentMethod,
      status: billingStatusFor({ ...existing, paymentMethod })
    });
    await this.activateIfReady(updated);
  }

  private async updateStatusForCustomer(invoice: Stripe.Invoice, status: "active" | "past_due"): Promise<void> {
    const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
    if (!customerId) {
      return;
    }
    const account = await this.dependencies.billingAccounts.getByProviderCustomerId(customerId);
    if (!account) {
      return;
    }
    await this.dependencies.billingAccounts.upsert({
      userId: account.userId,
      status,
      ...(status === "active" ? { currentPeriodSpendCents: Math.max(account.currentPeriodSpendCents, invoice.amount_paid ?? 0) } : {})
    });
    await this.mirrorInvoice(account.userId, invoice, status === "past_due" ? "failed" : undefined);
  }

  private async updateSubscription(subscription: Stripe.Subscription, forcedStatus?: "canceled"): Promise<void> {
    const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
    if (!customerId) {
      return;
    }
    const account = await this.dependencies.billingAccounts.getByProviderCustomerId(customerId);
    if (!account) {
      return;
    }
    const incomingStatus = forcedStatus ?? subscription.status;
    if (shouldIgnoreSubscriptionEvent(account, subscription.id, incomingStatus)) {
      return;
    }
    await this.dependencies.billingAccounts.upsert({
      userId: account.userId,
      providerSubscriptionId: subscription.id,
      providerSubscriptionStatus: incomingStatus,
      status: billingStatusFromSubscriptionStatus(incomingStatus, account)
    });
  }

  private async activateIfReady(account: BillingAccount): Promise<BillingAccount> {
    if (account.providerSubscriptionId && account.status === "active") {
      return account;
    }
    if (!account.providerCustomerId || !account.paymentMethod || account.monthlySpendingCapCents < 500) {
      return account;
    }
    const prices = requireConfiguredPrices(this.dependencies.prices);
    const subscription = await this.dependencies.provider.ensurePayAsYouGoSubscription({
      customerId: account.providerCustomerId,
      userId: account.userId,
      paymentMethodId: account.paymentMethod.providerPaymentMethodId,
      prices
    });
    return this.dependencies.billingAccounts.upsert({
      userId: account.userId,
      providerSubscriptionId: subscription.id,
      providerSubscriptionStatus: subscription.status,
      status: billingStatusFromSubscriptionStatus(subscription.status, account)
    });
  }

  private async mirrorInvoice(
    userId: string,
    invoice: Stripe.Invoice,
    forcedStatus?: InvoiceMirrorStatus
  ): Promise<void> {
    if (!this.dependencies.invoiceMirrors || !invoice.id) {
      return;
    }
    const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
    if (!customerId) {
      return;
    }
    const invoiceWithSubscription = invoice as Stripe.Invoice & {
      subscription?: string | { id?: string } | null;
    };
    const subscription = invoiceWithSubscription.subscription;
    const providerSubscriptionId = typeof subscription === "string" ? subscription : subscription?.id;
    const status = forcedStatus ?? invoiceMirrorStatus(invoice.status);
    await this.dependencies.invoiceMirrors.upsert({
      userId,
      providerInvoiceId: invoice.id,
      providerCustomerId: customerId,
      providerSubscriptionId,
      status,
      amountDueCents: invoice.amount_due ?? 0,
      amountPaidCents: invoice.amount_paid ?? 0,
      currency: invoice.currency ?? "usd",
      hostedInvoiceUrl: invoice.hosted_invoice_url ?? undefined,
      invoicePdfUrl: invoice.invoice_pdf ?? undefined,
      providerCreatedAt: invoice.created ? new Date(invoice.created * 1000) : undefined,
      paidAt: status === "paid" ? new Date() : undefined,
      failedAt: status === "failed" ? new Date() : undefined
    });
  }

  private publicBaseUrl(): string {
    if (!this.dependencies.publicBaseUrl) {
      throw badRequest("app_public_base_url_missing", "APP_PUBLIC_BASE_URL is required before creating billing sessions.");
    }
    return this.dependencies.publicBaseUrl.replace(/\/$/, "");
  }
}

function requireProviderCustomerId(account: BillingAccount): string {
  if (!account.providerCustomerId) {
    throw badRequest("billing_customer_missing", "Billing customer was not created.");
  }
  return account.providerCustomerId;
}

function requireConfiguredPrices(prices: BillingPriceConfig): Required<BillingPriceConfig> {
  if (!prices.personalMonthlyPriceId || !prices.personalCallMinuteOveragePriceId) {
    throw badRequest("stripe_prices_missing", "Stripe Personal plan price IDs are required before activating billing.");
  }
  return {
    personalMonthlyPriceId: prices.personalMonthlyPriceId,
    personalCallMinuteOveragePriceId: prices.personalCallMinuteOveragePriceId
  };
}

function billingStatusFromSubscriptionStatus(
  subscriptionStatus: string,
  account: Pick<BillingAccount, "paymentMethod" | "monthlySpendingCapCents" | "status">
): BillingStatus {
  if (subscriptionStatus === "active" || subscriptionStatus === "trialing") {
    return billingStatusFor(account);
  }
  if (subscriptionStatus === "past_due" || subscriptionStatus === "unpaid") {
    return "past_due";
  }
  if (subscriptionStatus === "canceled" || subscriptionStatus === "incomplete_expired") {
    return "canceled";
  }
  return "payment_method_added";
}

function shouldIgnoreSubscriptionEvent(account: BillingAccount, incomingSubscriptionId: string, incomingStatus: string): boolean {
  if (!account.providerSubscriptionId || account.providerSubscriptionId === incomingSubscriptionId) {
    return false;
  }
  if (incomingStatus === "canceled" || incomingStatus === "incomplete_expired") {
    return true;
  }
  return account.status === "active" && account.providerSubscriptionStatus === "active";
}

function invoiceMirrorStatus(status: Stripe.Invoice.Status | null): InvoiceMirrorStatus {
  if (
    status === "draft" ||
    status === "open" ||
    status === "paid" ||
    status === "uncollectible" ||
    status === "void"
  ) {
    return status;
  }
  return "unknown";
}

function sanitizedWebhookError(error: unknown) {
  const candidate = error as { code?: unknown; type?: unknown; statusCode?: unknown; message?: unknown };
  const code = typeof candidate?.code === "string"
    ? candidate.code
    : typeof candidate?.type === "string"
      ? candidate.type
      : typeof candidate?.statusCode === "number"
        ? `status_${candidate.statusCode}`
        : "webhook_processing_failed";
  const message = typeof candidate?.message === "string" && candidate.message.length > 0
    ? candidate.message.slice(0, 500)
    : "Webhook processing failed.";
  return { code, message };
}
