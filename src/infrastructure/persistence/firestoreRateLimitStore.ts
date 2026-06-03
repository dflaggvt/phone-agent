import { createHash } from "node:crypto";
import type { Firestore } from "@google-cloud/firestore";
import type { RateLimitBucket, RateLimitStore } from "../../shared/rateLimit.js";
import { firestoreDate, removeUndefinedDeep } from "./firestoreClient.js";

const COLLECTION = "rateLimitBuckets";

export class FirestoreRateLimitStore implements RateLimitStore {
  constructor(private readonly firestore: Firestore) {}

  async increment(key: string, windowMs: number, now: number): Promise<RateLimitBucket> {
    const ref = this.firestore.collection(COLLECTION).doc(documentId(key));
    return this.firestore.runTransaction(async (transaction) => {
      const doc = await transaction.get(ref);
      const existing = doc.exists ? bucketFromFirestore(doc.data() ?? {}) : undefined;
      const next = existing && existing.resetAt > now
        ? { count: existing.count + 1, resetAt: existing.resetAt }
        : { count: 1, resetAt: now + windowMs };
      transaction.set(ref, removeUndefinedDeep({
        key,
        count: next.count,
        resetAt: new Date(next.resetAt),
        expiresAt: new Date(next.resetAt),
        updatedAt: new Date(now)
      }));
      return next;
    });
  }
}

function documentId(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

function bucketFromFirestore(data: Record<string, unknown>): RateLimitBucket {
  return {
    count: typeof data.count === "number" ? data.count : 0,
    resetAt: firestoreDate(data.resetAt)?.getTime() ?? 0
  };
}
