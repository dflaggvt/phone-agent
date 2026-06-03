import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import type { AuthVerifier, VerifiedAuthUser } from "../../application/auth/authVerifier.js";
import { unauthorized } from "../../shared/httpErrors.js";

export class FirebaseAuthVerifier implements AuthVerifier {
  constructor(private readonly projectId?: string) {}

  async verifyIdToken(idToken: string): Promise<VerifiedAuthUser> {
    const app = getApps()[0] ?? initializeApp({
      credential: applicationDefault(),
      projectId: this.projectId
    });
    const decoded = await getAuth(app).verifyIdToken(idToken, true);
    if (!decoded.uid) {
      throw unauthorized("firebase_uid_missing", "Firebase token is missing a user id.");
    }

    return {
      uid: decoded.uid,
      displayName: stringClaim(decoded.name),
      email: stringClaim(decoded.email),
      phoneNumber: stringClaim(decoded.phone_number)
    };
  }
}

function stringClaim(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}
