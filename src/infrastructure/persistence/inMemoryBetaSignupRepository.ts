import { createHash } from "node:crypto";
import {
  normalizeGooglePlayEmail,
  type BetaSignup,
  type BetaSignupRepository,
  type CreateBetaSignupInput
} from "../../domain/beta/betaSignup.js";

export class InMemoryBetaSignupRepository implements BetaSignupRepository {
  private readonly signups = new Map<string, BetaSignup>();

  async save(input: CreateBetaSignupInput): Promise<BetaSignup> {
    const googlePlayEmail = normalizeGooglePlayEmail(input.googlePlayEmail);
    const id = betaSignupId(googlePlayEmail);
    const now = new Date();
    const existing = this.signups.get(id);
    const signup: BetaSignup = {
      id,
      googlePlayEmail,
      status: existing?.status ?? "pending",
      source: input.source,
      consentVersion: input.consentVersion,
      consentedAt: now,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };
    this.signups.set(id, signup);
    return signup;
  }
}

function betaSignupId(email: string): string {
  return createHash("sha256").update(email).digest("hex");
}
