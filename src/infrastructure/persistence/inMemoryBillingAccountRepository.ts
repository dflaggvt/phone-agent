import {
  billingStatusFor,
  createBillingAccount,
  type BillingAccount,
  type BillingAccountRepository,
  type UpsertBillingAccountInput
} from "../../domain/billing/billingAccount.js";

export class InMemoryBillingAccountRepository implements BillingAccountRepository {
  private readonly accounts = new Map<string, BillingAccount>();

  async get(userId: string): Promise<BillingAccount | undefined> {
    return this.accounts.get(userId);
  }

  async getByProviderCustomerId(providerCustomerId: string): Promise<BillingAccount | undefined> {
    return [...this.accounts.values()].find((account) => account.providerCustomerId === providerCustomerId);
  }

  async upsert(input: UpsertBillingAccountInput): Promise<BillingAccount> {
    const existing = this.accounts.get(input.userId);
    const now = new Date();
    const next = existing
      ? {
        ...existing,
        providerCustomerId: input.providerCustomerId ?? existing.providerCustomerId,
        providerSubscriptionId: input.providerSubscriptionId ?? existing.providerSubscriptionId,
        providerSubscriptionStatus: input.providerSubscriptionStatus ?? existing.providerSubscriptionStatus,
        monthlySpendingCapCents: input.monthlySpendingCapCents ?? existing.monthlySpendingCapCents,
        currentPeriodSpendCents: input.currentPeriodSpendCents ?? existing.currentPeriodSpendCents,
        paymentMethod: input.paymentMethod ?? existing.paymentMethod,
        status: input.status ?? existing.status,
        updatedAt: now
      }
      : createBillingAccount({ ...input, now });
    const normalized = { ...next, status: input.status ?? billingStatusFor(next) };
    this.accounts.set(normalized.userId, normalized);
    return normalized;
  }

  async incrementCurrentPeriodSpend(userId: string, amountCents: number): Promise<BillingAccount | undefined> {
    const existing = this.accounts.get(userId);
    if (!existing) {
      return undefined;
    }
    const updated: BillingAccount = {
      ...existing,
      currentPeriodSpendCents: Math.max(0, existing.currentPeriodSpendCents + amountCents),
      updatedAt: new Date()
    };
    this.accounts.set(userId, updated);
    return updated;
  }
}
