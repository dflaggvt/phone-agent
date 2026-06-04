import type { Firestore } from "@google-cloud/firestore";
import {
  createInvoiceMirror,
  type InvoiceMirror,
  type InvoiceMirrorRepository,
  type InvoiceMirrorStatus,
  type UpsertInvoiceMirrorInput
} from "../../domain/billing/invoiceMirror.js";
import { firestoreDate, removeUndefinedDeep } from "./firestoreClient.js";

const COLLECTION = "invoiceMirrors";

export class FirestoreInvoiceMirrorRepository implements InvoiceMirrorRepository {
  constructor(private readonly firestore: Firestore) {}

  async getByProviderInvoiceId(providerInvoiceId: string): Promise<InvoiceMirror | undefined> {
    const doc = await this.collection().doc(idFor(providerInvoiceId)).get();
    return doc.exists ? invoiceMirrorFromFirestore(doc.id, doc.data() ?? {}) : undefined;
  }

  async listForUser(userId: string, limit = 12): Promise<InvoiceMirror[]> {
    const snapshot = await this.collection()
      .where("userId", "==", userId)
      .limit(Math.min(limit, 50))
      .get();
    return snapshot.docs
      .map((doc) => invoiceMirrorFromFirestore(doc.id, doc.data()))
      .sort((a, b) => (b.providerCreatedAt ?? b.createdAt).getTime() - (a.providerCreatedAt ?? a.createdAt).getTime())
      .slice(0, limit);
  }

  async upsert(input: UpsertInvoiceMirrorInput): Promise<InvoiceMirror> {
    const existing = await this.getByProviderInvoiceId(input.providerInvoiceId);
    const now = new Date();
    const next = existing
      ? {
        ...existing,
        providerCustomerId: input.providerCustomerId,
        providerSubscriptionId: input.providerSubscriptionId ?? existing.providerSubscriptionId,
        status: input.status,
        amountDueCents: input.amountDueCents,
        amountPaidCents: input.amountPaidCents,
        currency: input.currency,
        hostedInvoiceUrl: input.hostedInvoiceUrl ?? existing.hostedInvoiceUrl,
        invoicePdfUrl: input.invoicePdfUrl ?? existing.invoicePdfUrl,
        providerCreatedAt: input.providerCreatedAt ?? existing.providerCreatedAt,
        paidAt: input.paidAt ?? existing.paidAt,
        failedAt: input.failedAt ?? existing.failedAt,
        updatedAt: now
      }
      : createInvoiceMirror(input, now);
    await this.collection().doc(next.id).set(removeUndefinedDeep(next));
    return next;
  }

  private collection() {
    return this.firestore.collection(COLLECTION);
  }
}

function invoiceMirrorFromFirestore(id: string, data: Record<string, unknown>): InvoiceMirror {
  return {
    id,
    userId: getString(data.userId) ?? "",
    provider: "stripe",
    providerInvoiceId: getString(data.providerInvoiceId) ?? id.replace(/^stripe_/, ""),
    providerCustomerId: getString(data.providerCustomerId) ?? "",
    providerSubscriptionId: getString(data.providerSubscriptionId),
    status: invoiceMirrorStatus(data.status),
    amountDueCents: getNumber(data.amountDueCents) ?? 0,
    amountPaidCents: getNumber(data.amountPaidCents) ?? 0,
    currency: getString(data.currency) ?? "usd",
    hostedInvoiceUrl: getString(data.hostedInvoiceUrl),
    invoicePdfUrl: getString(data.invoicePdfUrl),
    providerCreatedAt: firestoreDate(data.providerCreatedAt),
    paidAt: firestoreDate(data.paidAt),
    failedAt: firestoreDate(data.failedAt),
    createdAt: firestoreDate(data.createdAt) ?? new Date(0),
    updatedAt: firestoreDate(data.updatedAt) ?? new Date(0)
  };
}

function idFor(providerInvoiceId: string): string {
  return `stripe_${providerInvoiceId}`;
}

function invoiceMirrorStatus(value: unknown): InvoiceMirrorStatus {
  return value === "draft" ||
    value === "open" ||
    value === "paid" ||
    value === "uncollectible" ||
    value === "void" ||
    value === "failed"
    ? value
    : "unknown";
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}
