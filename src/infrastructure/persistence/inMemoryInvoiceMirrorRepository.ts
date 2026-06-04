import {
  createInvoiceMirror,
  type InvoiceMirror,
  type InvoiceMirrorRepository,
  type UpsertInvoiceMirrorInput
} from "../../domain/billing/invoiceMirror.js";

export class InMemoryInvoiceMirrorRepository implements InvoiceMirrorRepository {
  private readonly invoices = new Map<string, InvoiceMirror>();

  async getByProviderInvoiceId(providerInvoiceId: string): Promise<InvoiceMirror | undefined> {
    return this.invoices.get(idFor(providerInvoiceId));
  }

  async listForUser(userId: string, limit = 12): Promise<InvoiceMirror[]> {
    return [...this.invoices.values()]
      .filter((invoice) => invoice.userId === userId)
      .sort((a, b) => (b.providerCreatedAt ?? b.createdAt).getTime() - (a.providerCreatedAt ?? a.createdAt).getTime())
      .slice(0, limit);
  }

  async upsert(input: UpsertInvoiceMirrorInput): Promise<InvoiceMirror> {
    const existing = this.invoices.get(idFor(input.providerInvoiceId));
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
    this.invoices.set(next.id, next);
    return next;
  }
}

function idFor(providerInvoiceId: string): string {
  return `stripe_${providerInvoiceId}`;
}
