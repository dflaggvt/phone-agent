import { createHash } from "node:crypto";
import type { Firestore } from "@google-cloud/firestore";
import {
  normalizeGooglePlayEmail,
  type BetaSignup,
  type BetaSignupRepository,
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
      status: existing?.status ?? "pending",
      source: input.source,
      consentVersion: input.consentVersion,
      consentedAt: now,
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
    status: betaSignupStatus(data.status),
    source: "website",
    consentVersion: getString(data.consentVersion) ?? "",
    consentedAt: firestoreDate(data.consentedAt) ?? new Date(0),
    createdAt: firestoreDate(data.createdAt) ?? new Date(0),
    updatedAt: firestoreDate(data.updatedAt) ?? new Date(0)
  };
}

function betaSignupStatus(value: unknown): BetaSignup["status"] {
  return value === "approved" || value === "rejected" ? value : "pending";
}

function betaSignupId(email: string): string {
  return createHash("sha256").update(email).digest("hex");
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}
