import type { Firestore } from "@google-cloud/firestore";
import type { CalendarConnection, CalendarConnectionRepository } from "../../domain/calendar/calendarConnection.js";
import { firestoreDate, removeUndefinedDeep } from "./firestoreClient.js";

const COLLECTION = "calendarConnections";
const DOC_ID = "primary";

export class FirestoreCalendarConnectionRepository implements CalendarConnectionRepository {
  constructor(private readonly firestore: Firestore) {}

  async get(): Promise<CalendarConnection | undefined> {
    const doc = await this.firestore.collection(COLLECTION).doc(DOC_ID).get();
    return doc.exists ? connectionFromFirestore(doc.data() ?? {}) : undefined;
  }

  async save(connection: CalendarConnection): Promise<CalendarConnection> {
    await this.firestore.collection(COLLECTION).doc(DOC_ID).set(removeUndefinedDeep(connection));
    return connection;
  }

  async disconnect(): Promise<CalendarConnection | undefined> {
    const existing = await this.get();
    if (!existing) {
      return undefined;
    }
    const updated = { ...existing, connected: false, refreshToken: undefined, updatedAt: new Date() };
    await this.save(updated);
    return updated;
  }
}

function connectionFromFirestore(data: Record<string, unknown>): CalendarConnection {
  return {
    id: "primary",
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
