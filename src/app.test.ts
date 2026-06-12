import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import type { AuthVerifier, VerifiedAuthUser } from "./application/auth/authVerifier.js";
import type { PushDeliveryClient, PushDeliveryInput, PushDeliveryResult } from "./application/notifications/pushDeliveryClient.js";
import type { AppEnv } from "./config/env.js";
import { createUserConfig, type UserConfig } from "./domain/users/userConfig.js";
import type { PurchaseVoiceNumberInput, VoiceNumberProviderClient } from "./infrastructure/retell/retellClient.js";
import type { PhoneNumberResponse } from "retell-sdk/resources/phone-number.js";
import { createLogger } from "./shared/logger.js";

const testEnv: AppEnv = {
  NODE_ENV: "test",
  PORT: 3000,
  LOG_LEVEL: "silent",
  PERSISTENCE_DRIVER: "memory",
  FIREBASE_PROJECT_ID: "phone-agent-test",
  SELF_SERVE_RETELL_PROVISIONING: true,
  APP_PUBLIC_BASE_URL: "https://example.com",
  RETELL_API_KEY: undefined,
  RETELL_DEFAULT_AGENT_ID: "agent_default",
  RETELL_DEFAULT_FROM_NUMBER: "+15551230000",
  TRANSFER_APPROVAL_TIMEOUT_MS: 60_000,
  LIVE_ANSWER_TIMEOUT_MS: 90_000,
  OPENAI_API_KEY: undefined,
  OPENAI_CLASSIFIER_MODEL: "gpt-4.1-mini",
  BILLING_PLAN: "beta",
  BILLING_MONTHLY_INCLUDED_MINUTES: 300,
  BILLING_MONTHLY_CLASSIFICATION_LIMIT: 1000,
  BILLING_CALL_MINUTE_OVERAGE_CENTS: 39,
  BILLING_ESTIMATED_CALL_MINUTE_COST_CENTS: 12,
  BILLING_CLASSIFICATION_COST_CENTS: 1,
  BILLING_REQUIRED_FOR_PROVISIONING: false,
  BILLING_DEFAULT_SPENDING_CAP_CENTS: 4000,
  RATE_LIMIT_WINDOW_MS: 60_000,
  RATE_LIMIT_MAX_REQUESTS: 120,
  WEBHOOK_RATE_LIMIT_MAX_REQUESTS: 600,
  STRIPE_SECRET_KEY: undefined,
  STRIPE_PUBLISHABLE_KEY: undefined,
  STRIPE_WEBHOOK_SECRET: undefined,
  STRIPE_PRICE_PERSONAL_MONTHLY: undefined,
  STRIPE_PRICE_PERSONAL_CALL_MINUTE_OVERAGE: undefined,
  GOOGLE_OAUTH_CLIENT_ID: undefined,
  GOOGLE_OAUTH_CLIENT_SECRET: undefined,
  GOOGLE_OAUTH_REDIRECT_URI: undefined,
  GOOGLE_OAUTH_STATE_SECRET: undefined,
  RETELL_INBOUND_WEBHOOK_VERIFY: false
};

class FakeAuthVerifier implements AuthVerifier {
  async verifyIdToken(idToken: string): Promise<VerifiedAuthUser> {
    const [uid = "daryl", phoneNumber = "+15557650000", displayName = "Daryl"] = idToken.split("|");
    return { uid, phoneNumber, displayName };
  }
}

class FakePushDeliveryClient implements PushDeliveryClient {
  readonly sent: PushDeliveryInput[] = [];

  async send(input: PushDeliveryInput): Promise<PushDeliveryResult> {
    this.sent.push(input);
    return { status: "sent" };
  }
}

const queuedAssistantNumbers: string[] = [];

class FakeVoiceNumberProvider implements VoiceNumberProviderClient {
  readonly purchased: PurchaseVoiceNumberInput[] = [];
  readonly released: string[] = [];
  private readonly numbers = new Map<string, PhoneNumberResponse>();
  private generatedCount = 0;

  async purchaseNumber(input: PurchaseVoiceNumberInput): Promise<PhoneNumberResponse> {
    this.purchased.push(input);
    const phoneNumber = queuedAssistantNumbers.shift() ?? this.generatedPhoneNumber(input.areaCode);
    const response = this.numberResponse(phoneNumber, input);
    this.numbers.set(phoneNumber, response);
    return response;
  }

  async retrieveNumber(assistantPhoneNumber: string): Promise<PhoneNumberResponse> {
    return this.numbers.get(assistantPhoneNumber) ?? this.numberResponse(assistantPhoneNumber);
  }

  async listNumbers(): Promise<PhoneNumberResponse[]> {
    return [...this.numbers.values()];
  }

  async updateNumber(assistantPhoneNumber: string, input: {
    inboundAgentId?: string | null;
    outboundAgentId?: string | null;
    inboundWebhookUrl?: string | null;
    nickname?: string | null;
  }): Promise<PhoneNumberResponse> {
    const existing = this.numbers.get(assistantPhoneNumber) ?? this.numberResponse(assistantPhoneNumber);
    const updated = {
      ...existing,
      inbound_agent_id: input.inboundAgentId ?? existing.inbound_agent_id,
      outbound_agent_id: input.outboundAgentId ?? existing.outbound_agent_id,
      inbound_webhook_url: input.inboundWebhookUrl ?? existing.inbound_webhook_url,
      nickname: input.nickname ?? existing.nickname,
      last_modification_timestamp: Date.now()
    };
    this.numbers.set(assistantPhoneNumber, updated);
    return updated;
  }

  async releaseNumber(assistantPhoneNumber: string): Promise<void> {
    this.released.push(assistantPhoneNumber);
    this.numbers.delete(assistantPhoneNumber);
  }

  private generatedPhoneNumber(areaCode?: number): string {
    this.generatedCount += 1;
    const area = String(areaCode ?? 555).padStart(3, "0");
    return `+1${area}555${String(this.generatedCount).padStart(4, "0")}`;
  }

  private numberResponse(phoneNumber: string, input: Partial<PurchaseVoiceNumberInput> = {}): PhoneNumberResponse {
    return {
      phone_number: phoneNumber,
      area_code: Number(phoneNumber.replace(/\D/g, "").slice(-10, -7)),
      inbound_agent_id: input.inboundAgentId ?? "agent_default",
      outbound_agent_id: input.outboundAgentId ?? input.inboundAgentId ?? "agent_default",
      inbound_webhook_url: input.inboundWebhookUrl ?? "https://example.com/webhooks/retell/inbound",
      nickname: input.nickname ?? null,
      phone_number_type: "retell-twilio" as const,
      last_modification_timestamp: Date.now()
    };
  }
}

class TimeoutVoiceNumberProvider extends FakeVoiceNumberProvider {
  override async purchaseNumber(input: PurchaseVoiceNumberInput): Promise<PhoneNumberResponse> {
    this.purchased.push(input);
    const error = new Error("provider timed out") as Error & { code: string };
    error.code = "ETIMEDOUT";
    throw error;
  }
}

class ReleaseFailingVoiceNumberProvider extends FakeVoiceNumberProvider {
  override async releaseNumber(assistantPhoneNumber: string): Promise<void> {
    this.released.push(assistantPhoneNumber);
    throw new Error("provider release failed");
  }
}

function createTestApp(
  env: AppEnv = testEnv,
  pushDelivery?: PushDeliveryClient,
  options: { voiceNumberProvider?: VoiceNumberProviderClient; initialUserConfigs?: UserConfig[] } = {}
) {
  return createApp({
    env,
    logger: createLogger("silent"),
    authVerifier: new FakeAuthVerifier(),
    pushDelivery,
    voiceNumberProvider: options.voiceNumberProvider ?? new FakeVoiceNumberProvider(),
    initialUserConfigs: options.initialUserConfigs
  });
}

function auth(uid = "daryl", phoneNumber = "+15557650000", displayName = "Daryl") {
  return { authorization: `Bearer ${uid}|${phoneNumber}|${displayName}` };
}

async function assignDefaultRoute(
  app: ReturnType<typeof createTestApp>,
  uid = "daryl",
  phoneNumber = "+15557650000",
  displayName = "Daryl",
  assistantPhoneNumber = "+15557650000"
) {
  queuedAssistantNumbers.push(assistantPhoneNumber);
  await request(app)
    .patch("/v1/me/assistant-profile")
    .set(auth(uid, phoneNumber, displayName))
    .send({ assistantName: "Assistant" })
    .expect(200);
  await request(app)
    .post("/v1/onboarding/assistant-number")
    .set(auth(uid, phoneNumber, displayName))
    .send({ areaCode: areaCodeFor(assistantPhoneNumber) })
    .expect(200);
}

function seededUserConfig(input: {
  uid: string;
  phoneNumber: string;
  displayName: string;
  assistantPhoneNumber: string;
  voiceAgentId?: string;
}): UserConfig {
  const now = new Date();
  return createUserConfig({
    userId: `firebase_${input.uid}`,
    displayName: input.displayName,
    auth: {
      firebaseUid: input.uid,
      phoneNumber: input.phoneNumber,
      primaryPhoneVerifiedAt: now
    },
    assistantProfile: {
      assistantName: "Assistant"
    },
    phoneRouting: {
      primaryPhoneNumber: input.phoneNumber,
      assistantPhoneNumber: input.assistantPhoneNumber,
      voiceAgentId: input.voiceAgentId ?? "agent_default",
      providerNumberType: "twilio",
      assistantNumberAssignedAt: now,
      assistantNumberProvisioningStatus: "assigned",
      transferPhoneNumber: input.phoneNumber
    },
    billing: {
      assistantNumberProvisioningAllowed: true
    },
    onboarding: {
      accountCreatedAt: now,
      assistantProfileConfiguredAt: now
    },
    now
  });
}

