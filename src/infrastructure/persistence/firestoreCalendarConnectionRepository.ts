import type { Firestore } from "@google-cloud/firestore";
import type { CalendarConnection, CalendarConnectionRepository } from "../../domain/calendar/calendarConnection.js";
import { firestoreDate, removeUndefinedDeep } from "./firestoreClient.js";

const COLLECTION = "calendarConnections";

export class FirestoreCalendarConnectionRepository implements CalendarConnectionRepository {
  constructor(private readonly firestore: Firestore) {}

  async get(userId: string): Promise<CalendarConnection | undefined> {
    const doc = await this.firestore.collection(COLLECTION).doc(userId).get();
    return doc.exists ? connectionFromFirestore(userId, doc.data() ?? {}) : undefined;
  }

  async save(connection: CalendarConnection): Promise<CalendarConnection> {
    await this.firestore.collection(COLLECTION).doc(connection.userId).set(removeUndefinedDeep(connection));
    return connection;
  }

  async disconnect(userId: string): Promise<CalendarConnection | undefined> {
    const existing = await this.get(userId);
    if (!existing) {
      return undefined;
    }
    const updated = { ...existing, connected: false, refreshToken: undefined, updatedAt: new Date() };
    await this.save(updated);
    return updated;
  }
}

function connectionFromFirestore(userId: string, data: Record<string, unknown>): CalendarConnection {
  return {
    id: getString(data.id) ?? userId,
    userId: getString(data.userId) ?? userId,
    provider: "google",
    connected: data.connected === true,
    refreshToken: getString(data.refreshToken),
    scopes: Array.isArray(data.scopes) ? data.scopes.filter(isString) : [],
    connectedEmail: getString(data.connectedEmail),
    createdAt: firestoreDate(data.createdAt) ?? new Date(0),
    updatedAt: firestoreDate(data.updatedAt) ?? new Date(0)
  };
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}
