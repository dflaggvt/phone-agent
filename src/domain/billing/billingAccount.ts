export type BillingStatus =
  | "not_required"
  | "payment_required"
  | "payment_method_added"
  | "active"
  | "cap_reached"
  | "past_due"
  | "suspended"
  | "canceled";

export interface PaymentMethodSummary {
  provider: "stripe";
  providerPaymentMethodId: string;
  brand?: string;
  last4?: string;
  expMonth?: number;
  expYear?: number;
  updatedAt: Date;
}

export interface BillingAccount {
  userId: string;
  provider: "stripe";
  providerCustomerId?: string;
  providerSubscriptionId?: string;
  providerSubscriptionStatus?: string;
  status: BillingStatus;
  currency: "usd";
  monthlySpendingCapCents: number;
  currentPeriodSpendCents: number;
  paymentMethod?: PaymentMethodSummary;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertBillingAccountInput {
  userId: string;
  providerCustomerId?: string;
  providerSubscriptionId?: string;
  providerSubscriptionStatus?: string;
  status?: BillingStatus;
  monthlySpendingCapCents?: number;
  currentPeriodSpendCents?: number;
  paymentMethod?: PaymentMethodSummary;
}

export interface BillingAccountRepository {
  get(userId: string): Promise<BillingAccount | undefined>;
  getByProviderCustomerId(providerCustomerId: string): Promise<BillingAccount | undefined>;
  upsert(input: UpsertBillingAccountInput): Promise<BillingAccount>;
  incrementCurrentPeriodSpend(userId: string, amountCents: number): Promise<BillingAccount | undefined>;
}

export function createBillingAccount(input: UpsertBillingAccountInput & { now?: Date }): BillingAccount {
  const now = input.now ?? new Date();
  return {
    userId: input.userId,
    provider: "stripe",
    providerCustomerId: input.providerCustomerId,
    providerSubscriptionId: input.providerSubscriptionId,
    providerSubscriptionStatus: input.providerSubscriptionStatus,
    status: input.status ?? "payment_required",
    currency: "usd",
    monthlySpendingCapCents: input.monthlySpendingCapCents ?? 2500,
    currentPeriodSpendCents: input.currentPeriodSpendCents ?? 0,
    paymentMethod: input.paymentMethod,
    createdAt: now,
    updatedAt: now
  };
}

export function billingStatusFor(account: Pick<BillingAccount, "paymentMethod" | "monthlySpendingCapCents" | "status">): BillingStatus {
  if (account.status === "past_due" || account.status === "suspended" || account.status === "canceled" || account.status === "cap_reached") {
    return account.status;
  }
  if (!account.paymentMethod) {
    return "payment_required";
  }
  if (account.monthlySpendingCapCents <= 0) {
    return "payment_method_added";
  }
  return "active";
}