function areaCodeFor(phoneNumber: string): number | undefined {
  const digits = phoneNumber.replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  const areaCode = national.slice(0, 3);
  return areaCode.length === 3 ? Number(areaCode) : undefined;
}

describe("app", () => {
  it("returns health status", async () => {
    const app = createTestApp();

    await request(app)
      .get("/healthz")
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe("ok");
      });
  });

  it("rate limits repeated authenticated client requests", async () => {
    const app = createTestApp({
      ...testEnv,
      RATE_LIMIT_WINDOW_MS: 60_000,
      RATE_LIMIT_MAX_REQUESTS: 1
    });

    await request(app).get("/v1/me").set(auth()).expect(200);
    await request(app)
      .get("/v1/me")
      .set(auth())
      .expect(429)
      .expect(({ body }) => {
        expect(body.error.code).toBe("rate_limited");
      });
  });

  it("returns Retell inbound call context and agent override", async () => {
    const app = createTestApp();
    await assignDefaultRoute(app);

    await request(app)
      .post("/webhooks/retell/inbound")
      .set("content-type", "application/json")
      .send({
        event: "call_inbound",
        call_inbound: {
          agent_id: "agent_existing",
          from_number: "+15551230000",
          to_number: "+15557650000"
        }
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.call_inbound.override_agent_id).toBe("agent_default");
        expect(body.call_inbound.dynamic_variables.caller_number).toBe("+15551230000");
        expect(body.call_inbound.dynamic_variables.current_timezone).toBe("America/New_York");
        expect(body.call_inbound.dynamic_variables.current_datetime).toMatch(/E[DS]T/);
        expect(body.call_inbound.dynamic_variables.opening_line).toBe("Hi, you've reached Daryl's assistant. Who's calling?");
        expect(body.call_inbound.agent_override.retell_llm.begin_message).toContain("Who's calling");
        expect(body.call_inbound.dynamic_variables.agent_behavior_contract).toContain("Speak naturally");
        expect(body.call_inbound.dynamic_variables.agent_behavior_contract).toContain("Never say internal labels");
        expect(body.call_inbound.dynamic_variables.disclosure_policy).toContain("AI assistant");
        expect(body.call_inbound.dynamic_variables.emergency_policy).toContain("emergency services");
        expect(body.call_inbound.dynamic_variables.outcome_policy).toContain("clear outcome");
      });
  });

  it("degrades live assistant runtime without caller context when billing is inactive", async () => {
    const app = createTestApp({ ...testEnv, BILLING_REQUIRED_FOR_PROVISIONING: true }, undefined, {
      initialUserConfigs: [
        seededUserConfig({
          uid: "maya",
          phoneNumber: "+15550001111",
          displayName: "Maya",
          assistantPhoneNumber: "+15559990000"
        })
      ]
    });
    await request(app)
      .post("/v1/agent-notes")
      .set(auth("maya", "+15550001111", "Maya"))
      .send({
        text: "Tell Greg the gate code is 1234.",
        targetPhoneNumber: "+15551230000"
      })
      .expect(201);

    const inbound = await request(app)
      .post("/webhooks/retell/inbound")
      .set("content-type", "application/json")
      .send({
        event: "call_inbound",
        call_inbound: {
          from_number: "+15551230000",
          to_number: "+15559990000"
        }
      })
      .expect(200);

    const variables = inbound.body.call_inbound.dynamic_variables;
    expect(inbound.body.call_inbound.metadata.billing_blocked).toBe(true);
    expect(variables.paid_runtime_allowed).toBe("false");
    expect(variables.opening_line).toBe("Maya's assistant is currently unavailable. Please try again later.");
    expect(variables.caller_context).toBe("");
    expect(variables.active_agent_notes).toBe("");
    expect(JSON.stringify(inbound.body)).not.toContain("gate code");
    expect(variables.tool_policy).toContain("Do not use tools");

    await request(app)
      .get("/v1/notifications?unread=true")
      .set(auth("maya", "+15550001111", "Maya"))
      .expect(200)
      .expect(({ body }) => {
        const billingIssues = body.notifications.filter((notification: { type: string }) => notification.type === "billing_issue");
        expect(billingIssues).toHaveLength(1);
        expect(billingIssues[0].body).toBe("Add a payment method before your assistant can continue paid work.");
        expect(JSON.stringify(billingIssues[0])).not.toContain("gate code");
      });
  });

  it("returns onboarding status for authenticated activation", async () => {
    const app = createTestApp();

    await request(app)
      .get("/v1/onboarding/status")
      .set(auth())
      .expect(200)
      .expect(({ body }) => {
        expect(body.status.readyForBetaUse).toBe(false);
        expect(body.status.totalCount).toBe(7);
        expect(body.status.checklist.some((item: { id: string }) => item.id === "calendar")).toBe(false);
        expect(body.status.checklist.some((item: { id: string }) => item.id === "topic")).toBe(false);
        expect(body.status.checklist.some((item: { id: string }) => item.id === "note")).toBe(false);
        expect(body.status.checklist).toContainEqual(expect.objectContaining({
          id: "assistant_profile",
          label: "Name your assistant",
          action: "assistant_name"
        }));
        expect(body.status.checklist.some((item: { id: string }) => item.id === "test_call")).toBe(true);
        expect(body.status.nextAction).toBeTruthy();
      });
  });

  it("includes billing in onboarding only when paid provisioning is required", async () => {
    const app = createTestApp({ ...testEnv, BILLING_REQUIRED_FOR_PROVISIONING: true });

    await request(app)
      .get("/v1/onboarding/status")
      .set(auth())
      .expect(200)
      .expect(({ body }) => {
        expect(body.status.totalCount).toBe(8);
        expect(body.status.checklist).toContainEqual(expect.objectContaining({
          id: "billing",
          label: "Add payment method and spending cap",
          complete: false,
          action: "billing"
        }));
        expect(body.status.activation.billingRequired).toBe(true);
        expect(body.status.activation.billingActive).toBe(false);
      });
  });

  it("returns Firebase-authenticated user config and usage limits", async () => {
    const app = createTestApp();

    await request(app)
      .get("/v1/me")
      .set(auth())
      .expect(200)
      .expect(({ body }) => {
        expect(body.user.userId).toBe("firebase_daryl");
        expect(body.user.displayName).toBe("Daryl");
        expect(body.user.phoneRouting.primaryPhoneNumber).toBe("+15557650000");
        expect(body.user.auth.phoneVerificationStatus).toBe("verified");
        expect(body.user.billing.monthlyClassificationLimit).toBe(1000);
      });

    await request(app)
      .get("/v1/billing/usage")
      .set(auth())
      .expect(200)
      .expect(({ body }) => {
        expect(body.limits.plan).toBe("beta");
        expect(body.usage.classificationRequests).toBe(0);
        expect(body.status.classificationLimitExceeded).toBe(false);
      });
  });

  it("preserves verified protected phone state when later Google tokens omit phone claims", async () => {
    const app = createTestApp();

    await request(app)
      .get("/v1/me")
      .set(auth("daryl", "+15557650000", "Daryl"))
      .expect(200)
      .expect(({ body }) => {
        expect(body.user.auth.phoneNumber).toBe("+15557650000");
        expect(body.user.auth.phoneVerificationStatus).toBe("verified");
      });

    await request(app)
      .get("/v1/me")
      .set(auth("daryl", "", "Daryl"))
      .expect(200)
      .expect(({ body }) => {
        expect(body.user.auth.phoneNumber).toBe("+15557650000");
        expect(body.user.auth.phoneVerificationStatus).toBe("verified");
      });

    await request(app)
      .get("/v1/onboarding/status")
      .set(auth("daryl", "", "Daryl"))
      .expect(200)
      .expect(({ body }) => {
        expect(body.status.activation.phoneVerified).toBe(true);
        expect(body.status.checklist).toContainEqual(expect.objectContaining({
          id: "phone_verification",
          complete: true
        }));
      });
  });

  it("does not mark Google-only accounts as phone verified before protected-number verification", async () => {
    const app = createTestApp();

    await request(app)
      .get("/v1/onboarding/status")
      .set(auth("google_only", "", "Daryl"))
      .expect(200)
      .expect(({ body }) => {
        expect(body.status.activation.phoneVerified).toBe(false);
        expect(body.status.checklist).toContainEqual(expect.objectContaining({
          id: "phone_verification",
          complete: false
        }));
      });
  });

  it("reproduces split legacy phone and Google identities before support merge", async () => {
    const app = createTestApp();

    await request(app)
      .get("/v1/me")
      .set(auth("legacy_phone_uid", "+15557650000", "Daryl"))
      .expect(200)
      .expect(({ body }) => {
        expect(body.user.auth.phoneVerificationStatus).toBe("verified");
      });

    await request(app)
      .get("/v1/onboarding/status")
      .set(auth("google_uid", "", "Daryl"))
      .expect(200)
      .expect(({ body }) => {
        expect(body.status.activation.phoneVerified).toBe(false);
        expect(body.status.nextAction).toEqual(expect.objectContaining({
          id: "phone_verification"
        }));
      });
  });

  it("returns billing account state and lets the user set a spending cap", async () => {
    const app = createTestApp();

    await request(app)
      .get("/v1/billing/account")
      .set(auth())
      .expect(200)
      .expect(({ body }) => {
        expect(body.account.status).toBe("payment_required");
        expect(body.account.monthlySpendingCapCents).toBe(4000);
        expect(body.account.paymentMethod).toBeUndefined();
      });

    await request(app)
      .patch("/v1/billing/spending-limit")
      .set(auth())
      .send({ monthlySpendingCapCents: 5000 })
      .expect(200)
      .expect(({ body }) => {
        expect(body.account.monthlySpendingCapCents).toBe(5000);
        expect(body.account.status).toBe("payment_required");
      });
  });

  it("lets an authenticated user cancel paid subscription state", async () => {
    const app = createTestApp();

    await request(app)
      .post("/v1/billing/cancel-subscription")
      .set(auth())
      .expect(200)
      .expect(({ body }) => {
        expect(body.account.status).toBe("canceled");
        expect(body.account.providerSubscriptionStatus).toBe("canceled");
      });

    await request(app)
      .get("/v1/billing/account")
      .set(auth())
      .expect(200)
      .expect(({ body }) => {
        expect(body.account.status).toBe("canceled");
      });
  });

  it("removes an authenticated account, releases the assistant number, and blocks subsequent access", async () => {
    const voiceNumberProvider = new FakeVoiceNumberProvider();
    const app = createTestApp(testEnv, undefined, { voiceNumberProvider });
    await assignDefaultRoute(app, "daryl", "+15557650000", "Daryl", "+15559990000");

    await request(app)
      .post("/v1/push-tokens")
      .set(auth())
      .send({
        token: "fcm_token_12345678901234567890",
        platform: "android",
        deviceId: "device_123",
        appVersion: "0.1.1"
      })
      .expect(200);

    await request(app)
      .delete("/v1/account")
      .set(auth())
      .expect(200)
      .expect(({ body }) => {
        expect(body.removed).toBe(true);
      });

    expect(voiceNumberProvider.released).toEqual(["+15559990000"]);

    await request(app)
      .get("/v1/me")
      .set(auth())
      .expect(403)
      .expect(({ body }) => {
        expect(body.error.code).toBe("account_removed");
      });
  });

  it("does not clear local routing when assistant number release fails during account removal", async () => {
    const voiceNumberProvider = new ReleaseFailingVoiceNumberProvider();
    const app = createTestApp(testEnv, undefined, { voiceNumberProvider });
    await assignDefaultRoute(app, "daryl", "+15557650000", "Daryl", "+15559990000");

    await request(app)
      .delete("/v1/account")
      .set(auth())
      .expect(409)
      .expect(({ body }) => {
        expect(body.error.code).toBe("assistant_number_release_failed");
      });

    expect(voiceNumberProvider.released).toEqual(["+15559990000"]);

    await request(app)
      .get("/v1/me")
      .set(auth())
      .expect(200)
      .expect(({ body }) => {
        expect(body.user.accountStatus).toBe("active");
        expect(body.user.phoneRouting.assistantPhoneNumber).toBe("+15559990000");
      });
  });

  it("registers Android push tokens and sends privacy-safe FCM data payloads", async () => {
    const pushDelivery = new FakePushDeliveryClient();
    const app = createTestApp(testEnv, pushDelivery);
    await assignDefaultRoute(app);

    await request(app)
      .post("/v1/push-tokens")
      .set(auth())
      .send({
        token: "fcm_test_token_12345678901234567890",
        platform: "android",
        deviceId: "test-device",
        appVersion: "0.1.0"
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.pushToken.platform).toBe("android");
        expect(body.pushToken.status).toBe("active");
      });

    await request(app)
      .post("/webhooks/retell/events")
      .set("content-type", "application/json")
      .send({
        event: "call_analyzed",
        call: {
          call_id: "call_push_123",
          direction: "inbound",
          from_number: "+15551230000",
          to_number: "+15557650000",
          agent_id: "agent_default",
          call_status: "ended",
          transcript: "Maya is asking for the gate code.",
          call_analysis: {
            call_summary: "Maya asked for the gate code.",
            custom_analysis_data: {
              caller_name: "Maya",
              caller_intent: "Ask for the gate code.",
              urgency: "normal"
            }
          }
        }
      })
      .expect(204);

    expect(pushDelivery.sent).toHaveLength(1);
    const sent = pushDelivery.sent[0];
    expect(sent).toBeDefined();
    expect(sent?.token).toBe("fcm_test_token_12345678901234567890");
    expect(sent?.type).toBe("call_summary");
    expect(sent?.body).toBe("The assistant summarized a call.");
    expect(JSON.stringify(sent)).not.toContain("gate code");
    expect(JSON.stringify(sent)).not.toContain("Maya is asking");

    await request(app)
      .get("/v1/notifications/deliveries")
      .set(auth())
      .expect(200)
      .expect(({ body }) => {
        expect(body.deliveries).toHaveLength(1);
        expect(body.deliveries[0].status).toBe("sent");
        expect(body.deliveries[0].provider).toBe("fcm");
        expect(body.deliveries[0].pushDeviceTokenId).toContain("push_device_");
      });
  });

  it("accepts privacy-safe product analytics and rejects private content attributes", async () => {
    const app = createTestApp();

    await request(app)
      .post("/v1/analytics/events")
      .set(auth())
      .send({
        events: [{
          sessionId: "session-test-123",
          eventName: "screen_viewed",
          screen: "home",
          action: "open",
          result: "success",
          sequence: 1,
          appVersion: "0.1.0",
          buildType: "debug",
          attributes: {
            calls_count: 2,
            topics_count: 1,
            has_active_call: false
          },
          occurredAt: "2026-06-02T12:00:00.000Z"
        }]
      })
      .expect(202)
      .expect(({ body }) => {
        expect(body.accepted).toBe(1);
      });

    await request(app)
      .post("/v1/analytics/events")
      .set(auth())
      .send({
        events: [{
          sessionId: "session-test-123",
          eventName: "screen_viewed",
          screen: "search",
          attributes: {
            search_query: "private medical appointment"
          }
        }]
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("unsafe_analytics_attribute");
      });
  });

  it("does not create Stripe setup sessions when Stripe is not configured", async () => {
    const app = createTestApp();

    await request(app)
      .post("/v1/billing/checkout-session")
      .set(auth())
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("stripe_not_configured");
      });
  });

  it("does not expose invoices when billing provider is not configured", async () => {
    const app = createTestApp();

    await request(app)
      .get("/v1/billing/invoices")
      .set(auth())
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("billing_customer_missing");
      });
  });

  it("requires Firebase auth for user APIs", async () => {
    const app = createTestApp();

    await request(app).get("/v1/me").expect(401);
    await request(app)
      .get("/v1/me")
      .set(auth())
      .expect(200)
      .expect(({ body }) => {
        expect(body.user.userId).toBe("firebase_daryl");
      });
  });

  it("does not expose bootstrap signup or development phone verification endpoints", async () => {
    const app = createTestApp();

    await request(app).post("/auth/bootstrap").send({ displayName: "Maya" }).expect(404);
    await request(app).post("/v1/onboarding/phone-verification/start").set(auth()).expect(404);
    await request(app).post("/v1/onboarding/phone-verification/complete").set(auth()).send({ code: "000000" }).expect(404);
  });

  it("scopes agent notes to the authenticated user", async () => {
    const app = createTestApp();

    const note = await request(app)
      .post("/v1/agent-notes")
      .set(auth("maya", "+15550001111", "Maya"))
      .send({ text: "Tell my contractor I approved the framing change." })
      .expect(201);

    await request(app)
      .get("/v1/agent-notes")
      .set(auth("noah", "+15550002222", "Noah"))
      .expect(200)
      .expect(({ body }) => {
        expect(body.notes).toEqual([]);
      });

    await request(app)
      .patch(`/v1/agent-notes/${note.body.note.id}`)
      .set(auth("noah", "+15550002222", "Noah"))
      .send({ text: "changed by the wrong user" })
      .expect(404);
  });

  it("prevents authenticated users from reading another user's topic", async () => {
    const app = createTestApp();

    const topic = await request(app)
      .post("/v1/topics")
      .set(auth("maya", "+15550001111", "Maya"))
      .send({ title: "Basement Project" })
      .expect(201);

    await request(app)
      .get(`/v1/topics/${topic.body.topic.id}`)
      .set(auth("noah", "+15550002222", "Noah"))
      .expect(404);
  });

  it("stores assistant customization and injects it into Retell call context", async () => {
    const app = createTestApp(testEnv, undefined, {
      initialUserConfigs: [
        seededUserConfig({
          uid: "maya",
          phoneNumber: "+15550001111",
          displayName: "Maya",
          assistantPhoneNumber: "+15559990000",
          voiceAgentId: "agent_maya"
        })
      ]
    });
    const mayaAuth = auth("maya", "+15550001111", "Maya");

    await request(app)
      .patch("/v1/me/assistant-profile")
      .set(mayaAuth)
      .send({
        assistantName: "Clara",
        greetingStyle: "formal",
        disclosureStyle: "explicit",
        warmth: 2,
        brevity: 5,
        proactivity: 2,
        calendarPolicy: "free_busy_only"
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.assistantProfile.assistantName).toBe("Clara");
        expect(body.assistantProfile.profileVersion).toBe(2);
      });

    const inbound = await request(app)
      .post("/webhooks/retell/inbound")
      .set("content-type", "application/json")
      .send({
        event: "call_inbound",
        call_inbound: {
          from_number: "+15552223333",
          to_number: "+15559990000"
        }
      })
      .expect(200);

    const variables = inbound.body.call_inbound.dynamic_variables;
    expect(inbound.body.call_inbound.override_agent_id).toBe("agent_maya");
    expect(variables.user_display_name).toBe("Maya");
    expect(variables.assistant_name).toBe("Clara");
    expect(variables.assistant_greeting_style).toBe("formal");
    expect(variables.disclosure_policy).toContain("Clara");
    expect(variables.tool_policy).toContain("do not create calendar events");
  });

  it("blocks assistant-number provisioning until the account is allowed", async () => {
    const app = createTestApp({ ...testEnv, SELF_SERVE_RETELL_PROVISIONING: false });

    await request(app)
      .patch("/v1/me/assistant-profile")
      .set(auth("maya", "+15550001111", "Maya"))
      .send({ assistantName: "Clara" })
      .expect(200);

    await request(app)
      .post("/v1/onboarding/assistant-number")
      .set(auth("maya", "+15550001111", "Maya"))
      .send({ areaCode: 914 })
      .expect(403)
      .expect(({ body }) => {
        expect(body.error.code).toBe("assistant_number_provisioning_not_allowed");
      });
  });

  it("blocks paid assistant-number provisioning when billing is required but inactive", async () => {
    const app = createTestApp({
      ...testEnv,
      SELF_SERVE_RETELL_PROVISIONING: true,
      BILLING_REQUIRED_FOR_PROVISIONING: true,
      APP_PUBLIC_BASE_URL: "https://example.com"
    });

    await request(app)
      .patch("/v1/me/assistant-profile")
      .set(auth("maya", "+15550001111", "Maya"))
      .send({ assistantName: "Clara" })
      .expect(200);

    await request(app)
      .post("/v1/onboarding/assistant-number")
      .set(auth("maya", "+15550001111", "Maya"))
      .send({ areaCode: 914 })
      .expect(403)
      .expect(({ body }) => {
        expect(body.error.code).toBe("billing_payment_required");
      });
  });

  it("assigns assistant numbers idempotently without exposing provider routing details", async () => {
    const voiceNumberProvider = new FakeVoiceNumberProvider();
    const app = createTestApp(testEnv, undefined, { voiceNumberProvider });

    queuedAssistantNumbers.push("+19145550100");
    await request(app)
      .patch("/v1/me/assistant-profile")
      .set(auth("maya", "+19145551111", "Maya"))
      .send({ assistantName: "Clara" })
      .expect(200);

    await request(app)
      .post("/v1/onboarding/assistant-number")
      .set(auth("maya", "+19145551111", "Maya"))
      .send({})
      .expect(200)
      .expect(({ body }) => {
        expect(body.assignment.assistantPhoneNumber).toBe("+19145550100");
        expect(body.assignment.alreadyAssigned).toBe(false);
        expect(body.user.phoneRouting.assistantPhoneNumber).toBe("+19145550100");
        expect(JSON.stringify(body)).not.toContain("retellPhoneNumber");
        expect(JSON.stringify(body)).not.toContain("voiceAgentId");
        expect(JSON.stringify(body)).not.toContain("providerNumberType");
      });

    await request(app)
      .post("/v1/onboarding/assistant-number")
      .set(auth("maya", "+19145551111", "Maya"))
      .send({})
      .expect(200)
      .expect(({ body }) => {
        expect(body.assignment.assistantPhoneNumber).toBe("+19145550100");
        expect(body.assignment.alreadyAssigned).toBe(true);
      });

    expect(voiceNumberProvider.purchased).toHaveLength(1);
    expect(voiceNumberProvider.purchased[0]?.areaCode).toBe(914);
  });

  it("does not retry ambiguous assistant-number provisioning without operator review", async () => {
    const voiceNumberProvider = new TimeoutVoiceNumberProvider();
    const app = createTestApp(testEnv, undefined, { voiceNumberProvider });

    await request(app)
      .patch("/v1/me/assistant-profile")
      .set(auth("maya", "+19145551111", "Maya"))
      .send({ assistantName: "Clara" })
      .expect(200);

    await request(app)
      .post("/v1/onboarding/assistant-number")
      .set(auth("maya", "+19145551111", "Maya"))
      .send({})
      .expect(409)
      .expect(({ body }) => {
        expect(body.error.code).toBe("assistant_number_needs_operator_review");
      });

    await request(app)
      .post("/v1/onboarding/assistant-number")
      .set(auth("maya", "+19145551111", "Maya"))
      .send({})
      .expect(409)
      .expect(({ body }) => {
        expect(body.error.code).toBe("assistant_number_needs_operator_review");
      });

    expect(voiceNumberProvider.purchased).toHaveLength(1);
  });

  it("rejects client-supplied assistant number overrides during provisioning", async () => {
    const app = createTestApp();

    await request(app)
      .patch("/v1/me/assistant-profile")
      .set(auth("maya", "+19145551111", "Maya"))
      .send({ assistantName: "Clara" })
      .expect(200);

    await request(app)
      .post("/v1/onboarding/assistant-number")
      .set(auth("maya", "+19145551111", "Maya"))
      .send({ phoneNumber: "+19145550100" })
      .expect(400);
  });

  it("stores Retell call events for call history", async () => {
    const app = createTestApp();
    await assignDefaultRoute(app);

    await request(app)
      .post("/webhooks/retell/events")
      .set("content-type", "application/json")
      .send({
        event: "call_started",
        call: {
          call_id: "call_123",
          direction: "inbound",
          from_number: "+15551230000",
          to_number: "+15557650000",
          agent_id: "agent_default",
          call_status: "ongoing"
        }
      })
      .expect(204);

    await request(app)
      .post("/webhooks/retell/events")
      .set("content-type", "application/json")
      .send({
        event: "call_analyzed",
        call: {
          call_id: "call_123",
          direction: "inbound",
          from_number: "+15551230000",
          to_number: "+15557650000",
          agent_id: "agent_default",
          call_status: "ended",
          transcript: "Please call me back.",
          call_analysis: {
            call_summary: "Caller requested a callback.",
            call_successful: true,
            custom_analysis_data: {
              caller_name: "Greg Floyd",
              caller_organization: "Floyd Landscaping",
              caller_intent: "Schedule landscaping work.",
              requested_follow_up: "Call Greg back.",
              callback_number: "5552223333",
              urgency: "low"
            }
          }
        }
      })
      .expect(204);

    await request(app)
      .get("/v1/calls")
      .set(auth())
      .expect(200)
      .expect(({ body }) => {
        expect(body.calls).toHaveLength(1);
        expect(body.calls[0].providerCallId).toBe("call_123");
        expect(body.calls[0].status).toBe("completed");
        expect(body.calls[0].summary.text).toBe("Caller requested a callback.");
      });

    await request(app)
      .get("/v1/callers")
      .set(auth())
      .expect(200)
      .expect(({ body }) => {
        expect(body.callers).toHaveLength(1);
        expect(body.callers[0].displayName).toBe("Greg Floyd");
        expect(body.callers[0].organization).toBe("Floyd Landscaping");
        expect(body.callers[0].memories.some((memory: { text: string }) => memory.text.includes("Schedule landscaping"))).toBe(true);
      });
  });

  it("scopes call history to the authenticated user's assistant number", async () => {
    const app = createTestApp();
    await assignDefaultRoute(app, "maya", "+15550001111", "Maya", "+15559990001");
    await assignDefaultRoute(app, "noah", "+15550002222", "Noah", "+15559990002");

    await request(app)
      .post("/webhooks/retell/events")
      .set("content-type", "application/json")
      .send({
        event: "call_analyzed",
        call: {
          call_id: "call_maya_private",
          direction: "inbound",
          from_number: "+15551230000",
          to_number: "+15559990001",
          agent_id: "agent_default",
          call_status: "ended",
          transcript: "Maya's caller asked about the basement.",
          call_analysis: {
            call_summary: "Caller asked Maya about the basement.",
            custom_analysis_data: {
              caller_name: "Greg",
              caller_intent: "Discuss basement work.",
              urgency: "normal"
            }
          }
        }
      })
      .expect(204);

    await request(app)
      .post("/webhooks/retell/events")
      .set("content-type", "application/json")
      .send({
        event: "call_analyzed",
        call: {
          call_id: "call_noah_private",
          direction: "inbound",
          from_number: "+15553334444",
          to_number: "+15559990002",
          agent_id: "agent_default",
          call_status: "ended",
          transcript: "Noah's caller asked about recruiting.",
          call_analysis: {
            call_summary: "Caller asked Noah about recruiting.",
            custom_analysis_data: {
              caller_name: "Sam",
              caller_intent: "Discuss recruiting.",
              urgency: "low"
            }
          }
        }
      })
      .expect(204);

    await request(app)
      .get("/v1/calls")
      .set(auth("maya", "+15550001111", "Maya"))
      .expect(200)
      .expect(({ body }) => {
        expect(body.calls.map((call: { providerCallId: string }) => call.providerCallId)).toEqual(["call_maya_private"]);
      });

    await request(app)
      .get("/v1/calls")
      .set(auth("noah", "+15550002222", "Noah"))
      .expect(200)
      .expect(({ body }) => {
        expect(body.calls.map((call: { providerCallId: string }) => call.providerCallId)).toEqual(["call_noah_private"]);
      });
  });

  it("ignores duplicate Retell analyzed events before recording usage twice", async () => {
    const app = createTestApp();
    await assignDefaultRoute(app);
    const analyzedPayload = {
      event: "call_analyzed",
      call: {
        call_id: "call_duplicate",
        direction: "inbound",
        from_number: "+15551230000",
        to_number: "+15557650000",
        agent_id: "agent_default",
        call_status: "ended",
        start_timestamp: Date.now() - 30_000,
        end_timestamp: Date.now(),
        transcript: "Testing duplicate delivery.",
        call_analysis: {
          call_summary: "Caller tested duplicate delivery.",
          call_successful: true,
          custom_analysis_data: {
            caller_name: "Greg Floyd",
            caller_intent: "Test duplicate webhook delivery.",
            urgency: "low"
          }
        }
      }
    };

    await request(app)
      .post("/webhooks/retell/events")
      .set("content-type", "application/json")
      .send(analyzedPayload)
      .expect(204);

    await request(app)
      .post("/webhooks/retell/events")
      .set("content-type", "application/json")
      .send(analyzedPayload)
      .expect(204);

    await request(app)
      .get("/v1/billing/usage")
      .set(auth())
      .expect(200)
      .expect(({ body }) => {
        expect(body.usage.callMinutes).toBe(1);
      });

    await request(app)
      .get("/v1/notifications?unread=true")
      .set(auth())
      .expect(200)
      .expect(({ body }) => {
        expect(body.notifications.filter((notification: { type: string }) => notification.type === "call_summary")).toHaveLength(1);
      });
  });

  it("stores Retell calls as generic communication items", async () => {
    const app = createTestApp();
    await assignDefaultRoute(app);

    await request(app)
      .post("/webhooks/retell/events")
      .set("content-type", "application/json")
      .send({
        event: "call_analyzed",
        call: {
          call_id: "call_communication_123",
          direction: "inbound",
          from_number: "+15551230000",
          to_number: "+15557650000",
          agent_id: "agent_default",
          call_status: "ended",
          transcript: "The contractor asked whether the basement estimate includes permits.",
          call_analysis: {
            call_summary: "Contractor asked whether the basement estimate includes permits.",
            custom_analysis_data: {
              caller_name: "Greg Floyd",
              caller_intent: "Basement estimate question.",
              urgency: "normal"
            }
          }
        }
      })
      .expect(204);

    await request(app)
      .get("/v1/communications")
      .set(auth())
      .expect(200)
      .expect(({ body }) => {
        expect(body.communicationItems).toHaveLength(1);
        expect(body.communicationItems[0].channel).toBe("phone_call");
        expect(body.communicationItems[0].sourceProvider).toBe("retell");
        expect(body.communicationItems[0].providerItemId).toBe("call_communication_123");
        expect(body.communicationItems[0].sender.displayName).toBe("Greg Floyd");
        expect(body.communicationItems[0].summary).toContain("basement estimate");
      });

    await request(app)
      .get("/v1/notifications")
      .set(auth())
      .expect(200)
      .expect(({ body }) => {
        expect(body.notifications.some((notification: { type: string }) => notification.type === "call_summary")).toBe(true);
        const summary = body.notifications.find((notification: { type: string }) => notification.type === "call_summary");
        expect(summary.body).toBe("The assistant summarized a call.");
        expect(JSON.stringify(summary)).not.toContain("contractor asked whether");
      });
  });

  it("uses Retell forwarding number mapping for communication item ownership", async () => {
    const app = createTestApp();
    await assignDefaultRoute(app, "mapped", "+15551230000", "Mapped User", "+15551230000");

    await request(app)
      .post("/webhooks/retell/events")
      .set("content-type", "application/json")
      .send({
        event: "call_analyzed",
        call: {
          call_id: "call_user_mapping_123",
          direction: "inbound",
          from_number: "+15551230000",
          to_number: "+15551230000",
          agent_id: "agent_default",
          call_status: "ended",
          transcript: "Please call me back.",
          call_analysis: {
            call_summary: "Caller requested a callback."
          }
        }
      })
      .expect(204);

    await request(app)
      .get("/v1/communications")
      .set(auth("mapped", "+15551230000", "Mapped User"))
      .expect(200)
      .expect(({ body }) => {
        expect(body.communicationItems).toHaveLength(1);
        expect(body.communicationItems[0].userId).toBe("firebase_mapped");
      });
  });

  it("creates topic threads and attaches communication items with structured state", async () => {
    const app = createTestApp();
    await assignDefaultRoute(app);

    await request(app)
      .post("/webhooks/retell/events")
      .set("content-type", "application/json")
      .send({
        event: "call_analyzed",
        call: {
          call_id: "call_topic_123",
          direction: "inbound",
          from_number: "+15551230000",
          to_number: "+15557650000",
          agent_id: "agent_default",
          call_status: "ended",
          transcript: "Framing is approved, but plumbing cost is unclear.",
          call_analysis: {
            call_summary: "Caller said framing is approved and plumbing cost needs clarification."
          }
        }
      })
      .expect(204);

    const communicationsResponse = await request(app).get("/v1/communications").set(auth()).expect(200);
    const communicationItemId = communicationsResponse.body.communicationItems[0].id;

    const topicResponse = await request(app)
      .post("/v1/topics")
      .set(auth())
      .send({
        title: "Basement Project",
        description: "Renovation coordination",
        participantIds: ["participant_contractor"]
      })
      .expect(201);
    const topicThreadId = topicResponse.body.topic.id;

    await request(app)
      .post(`/v1/topics/${topicThreadId}/communications`)
      .set(auth())
      .send({
        communicationItemId,
        confidence: 1,
        reason: "Manual user attachment."
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.topic.communicationItemIds).toContain(communicationItemId);
        expect(body.topic.timeline[0].communicationItemId).toBe(communicationItemId);
      });

    await request(app)
      .post(`/v1/topics/${topicThreadId}/decisions`)
      .set(auth())
      .send({
        title: "Framing approved",
        sourceCommunicationItemIds: [communicationItemId]
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.decision.title).toBe("Framing approved");
      });

    await request(app)
      .post(`/v1/topics/${topicThreadId}/open-questions`)
      .set(auth())
      .send({
        question: "Does the plumbing cost include permits?",
        sourceCommunicationItemIds: [communicationItemId]
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.openQuestion.status).toBe("open");
      });

    await request(app)
      .post(`/v1/topics/${topicThreadId}/tasks`)
      .set(auth())
      .send({
        title: "Ask contractor for written plumbing estimate",
        sourceCommunicationItemIds: [communicationItemId]
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.task.status).toBe("open");
      });

    await request(app)
      .get(`/v1/topics/${topicThreadId}`)
      .set(auth())
      .expect(200)
      .expect(({ body }) => {
        expect(body.topic.title).toBe("Basement Project");
        expect(body.topic.decisions).toHaveLength(1);
        expect(body.topic.openQuestions).toHaveLength(1);
        expect(body.topic.tasks).toHaveLength(1);
        expect(body.topic.communicationCount).toBe(1);
        expect(body.topic.timeline).toHaveLength(1);
        expect(body.topic.timeline[0].communicationItemId).toBe(communicationItemId);
        expect(body.topic.timeline[0].title).toContain("Call from");
        expect(body.topic.timeline[0].summary).toContain("framing is approved");
      });

    await request(app)
      .get("/v1/topics")
      .set(auth())
      .expect(200)
      .expect(({ body }) => {
        const topic = body.topics.find((candidate: { id: string }) => candidate.id === topicThreadId);
        expect(topic.timeline).toHaveLength(1);
        expect(topic.timeline[0].communicationItemId).toBe(communicationItemId);
      });

    await request(app)
      .get(`/v1/communications/${communicationItemId}`)
      .set(auth())
      .expect(200)
      .expect(({ body }) => {
        expect(body.communicationItem.topicAssociations[0].topicThreadId).toBe(topicThreadId);
        expect(body.communicationItem.topicAssociations[0].mode).toBe("manual");
      });
  });

  it("does not create topic suggestions without a configured classifier", async () => {
    const app = createTestApp();
    await assignDefaultRoute(app);

    await request(app)
      .post("/v1/topics")
      .set(auth())
      .send({
        title: "Basement Project",
        description: "Renovation coordination with contractor, permits, plumbing, and estimate questions."
      })
      .expect(201);

    await request(app)
      .post("/webhooks/retell/events")
      .set("content-type", "application/json")
      .send({
        event: "call_analyzed",
        call: {
          call_id: "call_topic_suggestion_123",
          direction: "inbound",
          from_number: "+15551230000",
          to_number: "+15557650000",
          agent_id: "agent_default",
          call_status: "ended",
          transcript: "Does the basement estimate include permits? The contractor said plumbing was approved.",
          call_analysis: {
            call_summary: "Contractor called about the Basement Project. Does the basement estimate include permits? Plumbing was approved.",
            custom_analysis_data: {
              caller_name: "Greg Floyd",
              caller_intent: "Basement permit estimate question.",
              urgency: "normal"
            }
          }
        }
      })
      .expect(204);

    const suggestionsResponse = await request(app)
      .get("/v1/topic-suggestions")
      .set(auth())
      .expect(200);
    expect(suggestionsResponse.body.suggestions).toHaveLength(0);

    const communicationsResponse = await request(app).get("/v1/communications").set(auth()).expect(200);
    const communicationItem = communicationsResponse.body.communicationItems[0];
    expect(communicationItem.topicAssociations).toHaveLength(0);
    expect(communicationItem.extractedOpenQuestions).toHaveLength(0);
    expect(communicationItem.extractedDecisions).toHaveLength(0);
  });

  it("returns the current active call with caller memory", async () => {
    const app = createTestApp();
    await assignDefaultRoute(app);

    await request(app)
      .post("/webhooks/retell/events")
      .set("content-type", "application/json")
      .send({
        event: "call_analyzed",
        call: {
          call_id: "call_memory_seed",
          direction: "inbound",
          from_number: "+15551230000",
          to_number: "+15557650000",
          agent_id: "agent_default",
          call_status: "ended",
          transcript: "It is Maya.",
          call_analysis: {
            call_summary: "Maya called previously.",
            custom_analysis_data: {
              caller_name: "Maya",
              caller_intent: "Personal check-in.",
              urgency: "normal"
            }
          }
        }
      })
      .expect(204);

    await request(app)
      .post("/webhooks/retell/events")
      .set("content-type", "application/json")
      .send({
        event: "call_started",
        call: {
          call_id: "call_active_123",
          direction: "inbound",
          from_number: "+15551230000",
          to_number: "+15557650000",
          agent_id: "agent_default",
          call_status: "ongoing",
          start_timestamp: Date.now(),
          retell_llm_dynamic_variables: {
            caller_name: "Maya"
          }
        }
      })
      .expect(204);

    await request(app)
      .get("/v1/calls/active")
      .set(auth())
      .expect(200)
      .expect(({ body }) => {
        expect(body.activeCall.providerCallId).toBe("call_active_123");
        expect(body.activeCall.callerName).toBe("Maya");
        expect(body.activeCall.callerNumber).toBe("+15551230000");
        expect(body.activeCall.substate).toBe("agent_on_call");
        expect(body.activeCall.stale).toBe(false);
      });

    await request(app)
      .get("/v1/notifications?unread=true")
      .set(auth())
      .expect(200)
      .expect(({ body }) => {
        const liveState = body.notifications.find((notification: { type: string }) => notification.type === "live_call_state");
        expect(liveState.title).toBe("Assistant is on a call");
        expect(liveState.body).toBe("The assistant is handling a call.");
        expect(liveState.target).toBe("assistant");
      });
  });

  it("clears active call after Retell reports it ended", async () => {
    const app = createTestApp();
    await assignDefaultRoute(app);

    await request(app)
      .post("/webhooks/retell/events")
      .set("content-type", "application/json")
      .send({
        event: "call_started",
        call: {
          call_id: "call_active_done_123",
          direction: "inbound",
          from_number: "+15551230000",
          to_number: "+15557650000",
          agent_id: "agent_default",
          call_status: "ongoing"
        }
      })
      .expect(204);

    await request(app).get("/v1/calls/active").set(auth()).expect(200).expect(({ body }) => {
      expect(body.activeCall.providerCallId).toBe("call_active_done_123");
    });

    await request(app)
      .post("/webhooks/retell/events")
      .set("content-type", "application/json")
      .send({
        event: "call_ended",
        call: {
          call_id: "call_active_done_123",
          direction: "inbound",
          from_number: "+15551230000",
          to_number: "+15557650000",
          agent_id: "agent_default",
          call_status: "ended",
          end_timestamp: Date.now()
        }
      })
      .expect(204);

    await request(app).get("/v1/calls/active").set(auth()).expect(200).expect(({ body }) => {
      expect(body.activeCall).toBeNull();
    });

    await request(app)
      .get("/v1/notifications?unread=true")
      .set(auth())
      .expect(200)
      .expect(({ body }) => {
        expect(body.notifications.filter((notification: { type: string }) => notification.type === "live_call_state")).toHaveLength(2);
      });
  });

  it("injects known caller memory into Retell inbound dynamic variables", async () => {
    const app = createTestApp();
    await assignDefaultRoute(app);

    await request(app)
      .post("/webhooks/retell/events")
      .set("content-type", "application/json")
      .send({
        event: "call_analyzed",
        call: {
          call_id: "call_known_123",
          direction: "inbound",
          from_number: "+15551230000",
          to_number: "+15557650000",
          agent_id: "agent_default",
          call_status: "ended",
          transcript: "Landscaping at 3 PM.",
          call_analysis: {
            call_summary: "Greg Floyd called about landscaping at 3 PM.",
            call_successful: true,
            custom_analysis_data: {
              caller_name: "Greg Floyd",
              caller_organization: "Floyd Landscaping",
              caller_intent: "Confirm landscaping time.",
              requested_follow_up: "No follow-up needed.",
              callback_number: "5552223333",
              urgency: "low"
            }
          }
        }
      })
      .expect(204);

    const inboundResponse = await request(app)
      .post("/webhooks/retell/inbound")
      .set("content-type", "application/json")
      .send({
        event: "call_inbound",
        call_inbound: {
          from_number: "+15551230000",
          to_number: "+15557650000"
        }
      })
      .expect(200);

    const variables = inboundResponse.body.call_inbound.dynamic_variables;
    expect(variables.caller_known).toBe("true");
    expect(variables.caller_name).toBe("Greg Floyd");
    expect(variables.opening_line).toBe("Hi Greg, it's Daryl's assistant. Good to hear from you again. What can I help with today?");
    expect(inboundResponse.body.call_inbound.agent_override.retell_llm.begin_message).toBe(variables.opening_line);
    expect(variables.caller_context).toContain("Greg Floyd");
    expect(variables.caller_context).toContain("landscaping");
  });

  it("does not let later call analysis overwrite an existing caller name", async () => {
    const app = createTestApp();
    await assignDefaultRoute(app);

    await request(app)
      .post("/webhooks/retell/events")
      .set("content-type", "application/json")
      .send({
        event: "call_analyzed",
        call: {
          call_id: "call_name_seed_123",
          direction: "inbound",
          from_number: "+15551230000",
          to_number: "+15557650000",
          agent_id: "agent_default",
          call_status: "ended",
          transcript: "Greg called about landscaping.",
          call_analysis: {
            call_summary: "Greg Floyd called about landscaping.",
            call_successful: true,
            custom_analysis_data: {
              caller_name: "Greg Floyd",
              caller_intent: "Confirm landscaping time.",
              urgency: "low"
            }
          }
        }
      })
      .expect(204);

    await request(app)
      .post("/webhooks/retell/events")
      .set("content-type", "application/json")
      .send({
        event: "call_analyzed",
        call: {
          call_id: "call_name_conflict_123",
          direction: "inbound",
          from_number: "+15551230000",
          to_number: "+15557650000",
          agent_id: "agent_default",
          call_status: "ended",
          transcript: "The caller asked for Daryl, and the analyzer mislabeled the caller as Daryl.",
          call_analysis: {
            call_summary: "Daryl called to test the assistant.",
            call_successful: true,
            custom_analysis_data: {
              caller_name: "Daryl",
              caller_intent: "Test the assistant.",
              urgency: "low"
            }
          }
        }
      })
      .expect(204);

    const inboundResponse = await request(app)
      .post("/webhooks/retell/inbound")
      .set("content-type", "application/json")
      .send({
        event: "call_inbound",
        call_inbound: {
          from_number: "+15551230000",
          to_number: "+15557650000"
        }
      })
      .expect(200);

    const variables = inboundResponse.body.call_inbound.dynamic_variables;
    expect(variables.caller_name).toBe("Greg Floyd");
    expect(variables.opening_line).toBe("Hi Greg, it's Daryl's assistant. Good to hear from you again. What can I help with today?");
    expect(variables.opening_line).not.toContain("Hi Daryl");
    expect(variables.caller_context).toContain("Known caller: Greg Floyd");
    expect(variables.caller_context).not.toContain("Caller name is Daryl");
  });

  it("keeps caller names scoped to the owning user", async () => {
    const app = createTestApp();
    await assignDefaultRoute(app, "daryl", "+15557650000", "Daryl", "+15557650000");
    await assignDefaultRoute(app, "maya", "+15550001111", "Maya", "+15559990000");

    await request(app)
      .post("/webhooks/retell/events")
      .set("content-type", "application/json")
      .send({
        event: "call_analyzed",
        call: {
          call_id: "call_daryl_known_caller",
          direction: "inbound",
          from_number: "+15551230000",
          to_number: "+15557650000",
          agent_id: "agent_default",
          call_status: "ended",
          transcript: "Greg called Daryl about landscaping.",
          call_analysis: {
            call_summary: "Greg Floyd called Daryl about landscaping.",
            call_successful: true,
            custom_analysis_data: {
              caller_name: "Greg Floyd",
              caller_intent: "Confirm landscaping time."
            }
          }
        }
      })
      .expect(204);

    await request(app)
      .get("/v1/callers")
      .set(auth("maya", "+15550001111", "Maya"))
      .expect(200)
      .expect(({ body }) => {
        expect(body.callers).toEqual([]);
      });

    const mayaInbound = await request(app)
      .post("/webhooks/retell/inbound")
      .set("content-type", "application/json")
      .send({
        event: "call_inbound",
        call_inbound: {
          from_number: "+15551230000",
          to_number: "+15559990000"
        }
      })
      .expect(200);

    const variables = mayaInbound.body.call_inbound.dynamic_variables;
    expect(variables.caller_known).toBe("false");
    expect(variables.caller_name).toBe("");
    expect(variables.opening_line).toBe("Hi, you've reached Maya's assistant. Who's calling?");
    expect(variables.caller_context).not.toContain("Greg Floyd");
  });

  it("uses synced contacts to identify first-time callers without claiming prior history", async () => {
    const app = createTestApp();
    await assignDefaultRoute(app);

    await request(app)
      .post("/v1/contacts/sync")
      .set(auth())
      .send({
        contacts: [{
          source: "android_contacts",
          sourceContactId: "contact_theresa",
          displayName: "Theresa",
          phoneNumbers: [{ number: "(555) 123-0000", label: "mobile" }]
        }]
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.result.syncedCount).toBe(1);
        expect(body.result.phoneNumberCount).toBe(1);
      });

    await request(app)
      .get("/v1/contacts/status")
      .set(auth())
      .expect(200)
      .expect(({ body }) => {
        expect(body.status.syncedCount).toBe(1);
        expect(body.status.phoneNumberCount).toBe(1);
        expect(body.status.lastSyncedAt).toEqual(expect.any(String));
      });

    const inboundResponse = await request(app)
      .post("/webhooks/retell/inbound")
      .set("content-type", "application/json")
      .send({
        event: "call_inbound",
        call_inbound: {
          from_number: "+15551230000",
          to_number: "+15557650000"
        }
      })
      .expect(200);

    const variables = inboundResponse.body.call_inbound.dynamic_variables;
    expect(variables.caller_known).toBe("true");
    expect(variables.caller_identity_source).toBe("contact");
    expect(variables.caller_name).toBe("Theresa");
    expect(variables.opening_line).toBe("Hi Theresa, this is Daryl's assistant. What can I help with?");
    expect(variables.opening_line).not.toContain("again");
    expect(variables.caller_context).toContain("Identity source: contact");
  });

  it("keeps synced contact names authoritative when call analysis extracts the wrong caller name", async () => {
    const app = createTestApp();
    await assignDefaultRoute(app);

    await request(app)
      .post("/v1/contacts/sync")
      .set(auth())
      .send({
        contacts: [{
          source: "android_contacts",
          sourceContactId: "contact_theresa",
          displayName: "Theresa",
          phoneNumbers: [{ number: "(555) 123-0000", label: "mobile" }]
        }]
      })
      .expect(200);

    await request(app)
      .post("/webhooks/retell/events")
      .set("content-type", "application/json")
      .send({
        event: "call_analyzed",
        call: {
          call_id: "call_contact_conflict_123",
          direction: "inbound",
          from_number: "+15551230000",
          to_number: "+15557650000",
          agent_id: "agent_default",
          call_status: "ended",
          transcript: "Caller asked for Daryl, but the analyzer incorrectly labeled the caller as Daryl.",
          call_analysis: {
            call_summary: "Daryl called to test the assistant.",
            call_successful: true,
            custom_analysis_data: {
              caller_name: "Daryl",
              caller_intent: "Test the assistant.",
              urgency: "low"
            }
          }
        }
      })
      .expect(204);

    const inboundResponse = await request(app)
      .post("/webhooks/retell/inbound")
      .set("content-type", "application/json")
      .send({
        event: "call_inbound",
        call_inbound: {
          from_number: "+15551230000",
          to_number: "+15557650000"
        }
      })
      .expect(200);

    const variables = inboundResponse.body.call_inbound.dynamic_variables;
    expect(variables.caller_known).toBe("true");
    expect(variables.caller_identity_source).toBe("contact");
    expect(variables.caller_name).toBe("Theresa");
    expect(variables.opening_line).toBe("Hi Theresa, it's Daryl's assistant. Good to hear from you again. What can I help with today?");
    expect(variables.opening_line).not.toContain("Hi Daryl");
    expect(variables.caller_context).toContain("Known caller: Theresa");
    expect(variables.caller_context).toContain("Prior calls: 1");
    expect(variables.caller_context).not.toContain("Caller name is Daryl");
  });

  it("injects active user notes into Retell inbound dynamic variables", async () => {
    const app = createTestApp();
    await assignDefaultRoute(app);

    await request(app)
      .post("/v1/agent-notes")
      .set(auth())
      .send({
        text: "If Maya calls about dinner, tell her I will leave work at 6:15.",
        targetPhoneNumber: "+15551230000",
        targetCallerName: "Maya",
        topic: "dinner"
      })
      .expect(201);

    const inboundResponse = await request(app)
      .post("/webhooks/retell/inbound")
      .set("content-type", "application/json")
      .send({
        event: "call_inbound",
        call_inbound: {
          from_number: "+15551230000",
          to_number: "+15557650000"
        }
      })
      .expect(200);

    const variables = inboundResponse.body.call_inbound.dynamic_variables;
    expect(variables.active_agent_notes).toContain("6:15");
    expect(variables.caller_context).toContain("Active user notes");
  });

  it("uses user-updated relationship labels in the next caller context pack", async () => {
    const app = createTestApp();
    await assignDefaultRoute(app);

    await request(app)
      .post("/webhooks/retell/events")
      .set("content-type", "application/json")
      .send({
        event: "call_analyzed",
        call: {
          call_id: "call_family_123",
          direction: "inbound",
          from_number: "+15559870000",
          to_number: "+15557650000",
          agent_id: "agent_default",
          call_status: "ended",
          transcript: "It is Mom. Please ask Daryl to call me.",
          call_analysis: {
            call_summary: "Caller asked Daryl to call back.",
            custom_analysis_data: {
              caller_name: "Mom",
              caller_intent: "Requested a callback.",
              requested_follow_up: "Call Mom back.",
              urgency: "normal"
            }
          }
        }
      })
      .expect(204);

    const callersResponse = await request(app).get("/v1/callers").set(auth()).expect(200);
    const callerId = callersResponse.body.callers[0].id;

    await request(app)
      .patch(`/v1/callers/${callerId}`)
      .set(auth())
      .send({ relationship: "family", trustLevel: "trusted" })
      .expect(200);

    const inboundResponse = await request(app)
      .post("/webhooks/retell/inbound")
      .set("content-type", "application/json")
      .send({
        event: "call_inbound",
        call_inbound: {
          from_number: "+15559870000",
          to_number: "+15557650000"
        }
      })
      .expect(200);

    const variables = inboundResponse.body.call_inbound.dynamic_variables;
    expect(variables.caller_relationship).toBe("family");
    expect(variables.caller_trust_level).toBe("trusted");
    expect(variables.opening_line).toBe("Hey Mom, it's Daryl's assistant. Good to hear from you. What's up?");
    expect(variables.routing_policy).toContain("trusted caller");
  });

  it("requires a configured Retell API key before creating outbound calls", async () => {
    const app = createTestApp();

    await request(app)
      .post("/v1/outbound-calls")
      .set(auth())
      .send({
        approved: true,
        fromNumber: "+15551230000",
        toNumber: "+15557650000",
        reason: "Test call."
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("retell_api_key_missing");
      });
  });

  it("blocks outbound calls when billing is required but inactive", async () => {
    const app = createTestApp({ ...testEnv, BILLING_REQUIRED_FOR_PROVISIONING: true });

    await request(app)
      .post("/v1/outbound-calls")
      .set(auth())
      .send({
        approved: true,
        fromNumber: "+15551230000",
        toNumber: "+15557650000",
        reason: "Test call."
      })
      .expect(403)
      .expect(({ body }) => {
        expect(body.error.code).toBe("billing_payment_required");
      });
  });

  it("reports Google Calendar connection status and requires OAuth configuration for connect urls", async () => {
    const app = createTestApp();

    await request(app)
      .get("/v1/calendar/status")
      .set(auth())
      .expect(200)
      .expect(({ body }) => {
        expect(body.configured).toBe(false);
        expect(body.connected).toBe(false);
        expect(body.scopes).toContain("https://www.googleapis.com/auth/calendar.freebusy");
      });

    await request(app)
      .get("/v1/calendar/connect-url")
      .set(auth())
      .expect(400);
  });

  it("requires a signed Google Calendar OAuth state before linking an account", async () => {
    const app = createTestApp({
      ...testEnv,
      GOOGLE_OAUTH_CLIENT_ID: "client-id",
      GOOGLE_OAUTH_CLIENT_SECRET: "client-secret",
      GOOGLE_OAUTH_REDIRECT_URI: "https://example.com/oauth/google/calendar/callback",
      GOOGLE_OAUTH_STATE_SECRET: "state-secret"
    });

    await request(app)
      .get("/v1/calendar/connect-url")
      .set(auth())
      .expect(200)
      .expect(({ body }) => {
        expect(body.url).toContain("state=");
        expect(body.url).toContain("calendar.freebusy");
      });

    await request(app)
      .get("/oauth/google/calendar/callback?code=fake-code")
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("google_oauth_state_missing");
      });
  });

  it("returns unavailable from calendar tools until Google Calendar is connected", async () => {
    const app = createTestApp({
      ...testEnv,
      GOOGLE_OAUTH_CLIENT_ID: "client-id",
      GOOGLE_OAUTH_CLIENT_SECRET: "client-secret",
      GOOGLE_OAUTH_REDIRECT_URI: "https://example.com/oauth/google/calendar/callback"
    });

    await request(app)
      .post("/tools/retell/check-calendar-freebusy")
      .set("content-type", "application/json")
      .send({
        name: "check_calendar_freebusy",
        call: {
          retell_llm_dynamic_variables: {
            phone_agent_user_id: "firebase_daryl"
          }
        },
        args: {
          time_min: "2026-05-27T13:00:00-04:00",
          time_max: "2026-05-27T14:00:00-04:00",
          time_zone: "America/New_York"
        }
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.connected).toBe(false);
        expect(body.status).toBe("unavailable");
      });

    await request(app)
      .post("/tools/retell/request-calendar-event")
      .set("content-type", "application/json")
      .send({
        name: "request_calendar_event",
        call: {
          call_id: "call_calendar_123",
          from_number: "+15551230000",
          retell_llm_dynamic_variables: {
            phone_agent_user_id: "firebase_daryl"
          }
        },
        args: {
          title: "Follow-up call",
          start_time: "2026-05-27T13:00:00-04:00",
          end_time: "2026-05-27T13:30:00-04:00",
          time_zone: "America/New_York"
        }
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe("unavailable");
        expect(body.message).toContain("not connected");
      });

    await request(app)
      .post("/tools/retell/update-calendar-event")
      .set("content-type", "application/json")
      .send({
        name: "update_calendar_event",
        call: {
          call_id: "call_calendar_123",
          from_number: "+15551230000",
          retell_llm_dynamic_variables: {
            phone_agent_user_id: "firebase_daryl"
          }
        },
        args: {
          calendar_event_request_id: "calendar-request-123",
          end_time: "2026-05-27T14:00:00-04:00",
          time_zone: "America/New_York",
          reason: "Caller asked to extend the meeting."
        }
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe("unavailable");
        expect(body.message).toContain("not connected");
      });
  });

  it("returns unavailable from Retell tools when billing is inactive", async () => {
    const app = createTestApp({ ...testEnv, BILLING_REQUIRED_FOR_PROVISIONING: true });

    await request(app)
      .post("/tools/retell/request-transfer")
      .set("content-type", "application/json")
      .send({
        name: "request_live_transfer_approval",
        call: {
          call_id: "call_billing_blocked",
          from_number: "+15551230000",
          retell_llm_dynamic_variables: {
            phone_agent_user_id: "firebase_daryl",
            caller_name: "Greg"
          }
        },
        args: {
          caller_name: "Greg",
          reason: "Greg says this is urgent.",
          urgency: "high"
        }
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe("unavailable");
        expect(body.message).toContain("billing needs attention");
      });

    await request(app)
      .get("/v1/approval-requests")
      .set(auth())
      .expect(200)
      .expect(({ body }) => {
        expect(body.approvalRequests).toEqual([]);
      });
  });

  it("creates approval requests for Retell transfer tools and returns accepted transfer numbers", async () => {
    const app = createTestApp({ ...testEnv, USER_TRANSFER_PHONE_NUMBER: "+15559876543" });

    const toolResponse = request(app)
      .post("/tools/retell/request-transfer")
      .set("content-type", "application/json")
      .send({
        name: "request_live_transfer_approval",
        call: {
          call_id: "call_transfer_123",
          from_number: "+15551230000",
          retell_llm_dynamic_variables: {
            phone_agent_user_id: "firebase_daryl",
            caller_name: "Greg"
          }
        },
        args: {
          caller_name: "Greg",
          reason: "Greg says this is urgent.",
          urgency: "high"
        }
      })
      .expect(200);
    const toolResponsePromise = toolResponse.then((response) => response);

    const approvalList = await waitForPendingApproval(app);
    const approvalRequestId = approvalList.body.approvalRequests[0].id;
    expect(approvalList.body.approvalRequests[0].reason).toBe("Greg says this is urgent.");

    await request(app)
      .get("/v1/notifications?unread=true")
      .set(auth())
      .expect(200)
      .expect(({ body }) => {
        const transfer = body.notifications.find((notification: { type: string }) => notification.type === "live_transfer_request");
        expect(transfer).toBeTruthy();
        expect(transfer.priority).toBe("urgent");
        expect(transfer.body).toBe("A caller needs live attention.");
        expect(JSON.stringify(transfer)).not.toContain("Greg says this is urgent");
      });

    await request(app)
      .post(`/v1/approval-requests/${approvalRequestId}/accept`)
      .set(auth())
      .set("x-phone-agent-action-surface", "notification_action")
      .expect(200)
      .expect(({ body }) => {
        expect(body.approvalRequest.status).toBe("accepted");
      });

    await request(app)
      .post(`/v1/approval-requests/${approvalRequestId}/accept`)
      .set(auth())
      .expect(200)
      .expect(({ body }) => {
        expect(body.approvalRequest.status).toBe("accepted");
      });

    await request(app)
      .get("/v1/notifications?unread=true")
      .set(auth())
      .expect(200)
      .expect(({ body }) => {
        expect(body.notifications.find((notification: { sourceId: string }) => notification.sourceId === approvalRequestId)).toBeUndefined();
      });

    await request(app)
      .get("/v1/notifications/action-audits")
      .set(auth())
      .expect(200)
      .expect(({ body }) => {
        const audit = body.audits.find((item: { sourceId: string; surface: string }) =>
          item.sourceId === approvalRequestId && item.surface === "notification_action"
        );
        expect(audit.action).toBe("accept");
        expect(audit.surface).toBe("notification_action");
        expect(audit.result).toBe("accepted");
      });

    const response = await toolResponsePromise;
    expect(response.body.status).toBe("accepted");
    expect(response.body.transfer_number).toBe("+15559876543");
  });

  it("creates answer requests for Retell tools and returns the user's text reply", async () => {
    const app = createTestApp();

    const toolResponse = request(app)
      .post("/tools/retell/request-user-answer")
      .set("content-type", "application/json")
      .send({
        name: "request_user_answer",
        call: {
          call_id: "call_answer_123",
          from_number: "+15551230000",
          retell_llm_dynamic_variables: {
            phone_agent_user_id: "firebase_daryl",
            caller_name: "Maya"
          }
        },
        args: {
          caller_name: "Maya",
          question: "Maya is asking when you will be home. What should I tell her?",
          reason: "Caller needs a quick factual answer.",
          urgency: "normal"
        }
      })
      .expect(200);
    const toolResponsePromise = toolResponse.then((response) => response);

    const answerList = await waitForPendingAnswer(app);
    const answerRequestId = answerList.body.answerRequests[0].id;
    expect(answerList.body.answerRequests[0].question).toContain("home");

    await request(app)
      .post(`/v1/answer-requests/${answerRequestId}/reply`)
      .set(auth())
      .send({ answer: "Tell her I will be home around 6:15." })
      .expect(200)
      .expect(({ body }) => {
        expect(body.answerRequest.status).toBe("answered");
      });

    const response = await toolResponsePromise;
    expect(response.body.status).toBe("answered");
    expect(response.body.answer).toContain("6:15");
  });

  it("returns an expired transfer state instead of accepting a stale notification action", async () => {
    const app = createTestApp({
      ...testEnv,
      USER_TRANSFER_PHONE_NUMBER: "+15559876543",
      TRANSFER_APPROVAL_TIMEOUT_MS: 500
    });

    const toolResponsePromise = request(app)
      .post("/tools/retell/request-transfer")
      .set("content-type", "application/json")
      .send({
        name: "request_live_transfer_approval",
        call: {
          call_id: "call_transfer_expired",
          from_number: "+15551230000",
          retell_llm_dynamic_variables: {
            phone_agent_user_id: "firebase_daryl",
            caller_name: "Greg"
          }
        },
        args: {
          caller_name: "Greg",
          reason: "Greg says this is urgent.",
          urgency: "high"
        }
      })
      .expect(200)
      .then((response) => response);

    const approvalList = await waitForPendingApproval(app);
    const approvalRequestId = approvalList.body.approvalRequests[0].id;
    await new Promise((resolve) => setTimeout(resolve, 650));

    await request(app)
      .post(`/v1/approval-requests/${approvalRequestId}/accept`)
      .set(auth())
      .expect(409)
      .expect(({ body }) => {
        expect(body.error.code).toBe("approval_request_expired");
      });

    const toolResponse = await toolResponsePromise;
    expect(toolResponse.body.status).toBe("expired");
  });

  it("returns an expired answer state instead of accepting a stale inline reply", async () => {
    const app = createTestApp({ ...testEnv, LIVE_ANSWER_TIMEOUT_MS: 500 });

    const toolResponsePromise = request(app)
      .post("/tools/retell/request-user-answer")
      .set("content-type", "application/json")
      .send({
        name: "request_user_answer",
        call: {
          call_id: "call_answer_expired",
          from_number: "+15551230000",
          retell_llm_dynamic_variables: {
            phone_agent_user_id: "firebase_daryl",
            caller_name: "Maya"
          }
        },
        args: {
          caller_name: "Maya",
          question: "What should I tell her?",
          reason: "Caller needs a quick factual answer.",
          urgency: "normal"
        }
      })
      .expect(200)
      .then((response) => response);

    const answerList = await waitForPendingAnswer(app);
    const answerRequestId = answerList.body.answerRequests[0].id;
    await new Promise((resolve) => setTimeout(resolve, 650));

    await request(app)
      .post(`/v1/answer-requests/${answerRequestId}/reply`)
      .set(auth())
      .send({ answer: "Tell her I will call back." })
      .expect(409)
      .expect(({ body }) => {
        expect(body.error.code).toBe("answer_request_expired");
      });

    const toolResponse = await toolResponsePromise;
    expect(toolResponse.body.status).toBe("expired");
  });
});

async function waitForPendingApproval(app: ReturnType<typeof createApp>) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await request(app).get("/v1/approval-requests").set(auth()).expect(200);
    if (response.body.approvalRequests.length > 0) {
      return response;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Timed out waiting for pending approval request.");
}

async function waitForPendingAnswer(app: ReturnType<typeof createApp>) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await request(app).get("/v1/answer-requests").set(auth()).expect(200);
    if (response.body.answerRequests.length > 0) {
      return response;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Timed out waiting for pending answer request.");
}

