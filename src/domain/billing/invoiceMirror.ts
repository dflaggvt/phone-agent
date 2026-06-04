export type InvoiceMirrorStatus =
  | "draft"
  | "open"
  | "paid"
  | "uncollectible"
  | "void"
  | "failed"
  | "unknown";

export interface InvoiceMirror {
  id: string;
  userId: string;
  provider: "stripe";
  providerInvoiceId: string;
  providerCustomerId: string;
  providerSubscriptionId?: string;
  status: InvoiceMirrorStatus;
  amountDueCents: number;
  amountPaidCents: number;
  currency: string;
  hostedInvoiceUrl?: string;
  invoicePdfUrl?: string;
  providerCreatedAt?: Date;
  paidAt?: Date;
  failedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertInvoiceMirrorInput {
  userId: string;
  providerInvoiceId: string;
  providerCustomerId: string;
  providerSubscriptionId?: string;
  status: InvoiceMirrorStatus;
  amountDueCents: number;
  amountPaidCents: number;
  currency: string;
  hostedInvoiceUrl?: string;
  invoicePdfUrl?: string;
  providerCreatedAt?: Date;
  paidAt?: Date;
  failedAt?: Date;
}

export interface InvoiceMirrorRepository {
  getByProviderInvoiceId(providerInvoiceId: string): Promise<InvoiceMirror | undefined>;
  listForUser(userId: string, limit?: number): Promise<InvoiceMirror[]>;
  upsert(input: UpsertInvoiceMirrorInput): Promise<InvoiceMirror>;
}

export function createInvoiceMirror(input: UpsertInvoiceMirrorInput, now = new Date()): InvoiceMirror {
  return {
    id: `stripe_${input.providerInvoiceId}`,
    userId: input.userId,
    provider: "stripe",
    providerInvoiceId: input.providerInvoiceId,
    providerCustomerId: input.providerCustomerId,
    providerSubscriptionId: input.providerSubscriptionId,
    status: input.status,
    amountDueCents: input.amountDueCents,
    amountPaidCents: input.amountPaidCents,
    currency: input.currency,
    hostedInvoiceUrl: input.hostedInvoiceUrl,
    invoicePdfUrl: input.invoicePdfUrl,
    providerCreatedAt: input.providerCreatedAt,
    paidAt: input.paidAt,
    failedAt: input.failedAt,
    createdAt: now,
    updatedAt: now
  };
}
