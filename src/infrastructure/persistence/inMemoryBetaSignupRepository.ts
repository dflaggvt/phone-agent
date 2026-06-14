import {
  betaSignupId,
  normalizeGooglePlayEmail,
  type BetaSignup,
  type BetaSignupRepository,
  type ApproveBetaSignupInput,
  type CreateBetaSignupInput
} from "../../domain/beta/betaSignup.js";

export class InMemoryBetaSignupRepository implements BetaSignupRepository {
  private readonly signups = new Map<string, BetaSignup>();

  constructor(initialSignups: BetaSignup[] = []) {
    for (const signup of initialSignups) {
      this.signups.set(signup.id, signup);
    }
  }

  async save(input: CreateBetaSignupInput): Promise<BetaSignup> {
    const googlePlayEmail = normalizeGooglePlayEmail(input.googlePlayEmail);
    const id = betaSignupId(googlePlayEmail);
    const now = new Date();
    const existing = this.signups.get(id);
    const signup: BetaSignup = {
      id,
      googlePlayEmail,
      platform: input.platform,
      status: existing?.status ?? "pending",
      source: input.source,
      consentVersion: input.consentVersion,
      consentedAt: now,
      approvedAt: existing?.approvedAt,
      approvedBy: existing?.approvedBy,
      expiresAt: existing?.expiresAt,
      notes: existing?.notes,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };
    this.signups.set(id, signup);
    return signup;
  }

  async getByGooglePlayEmail(email: string): Promise<BetaSignup | undefined> {
    return this.signups.get(betaSignupId(email));
  }

  async approve(input: ApproveBetaSignupInput): Promise<BetaSignup> {
    const googlePlayEmail = normalizeGooglePlayEmail(input.googlePlayEmail);
    const id = betaSignupId(googlePlayEmail);
    const now = input.now ?? new Date();
    const existing = this.signups.get(id);
    const signup: BetaSignup = {
      id,
      googlePlayEmail,
      platform: existing?.platform,
      status: "approved",
      source: existing?.source ?? "website",
      consentVersion: existing?.consentVersion ?? "operator-approved",
      consentedAt: existing?.consentedAt ?? now,
      approvedAt: now,
      approvedBy: input.approvedBy,
      expiresAt: input.expiresAt,
      notes: input.notes,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };
    this.signups.set(id, signup);
    return signup;
  }
}
