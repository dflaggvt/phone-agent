import { Router } from "express";
import {
  CURRENT_BETA_SIGNUP_CONSENT_VERSION,
  type BetaSignupRepository
} from "../domain/beta/betaSignup.js";
import { betaSignupCreateSchema } from "./clientSchemas.js";
import { asyncHandler } from "./routeSupport.js";

export function betaSignupRoutes(input: {
  betaSignups: BetaSignupRepository;
}) {
  const router = Router();

  router.post("/beta-signups", asyncHandler(async (req, res) => {
    const parsed = betaSignupCreateSchema.parse(req.body);
    await input.betaSignups.save({
      googlePlayEmail: parsed.googlePlayEmail,
      source: "website",
      consentVersion: CURRENT_BETA_SIGNUP_CONSENT_VERSION
    });
    res.status(202).json({ status: "pending" });
  }));

  return router;
}
