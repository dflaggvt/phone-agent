import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import type { AuthAccountAdmin } from "../../application/accounts/accountRemovalService.js";

export class FirebaseAccountAdmin implements AuthAccountAdmin {
  constructor(private readonly projectId?: string) {}

  async deleteUser(firebaseUid: string): Promise<void> {
    const app = getApps()[0] ?? initializeApp({
      credential: applicationDefault(),
      projectId: this.projectId
    });
    await getAuth(app).deleteUser(firebaseUid);
  }
}

export class NoopAuthAccountAdmin implements AuthAccountAdmin {
  async deleteUser(): Promise<void> {
    return;
  }
}
