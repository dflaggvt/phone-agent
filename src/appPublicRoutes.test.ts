import request from "supertest";
import { describe, it } from "vitest";
import { createApp } from "./app.js";
import type { AppEnv } from "./config/env.js";
import { createLogger } from "./shared/logger.js";

const testEnv: AppEnv = {
  NODE_ENV: "test",
  PORT: 3000,
  LOG_LEVEL: "silent",
  PERSISTENCE_DRIVER: "memory",
  FIREBASE_PROJECT_ID: "phone-agent-test",
  SELF_SERVE_RETELL_PROVISIONING: false,
  APP_PUBLIC_BASE_URL: "https://example.com",
  RETELL_API_KEY: undefined,
  RETELL_DEFAULT_AGENT_ID: "agent_default",
  RETELL_DEFAULT_FROM_NUMBER: "+15551230000",
  USER_TRANSFER_PHONE_NUMBER: undefined,
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

describe("public app routes", () => {
  it("accepts beta signups without Firebase auth", async () => {
    const app = createApp({
      env: testEnv,
      logger: createLogger("silent")
    });

    await request(app)
      .post("/v1/public/beta-signups")
      .send({
        googlePlayEmail: "tester@example.com",
        consent: true
      })
      .expect(202, { status: "pending" });
  });
});
