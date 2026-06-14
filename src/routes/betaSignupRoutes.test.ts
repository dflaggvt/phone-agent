import request from "supertest";
import { describe, expect, it } from "vitest";
import express, { type ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { InMemoryBetaSignupRepository } from "../infrastructure/persistence/inMemoryBetaSignupRepository.js";
import { HttpError } from "../shared/httpErrors.js";
import { betaSignupRoutes } from "./betaSignupRoutes.js";

function createPublicBetaSignupApp() {
  const app = express();
  app.use(express.json());
  app.use("/v1/public", betaSignupRoutes({ betaSignups: new InMemoryBetaSignupRepository() }));
  app.use(errorHandler);
  return app;
}

describe("betaSignupRoutes", () => {
  it("accepts a minimal beta signup without authentication", async () => {
    await request(createPublicBetaSignupApp())
      .post("/v1/public/beta-signups")
      .send({
        email: "Tester@Example.com",
        platform: "android",
        consent: true
      })
      .expect(202, { status: "pending" });
  });

  it("requires a phone platform", async () => {
    const response = await request(createPublicBetaSignupApp())
      .post("/v1/public/beta-signups")
      .send({
        email: "tester@example.com",
        consent: true
      })
      .expect(400);

    expect(response.body.error.code).toBe("validation_failed");
  });

  it("requires explicit consent", async () => {
    const response = await request(createPublicBetaSignupApp())
      .post("/v1/public/beta-signups")
      .send({
        email: "tester@example.com",
        platform: "iphone",
        consent: false
      })
      .expect(400);

    expect(response.body.error.code).toBe("validation_failed");
  });
});

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
    return;
  }
  if (error instanceof ZodError) {
    res.status(400).json({ error: { code: "validation_failed", message: "Request validation failed." } });
    return;
  }
  res.status(500).json({ error: { code: "internal_error", message: "Unexpected error." } });
};
