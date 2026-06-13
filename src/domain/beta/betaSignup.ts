export type BetaSignupStatus = "pending" | "approved" | "rejected";
export type BetaSignupSource = "website";

export interface BetaSignup {
  id: string;
  googlePlayEmail: string;
  status: BetaSignupStatus;
  source: BetaSignupSource;
  consentVersion: string;
  consentedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBetaSignupInput {
  googlePlayEmail: string;
  source: BetaSignupSource;
  consentVersion: string;
}

export interface BetaSignupRepository {
  save(input: CreateBetaSignupInput): Promise<BetaSignup>;
}

export const CURRENT_BETA_SIGNUP_CONSENT_VERSION = "website-beta-v1";

export function normalizeGooglePlayEmail(email: string): string {
  return email.trim().toLowerCase();
}
