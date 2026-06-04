import { Router } from "express";
import type { AccountRemovalService } from "../application/accounts/accountRemovalService.js";
import { asyncHandler, currentFirebaseUid, currentUserId } from "./routeSupport.js";

export function accountRoutes(input: {
  accountRemoval: AccountRemovalService;
}) {
  const router = Router();

  router.delete("/account", asyncHandler(async (_req, res) => {
    const result = await input.accountRemoval.removeAccount({
      userId: currentUserId(res),
      firebaseUid: currentFirebaseUid(res)
    });
    res.status(200).json(result);
  }));

  return router;
}
