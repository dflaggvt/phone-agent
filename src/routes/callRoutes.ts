import { Router } from "express";
import type { ActiveCallService } from "../application/calls/activeCallService.js";
import type { UserConfigService } from "../application/users/userConfigService.js";
import type { CallRepository } from "../domain/calls/callRepository.js";
import { asyncHandler, currentUserId } from "./routeSupport.js";

export function callRoutes(input: {
  calls: CallRepository;
  activeCalls: ActiveCallService;
  userConfigs: UserConfigService;
}) {
  const router = Router();

  router.get("/calls", asyncHandler(async (_req, res) => {
    const userConfig = await input.userConfigs.getOrCreate(currentUserId(res));
    const sessions = await input.calls.listCallsForRoute(userConfig.phoneRouting.assistantPhoneNumber ?? "");
    res.status(200).json({ calls: sessions });
  }));

  router.get("/calls/active", asyncHandler(async (_req, res) => {
    const userConfig = await input.userConfigs.getOrCreate(currentUserId(res));
    const activeCall = await input.activeCalls.getActiveCall({
      userId: userConfig.userId,
      userAssistantPhoneNumber: userConfig.phoneRouting.assistantPhoneNumber
    });
    res.status(200).json({ activeCall: activeCall ?? null });
  }));

  return router;
}
