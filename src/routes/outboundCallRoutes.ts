import { Router } from "express";
import type { BillingAccountService } from "../application/billing/billingAccountService.js";
import type { OutboundCallService } from "../application/retell/outboundCallService.js";
import { asyncHandler, currentUserId } from "./routeSupport.js";

export function outboundCallRoutes(input: {
  billing: BillingAccountService;
  outboundCalls: OutboundCallService;
}) {
  const router = Router();

  router.post("/outbound-calls", asyncHandler(async (req, res) => {
    await input.billing.assertPaidRuntimeAllowed(currentUserId(res));
    const created = await input.outboundCalls.createApprovedCall(req.body);
    res.status(201).json(created);
  }));

  return router;
}
