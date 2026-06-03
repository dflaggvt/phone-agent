import type { Firestore } from "@google-cloud/firestore";
import {
  billingStatusFor,
  createBillingAccount,
  type BillingAccount,
  type BillingAccountRepository,
  type BillingStatus,
  type PaymentMethodSummary,
  type UpsertBillingAccountInput
} from "../../domain/billing/billingAccount.js";
import { firestoreDate, removeUndefinedDeep } from "./firestoreClient.js";

const COLLECTION = "billingAccounts";

export class FirestoreBillingAccountRepository implements BillingAccountRepository {
  constructor(private readonly firestore: Firestore) {}

  async get(userId: string): Promise<BillingAccount | undefined> {
    const doc = await this.collection().doc(userId).get();
    return doc.exists ? billingAccountFromFirestore(doc.id, doc.data() ?? {}) : undefined;
  }

  async getByProviderCustomerId(providerCustomerId: string): Promise<BillingAccount | undefined> {
    const snapshot = await this.collection()
      .where("providerCustomerId", "==", providerCustomerId)
      .limit(1)
      .get();
    const doc = snapshot.docs[0];
    return doc ? billingAccountFromFirestore(doc.id, doc.data()) : undefined;
  }

  async upsert(input: UpsertBillingAccountInput): Promise<BillingAccount> {
    const existing = await this.get(input.userId);
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
    const normalized: BillingAccount = { ...next, status: input.status ?? billingStatusFor(next) };
    await this.collection().doc(normalized.userId).set(removeUndefinedDeep(normalized));
    return normalized;
  }

  private collection() {
    return this.firestore.collection(COLLECTION);
  }
}

function billingAccountFromFirestore(id: string, data: Record<string, unknown>): BillingAccount {
  const paymentMethod = paymentMethodFromFirestore(data.paymentMethod);
  return {
    userId: getString(data.userId) ?? id,
    provider: "stripe",
    providerCustomerId: getString(data.providerCustomerId),
    providerSubscriptionId: getString(data.providerSubscriptionId),
    providerSubscriptionStatus: getString(data.providerSubscriptionStatus),
    status: billingStatus(data.status),
    currency: "usd",
    monthlySpendingCapCents: getNumber(data.monthlySpendingCapCents) ?? 2500,
    currentPeriodSpendCents: getNumber(data.currentPeriodSpendCents) ?? 0,
    paymentMethod,
    createdAt: firestoreDate(data.createdAt) ?? new Date(0),
    updatedAt: firestoreDate(data.updatedAt) ?? new Date(0)
  };
}

function paymentMethodFromFirestore(value: unknown): PaymentMethodSummary | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const data = value as Record<string, unknown>;
  const providerPaymentMethodId = getString(data.providerPaymentMethodId);
  if (!providerPaymentMethodId) {
    return undefined;
  }
  return {
    provider: "stripe",
    providerPaymentMethodId,
    brand: getString(data.brand),
    last4: getString(data.last4),
    expMonth: getNumber(data.expMonth),
    expYear: getNumber(data.expYear),
    updatedAt: firestoreDate(data.updatedAt) ?? new Date(0)
  };
}

function billingStatus(value: unknown): BillingStatus {
  return value === "not_required" ||
    value === "payment_required" ||
    value === "payment_method_added" ||
    value === "active" ||
    value === "cap_reached" ||
    value === "past_due" ||
    value === "suspended" ||
    value === "canceled"
    ? value
    : "payment_required";
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}
