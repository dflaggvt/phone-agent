import { Router } from "express";
import type { BillingAccountService } from "../application/billing/billingAccountService.js";
import type { UsageService } from "../application/billing/usageService.js";
import { asyncHandler, currentUserId } from "./routeSupport.js";
import { spendingLimitUpdateSchema } from "./clientSchemas.js";

export function billingReturnRoutes() {
  const router = Router();

  router.get("/stripe/success", (_req, res) => {
    res.status(200).type("html").send(billingReturnPage({
      title: "Card saved",
      message: "You can return to Phone Agent and tap Check billing status."
    }));
  });

  router.get("/stripe/cancel", (_req, res) => {
    res.status(200).type("html").send(billingReturnPage({
      title: "Card setup canceled",
      message: "No card was added. You can return to Phone Agent and try again."
    }));
  });

  return router;
}

export function billingRoutes(input: {
  billing: BillingAccountService;
  usage: UsageService;
}) {
  const router = Router();

  router.get("/usage", asyncHandler(async (_req, res) => {
    res.status(200).json(await input.usage.currentUsageWithLimits(currentUserId(res)));
  }));

  router.get("/account", asyncHandler(async (_req, res) => {
    const account = await input.billing.getOrCreateAccount(currentUserId(res));
    res.status(200).json({ account: redactedBillingAccount(account) });
  }));

  router.post("/checkout-session", asyncHandler(async (_req, res) => {
    const result = await input.billing.createSetupSession(currentUserId(res));
    res.status(200).json({
      account: redactedBillingAccount(result.account),
      session: result.session
    });
  }));

  router.post("/customer-portal", asyncHandler(async (_req, res) => {
    res.status(200).json(await input.billing.createPortalSession(currentUserId(res)));
  }));

  router.get("/invoices", asyncHandler(async (_req, res) => {
    const invoices = await input.billing.listInvoices(currentUserId(res));
    res.status(200).json({ invoices: invoices.map(redactedBillingInvoice) });
  }));

  router.patch("/spending-limit", asyncHandler(async (req, res) => {
    const parsed = spendingLimitUpdateSchema.parse(req.body);
    const account = await input.billing.setSpendingLimit(currentUserId(res), parsed.monthlySpendingCapCents);
    res.status(200).json({ account: redactedBillingAccount(account) });
  }));

  router.post("/activate", asyncHandler(async (_req, res) => {
    const account = await input.billing.activateBilling(currentUserId(res));
    res.status(200).json({ account: redactedBillingAccount(account) });
  }));

  return router;
}

function redactedBillingAccount(account: Awaited<ReturnType<BillingAccountService["getOrCreateAccount"]>>) {
  return {
    userId: account.userId,
    status: account.status,
    providerSubscriptionStatus: account.providerSubscriptionStatus,
    currency: account.currency,
    monthlySpendingCapCents: account.monthlySpendingCapCents,
    currentPeriodSpendCents: account.currentPeriodSpendCents,
    paymentMethod: account.paymentMethod
      ? {
        provider: account.paymentMethod.provider,
        brand: account.paymentMethod.brand,
        last4: account.paymentMethod.last4,
        expMonth: account.paymentMethod.expMonth,
        expYear: account.paymentMethod.expYear,
        updatedAt: account.paymentMethod.updatedAt
      }
      : undefined,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt
  };
}

function redactedBillingInvoice(invoice: Awaited<ReturnType<BillingAccountService["listInvoices"]>>[number]) {
  return {
    id: invoice.id,
    status: invoice.status,
    amountDueCents: invoice.amountDueCents,
    amountPaidCents: invoice.amountPaidCents,
    currency: invoice.currency,
    hostedInvoiceUrl: invoice.hostedInvoiceUrl,
    invoicePdfUrl: invoice.invoicePdfUrl,
    createdAt: invoice.createdAt
  };
}

function billingReturnPage(input: { title: string; message: string }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${input.title}</title>
  <style>
    body { margin: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #24113f; color: #fff; }
    main { min-height: 100vh; display: grid; place-items: center; padding: 32px; box-sizing: border-box; }
    section { max-width: 420px; }
    h1 { font-size: 36px; line-height: 1.05; margin: 0 0 16px; }
    p { color: rgba(255,255,255,.78); font-size: 18px; line-height: 1.45; margin: 0; }
  </style>
</head>
<body>
  <main>
    <section>
      <h1>${input.title}</h1>
      <p>${input.message}</p>
    </section>
  </main>
</body>
</html>`;
}
