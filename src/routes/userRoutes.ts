import { Router } from "express";
import type { UserConfigService } from "../application/users/userConfigService.js";
import { assistantProfileUpdateSchema, userConfigUpdateSchema } from "./clientSchemas.js";
import { asyncHandler, currentUserId } from "./routeSupport.js";
import { redactedUserConfig } from "./userPresenters.js";

export function userRoutes(input: {
  userConfigs: UserConfigService;
}) {
  const router = Router();

  router.get("/me", asyncHandler(async (_req, res) => {
    const config = await input.userConfigs.getOrCreate(currentUserId(res));
    res.status(200).json({ user: redactedUserConfig(config) });
  }));

  router.patch("/me/config", asyncHandler(async (req, res) => {
    const parsed = userConfigUpdateSchema.parse(req.body);
    const config = await input.userConfigs.upsert({
      userId: currentUserId(res),
      displayName: parsed.displayName,
      phoneRouting: parsed.phoneRouting,
      billing: parsed.billing
    });
    res.status(200).json({ user: redactedUserConfig(config) });
  }));

  router.patch("/me/assistant-profile", asyncHandler(async (req, res) => {
    const parsed = assistantProfileUpdateSchema.parse(req.body);
    const config = await input.userConfigs.updateAssistantProfile(currentUserId(res), parsed);
    res.status(200).json({ user: redactedUserConfig(config), assistantProfile: config.assistantProfile });
  }));

  return router;
}
