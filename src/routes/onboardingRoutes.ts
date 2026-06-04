import { Router } from "express";
import type { BillingAccountService } from "../application/billing/billingAccountService.js";
import type { UserConfigService } from "../application/users/userConfigService.js";
import type { VoiceNumberProvisioningService } from "../application/users/voiceNumberProvisioningService.js";
import type { CallRepository } from "../domain/calls/callRepository.js";
import type { CommunicationItemRepository } from "../domain/communications/communicationItem.js";
import { assistantNumberAssignmentSchema } from "./clientSchemas.js";
import { asyncHandler, currentUserId } from "./routeSupport.js";
import { redactedUserConfig } from "./userPresenters.js";

export function onboardingRoutes(input: {
  billing: BillingAccountService;
  billingRequiredForProvisioning: boolean;
  calls: CallRepository;
  communicationItems: CommunicationItemRepository;
  userConfigs: UserConfigService;
  voiceNumberProvisioning: VoiceNumberProvisioningService;
}) {
  const router = Router();

  router.post("/onboarding/assistant-number", asyncHandler(async (req, res) => {
    const parsed = assistantNumberAssignmentSchema.parse(req.body);
    await input.billing.assertPaidInfrastructureAllowed(currentUserId(res));
    const assignment = await input.voiceNumberProvisioning.assignRetellNumber({
      userId: currentUserId(res),
      areaCode: parsed.areaCode,
      phoneNumber: parsed.phoneNumber
    });
    const config = await input.userConfigs.getOrCreate(currentUserId(res));
    res.status(200).json({ assignment, user: redactedUserConfig(config) });
  }));

  router.post("/onboarding/forwarding-instructions-viewed", asyncHandler(async (_req, res) => {
    const config = await input.userConfigs.upsert({
      userId: currentUserId(res),
      phoneRouting: {
        forwardingInstructionsViewedAt: new Date()
      }
    });
    res.status(200).json({ user: redactedUserConfig(config) });
  }));

  router.get("/onboarding/status", asyncHandler(async (_req, res) => {
    const userId = currentUserId(res);
    const userConfig = await input.userConfigs.getOrCreate(userId);
    const [communicationList, callList, billingAccount] = await Promise.all([
      input.communicationItems.listRecentForUser(userId, 10),
      input.calls.listCallsForRoute(userConfig.phoneRouting.retellPhoneNumber ?? ""),
      input.billing.getOrCreateAccount(userId)
    ]);

    const hasCompletedCall = callList.some((call) => call.status === "completed" || Boolean(call.summary?.text));
    const hasUsefulCommunication = communicationList.some((item) =>
      Boolean(item.summary)
      || item.extractedFacts.length > 0
      || item.extractedTasks.length > 0
      || item.extractedDecisions.length > 0
      || item.extractedOpenQuestions.length > 0
    );
    const checklist = [
      {
        id: "account",
        label: "Create account",
        complete: Boolean(userConfig.onboarding.accountCreatedAt),
        action: "account"
      },
      {
        id: "phone_verification",
        label: "Verify your mobile number",
        complete: Boolean(userConfig.auth.primaryPhoneVerifiedAt),
        action: "verify_phone"
      },
      {
        id: "assistant_profile",
        label: "Name your assistant",
        complete: Boolean(userConfig.onboarding.assistantProfileConfiguredAt),
        action: "assistant_name"
      },
      ...(input.billingRequiredForProvisioning
        ? [{
          id: "billing",
          label: "Add payment method and spending cap",
          complete: billingAccount.status === "active",
          action: "billing"
        }]
        : []),
      {
        id: "assistant_number",
        label: "Assign assistant forwarding number",
        complete: Boolean(userConfig.phoneRouting.retellPhoneNumber),
        action: "assistant_number"
      },
      {
        id: "forwarding",
        label: "Configure carrier call forwarding",
        complete: Boolean(userConfig.phoneRouting.forwardingInstructionsViewedAt) || hasCompletedCall,
        action: "forwarding"
      },
      {
        id: "test_call",
        label: "Make a test call",
        complete: callList.length > 0,
        action: "call"
      },
      {
        id: "first_useful_call",
        label: "Review first useful handled call",
        complete: hasCompletedCall && hasUsefulCommunication,
        action: "inbox"
      }
    ];

    const completedCount = checklist.filter((item) => item.complete).length;
    const requiredActivationComplete = checklist
      .filter((item) => item.id !== "first_useful_call")
      .every((item) => item.complete);
    res.status(200).json({
      status: {
        readyForBetaUse: requiredActivationComplete && hasCompletedCall,
        completedCount,
        totalCount: checklist.length,
        nextAction: checklist.find((item) => !item.complete) ?? null,
        checklist,
        activation: {
          accountCreated: Boolean(userConfig.onboarding.accountCreatedAt),
          phoneVerified: Boolean(userConfig.auth.primaryPhoneVerifiedAt),
          assistantProfileConfigured: Boolean(userConfig.onboarding.assistantProfileConfiguredAt),
          billingRequired: input.billingRequiredForProvisioning,
          billingActive: billingAccount.status === "active",
          assistantNumberAssigned: Boolean(userConfig.phoneRouting.retellPhoneNumber),
          firstCallReceived: callList.length > 0,
          firstUsefulHandledCall: hasCompletedCall && hasUsefulCommunication,
          communicationCount: communicationList.length
        }
      }
    });
  }));

  return router;
}
