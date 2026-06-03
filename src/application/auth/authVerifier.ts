export interface VerifiedAuthUser {
  uid: string;
  displayName?: string;
  email?: string;
  phoneNumber?: string;
}

export interface AuthVerifier {
  verifyIdToken(idToken: string): Promise<VerifiedAuthUser>;
}
