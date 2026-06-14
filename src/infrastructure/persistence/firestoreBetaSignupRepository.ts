import type { Firestore } from "@google-cloud/firestore";
import {
  betaSignupId,
  normalizeGooglePlayEmail,
  type BetaSignup,
  type BetaSignupRepository,
  type ApproveBetaSignupInput,
  type CreateBetaSignupInput
} from "../../domain/beta/betaSignup.js";
import { firestoreDate, removeUndefinedDeep } from "./firestoreClient.js";

const COLLECTION = "betaSignups";

export class FirestoreBetaSignupRepository implements BetaSignupRepository {
  constructor(private readonly firestore: Firestore) {}

  async save(input: CreateBetaSignupInput): Promise<BetaSignup> {
    const googlePlayEmail = normalizeGooglePlayEmail(input.googlePlayEmail);
    const id = betaSignupId(googlePlayEmail);
    const now = new Date();
    const docRef = this.firestore.collection(COLLECTION).doc(id);
    const snapshot = await docRef.get();
    const existing = snapshot.exists ? betaSignupFromFirestore(snapshot.id, snapshot.data() ?? {}) : undefined;
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
    await docRef.set(removeUndefinedDeep(signup));
    return signup;
  }

  async getByGooglePlayEmail(email: string): Promise<BetaSignup | undefined> {
    const doc = await this.firestore.collection(COLLECTION).doc(betaSignupId(email)).get();
    return doc.exists ? betaSignupFromFirestore(doc.id, doc.data() ?? {}) : undefined;
  }

  async approve(input: ApproveBetaSignupInput): Promise<BetaSignup> {
    const googlePlayEmail = normalizeGooglePlayEmail(input.googlePlayEmail);
    const id = betaSignupId(googlePlayEmail);
    const now = input.now ?? new Date();
    const docRef = this.firestore.collection(COLLECTION).doc(id);
    const snapshot = await docRef.get();
    const existing = snapshot.exists ? betaSignupFromFirestore(snapshot.id, snapshot.data() ?? {}) : undefined;
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
    await docRef.set(removeUndefinedDeep(signup));
    return signup;
  }
}

function betaSignupFromFirestore(id: string, data: Record<string, unknown>): BetaSignup {
  return {
    id,
    googlePlayEmail: getString(data.googlePlayEmail) ?? "",
    platform: betaSignupPlatform(data.platform),
    status: betaSignupStatus(data.status),
    source: "website",
    consentVersion: getString(data.consentVersion) ?? "",
    consentedAt: firestoreDate(data.consentedAt) ?? new Date(0),
    approvedAt: firestoreDate(data.approvedAt),
    approvedBy: getString(data.approvedBy),
    expiresAt: firestoreDate(data.expiresAt),
    notes: getString(data.notes),
    createdAt: firestoreDate(data.createdAt) ?? new Date(0),
    updatedAt: firestoreDate(data.updatedAt) ?? new Date(0)
  };
}

function betaSignupStatus(value: unknown): BetaSignup["status"] {
  return value === "approved" || value === "rejected" ? value : "pending";
}

function betaSignupPlatform(value: unknown): BetaSignup["platform"] {
  return value === "android" || value === "iphone" || value === "other" ? value : undefined;
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}
