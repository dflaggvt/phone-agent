import { Firestore } from "@google-cloud/firestore";

export function createFirestore(databaseId?: string): Firestore {
  return new Firestore({
    databaseId,
    ignoreUndefinedProperties: true
  });
}

export function removeUndefinedDeep<T>(value: T): T {
  if (value instanceof Date) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => removeUndefinedDeep(item)).filter((item) => item !== undefined) as T;
  }

  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (child !== undefined) {
        result[key] = removeUndefinedDeep(child);
      }
    }
    return result as T;
  }

  return value;
}

export function firestoreDate(value: unknown): Date | undefined {
  if (value instanceof Date) {
    return value;
  }

  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate() as Date;
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  return undefined;
}
