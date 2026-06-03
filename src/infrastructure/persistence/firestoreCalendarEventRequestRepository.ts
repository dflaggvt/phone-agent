import { randomUUID } from "node:crypto";
import type { Firestore } from "@google-cloud/firestore";
import type {
  CalendarEventRequest,
  CalendarEventRequestRepository,
  CalendarEventRequestStatus,
  CreateCalendarEventRequestInput
} from "../../domain/calendar/calendarEventRequest.js";
import { firestoreDate, removeUndefinedDeep } from "./firestoreClient.js";

const COLLECTION = "calendarEventRequests";

export class FirestoreCalendarEventRequestRepository implements CalendarEventRequestRepository {
  constructor(private readonly firestore: Firestore) {}

  async create(input: CreateCalendarEventRequestInput): Promise<CalendarEventRequest> {
    const now = new Date();
    const request: CalendarEventRequest = {
      id: randomUUID(),
      userId: input.userId,
      action: input.action ?? "create",
      status: "pending",
      providerCallId: input.providerCallId,
      callerNumber: input.callerNumber,
      callerName: input.callerName,
      title: input.title,
      description: input.description,
      startTime: input.startTime,
      endTime: input.endTime,
      timeZone: input.timeZone,
      reason: input.reason,
      sourceEventRequestId: input.sourceEventRequestId,
      createdEventId: input.createdEventId,
      createdEventHtmlLink: input.createdEventHtmlLink,
      createdAt: now,
      expiresAt: new Date(now.getTime() + (input.timeoutMs ?? 60_000))
    };
    await this.collection().doc(request.id).set(removeUndefinedDeep(request));
    return request;
  }

  async get(id: string, userId: string): Promise<CalendarEventRequest | undefined> {
    await this.expirePending();
    const doc = await this.collection().doc(id).get();
    const request = doc.exists ? requestFromFirestore(doc.id, doc.data() ?? {}) : undefined;
    return request?.userId === userId ? request : undefined;
  }

  async listPending(userId: string, now = new Date()): Promise<CalendarEventRequest[]> {
    await this.expirePending(now);
    const snapshot = await this.collection()
      .where("userId", "==", userId)
      .where("status", "==", "pending")
      .limit(25)
      .get();
    return snapshot.docs
      .map((doc) => requestFromFirestore(doc.id, doc.data()))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async listRecent(userId: string, limit = 25): Promise<CalendarEventRequest[]> {
    await this.expirePending();
    const snapshot = await this.collection()
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();
    return snapshot.docs.map((doc) => requestFromFirestore(doc.id, doc.data()));
  }

  async listCreatedForCaller(userId: string, callerNumber?: string, limit = 10): Promise<CalendarEventRequest[]> {
    const recent = await this.listRecent(userId, 50);
    return recent
      .filter((request) => Boolean(request.createdEventId))
      .filter((request) => !callerNumber || request.callerNumber === callerNumber)
      .slice(0, limit);
  }

  async findCreatedByEventId(userId: string, eventId: string): Promise<CalendarEventRequest | undefined> {
    await this.expirePending();
    const snapshot = await this.collection()
      .where("userId", "==", userId)
      .where("createdEventId", "==", eventId)
      .limit(1)
      .get();
    const doc = snapshot.docs[0];
    return doc ? requestFromFirestore(doc.id, doc.data()) : undefined;
  }

  async accept(id: string, userId: string): Promise<CalendarEventRequest | undefined> {
    return this.decide(id, userId, "accepted");
  }

  async decline(id: string, userId: string): Promise<CalendarEventRequest | undefined> {
    return this.decide(id, userId, "declined");
  }

  async markCreated(id: string, event: { eventId?: string; htmlLink?: string }): Promise<CalendarEventRequest | undefined> {
    return this.updateStatus(id, { status: "created", createdEventId: event.eventId, createdEventHtmlLink: event.htmlLink, decidedAt: new Date() });
  }

  async markUpdated(id: string, event: { eventId?: string; htmlLink?: string }): Promise<CalendarEventRequest | undefined> {
    return this.updateStatus(id, { status: "updated", createdEventId: event.eventId, createdEventHtmlLink: event.htmlLink, decidedAt: new Date() });
  }

  async markFailed(id: string, errorMessage: string): Promise<CalendarEventRequest | undefined> {
    return this.updateStatus(id, { status: "failed", errorMessage, decidedAt: new Date() });
  }

  async expirePending(now = new Date()): Promise<void> {
    const pending = await this.collection().where("status", "==", "pending").limit(100).get();
    const batch = this.firestore.batch();
    let updateCount = 0;
    for (const doc of pending.docs) {
      const request = requestFromFirestore(doc.id, doc.data());
      if (request.expiresAt.getTime() <= now.getTime()) {
        batch.update(doc.ref, { status: "expired", decidedAt: now });
        updateCount += 1;
      }
    }
    if (updateCount > 0) {
      await batch.commit();
    }
  }

  private async decide(id: string, userId: string, status: Extract<CalendarEventRequestStatus, "accepted" | "declined">): Promise<CalendarEventRequest | undefined> {
    const docRef = this.collection().doc(id);
    return this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(docRef);
      if (!snapshot.exists) {
        return undefined;
      }
      const existing = requestFromFirestore(snapshot.id, snapshot.data() ?? {});
      if (existing.userId !== userId) {
        return undefined;
      }
      if (existing.status !== "pending") {
        return existing;
      }
      const updated = { ...existing, status, decidedAt: new Date() };
      transaction.set(docRef, removeUndefinedDeep(updated));
      return updated;
    });
  }

  private async updateStatus(id: string, input: Partial<CalendarEventRequest>): Promise<CalendarEventRequest | undefined> {
    const doc = await this.collection().doc(id).get();
    const existing = doc.exists ? requestFromFirestore(doc.id, doc.data() ?? {}) : undefined;
    if (!existing) {
      return undefined;
    }
    const updated = { ...existing, ...input };
    await this.collection().doc(id).set(removeUndefinedDeep(updated));
    return updated;
  }

  private collection() {
    return this.firestore.collection(COLLECTION);
  }
}

function requestFromFirestore(id: string, data: Record<string, unknown>): CalendarEventRequest {
  return {
    id: getString(data.id) ?? id,
    userId: getString(data.userId) ?? "",
    action: requestAction(data.action),
    status: requestStatus(data.status),
    providerCallId: getString(data.providerCallId),
    callerNumber: getString(data.callerNumber),
    callerName: getString(data.callerName),
    title: getString(data.title) ?? "Calendar event",
    description: getString(data.description),
    startTime: firestoreDate(data.startTime) ?? new Date(0),
    endTime: firestoreDate(data.endTime) ?? new Date(0),
    timeZone: getString(data.timeZone) ?? "America/New_York",
    reason: getString(data.reason),
    sourceEventRequestId: getString(data.sourceEventRequestId),
    createdEventId: getString(data.createdEventId),
    createdEventHtmlLink: getString(data.createdEventHtmlLink),
    errorMessage: getString(data.errorMessage),
    createdAt: firestoreDate(data.createdAt) ?? new Date(0),
    expiresAt: firestoreDate(data.expiresAt) ?? new Date(0),
    decidedAt: firestoreDate(data.decidedAt)
  };
}

function requestStatus(value: unknown): CalendarEventRequestStatus {
  return value === "accepted" || value === "declined" || value === "expired" || value === "created" || value === "updated" || value === "failed" ? value : "pending";
}

function requestAction(value: unknown) {
  return value === "update" ? "update" : "create";
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}
