import "dotenv/config";
import { z } from "zod";

const optionalNonEmptyString = z
  .string()
  .optional()
  .transform((value) => (value && value.trim().length > 0 ? value : undefined));

const optionalPositiveInt = (defaultValue: number) =>
  z.preprocess((value) => {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }, z.number().int().positive().default(defaultValue));

const optionalNonnegativeInt = (defaultValue: number) =>
  z.preprocess((value) => {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }, z.number().int().nonnegative().default(defaultValue));

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: optionalPositiveInt(3000),
  LOG_LEVEL: z.string().default("info"),
  PERSISTENCE_DRIVER: z.enum(["memory", "firestore"]).default("memory"),
  FIRESTORE_DATABASE_ID: optionalNonEmptyString,
  FIREBASE_PROJECT_ID: optionalNonEmptyString,
  SELF_SERVE_RETELL_PROVISIONING: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  APP_PUBLIC_BASE_URL: optionalNonEmptyString,
  RETELL_API_KEY: optionalNonEmptyString,
  RETELL_DEFAULT_AGENT_ID: optionalNonEmptyString,
  RETELL_DEFAULT_FROM_NUMBER: optionalNonEmptyString,
  USER_TRANSFER_PHONE_NUMBER: optionalNonEmptyString,
  LIVE_REQUEST_TIMEOUT_MS: optionalPositiveInt(90_000),
  OPENAI_API_KEY: optionalNonEmptyString,
  OPENAI_CLASSIFIER_MODEL: optionalNonEmptyString.default("gpt-4.1-mini"),
  BILLING_PLAN: optionalNonEmptyString.default("beta"),
  BILLING_MONTHLY_INCLUDED_MINUTES: optionalNonnegativeInt(300),
  BILLING_MONTHLY_CLASSIFICATION_LIMIT: optionalNonnegativeInt(1000),
  BILLING_REQUIRED_FOR_PROVISIONING: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  BILLING_DEFAULT_SPENDING_CAP_CENTS: optionalPositiveInt(4000),
  RATE_LIMIT_WINDOW_MS: optionalPositiveInt(60_000),
  RATE_LIMIT_MAX_REQUESTS: optionalPositiveInt(120),
  WEBHOOK_RATE_LIMIT_MAX_REQUESTS: optionalPositiveInt(600),
  STRIPE_SECRET_KEY: optionalNonEmptyString,
  STRIPE_PUBLISHABLE_KEY: optionalNonEmptyString,
  STRIPE_WEBHOOK_SECRET: optionalNonEmptyString,
  STRIPE_PRICE_PERSONAL_MONTHLY: optionalNonEmptyString,
  STRIPE_PRICE_PERSONAL_CALL_MINUTE_OVERAGE: optionalNonEmptyString,
  GOOGLE_OAUTH_CLIENT_ID: optionalNonEmptyString,
  GOOGLE_OAUTH_CLIENT_SECRET: optionalNonEmptyString,
  GOOGLE_OAUTH_REDIRECT_URI: optionalNonEmptyString,
  GOOGLE_OAUTH_STATE_SECRET: optionalNonEmptyString,
  RETELL_INBOUND_WEBHOOK_VERIFY: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true")
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(overrides: NodeJS.ProcessEnv = process.env): AppEnv {
  return envSchema.parse(overrides);
}
