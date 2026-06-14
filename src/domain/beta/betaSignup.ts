import { createHash } from "node:crypto";

export type BetaSignupStatus = "pending" | "approved" | "rejected";
export type BetaSignupSource = "website";
export type BetaSignupPlatform = "android" | "iphone" | "other";

export interface BetaSignup {
  id: string;
  googlePlayEmail: string;
  platform?: BetaSignupPlatform;
  status: BetaSignupStatus;
  source: BetaSignupSource;
  consentVersion: string;
  consentedAt: Date;
  approvedAt?: Date;
  approvedBy?: string;
  expiresAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBetaSignupInput {
  googlePlayEmail: string;
  platform: BetaSignupPlatform;
  source: BetaSignupSource;
  consentVersion: string;
}

export interface ApproveBetaSignupInput {
  googlePlayEmail: string;
  approvedBy: string;
  expiresAt?: Date;
  notes?: string;
  now?: Date;
}

export interface BetaSignupRepository {
  save(input: CreateBetaSignupInput): Promise<BetaSignup>;
  getByGooglePlayEmail(email: string): Promise<BetaSignup | undefined>;
  approve(input: ApproveBetaSignupInput): Promise<BetaSignup>;
}

export const CURRENT_BETA_SIGNUP_CONSENT_VERSION = "website-beta-v1";

export function normalizeGooglePlayEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function betaSignupId(email: string): string {
  return createHash("sha256").update(normalizeGooglePlayEmail(email)).digest("hex");
}
