import { describe, expect, it } from "vitest";
import { loadEnv } from "./env.js";

describe("loadEnv", () => {
  it("falls back to defaults for malformed optional numeric settings", () => {
    const env = loadEnv({
      RATE_LIMIT_WINDOW_MS: "60000 RATE_LIMIT_MAX_REQUESTS=120 WEBHOOK_RATE_LIMIT_MAX_REQUESTS=600"
    });

    expect(env.RATE_LIMIT_WINDOW_MS).toBe(60_000);
    expect(env.RATE_LIMIT_MAX_REQUESTS).toBe(120);
    expect(env.WEBHOOK_RATE_LIMIT_MAX_REQUESTS).toBe(600);
  });

  it("parses valid numeric settings", () => {
    const env = loadEnv({
      PORT: "8080",
      RATE_LIMIT_WINDOW_MS: "30000",
      RATE_LIMIT_MAX_REQUESTS: "50",
      WEBHOOK_RATE_LIMIT_MAX_REQUESTS: "200"
    });

    expect(env.PORT).toBe(8080);
    expect(env.RATE_LIMIT_WINDOW_MS).toBe(30_000);
    expect(env.RATE_LIMIT_MAX_REQUESTS).toBe(50);
    expect(env.WEBHOOK_RATE_LIMIT_MAX_REQUESTS).toBe(200);
  });
});
