import { createHash } from "node:crypto";
import type { Firestore } from "@google-cloud/firestore";
import type {
  Contact,
  ContactPhoneNumber,
  ContactRepository,
  ContactSyncResult,
  SyncContactInput
} from "../../domain/contacts/contact.js";
import { firestoreDate, removeUndefinedDeep } from "./firestoreClient.js";
import { normalizePhoneNumber } from "./contactNormalization.js";

const COLLECTION = "contacts";
const INDEX_COLLECTION = "contactPhoneIndex";

export class FirestoreContactRepository implements ContactRepository {
  constructor(private readonly firestore: Firestore) {}

  async syncForUser(userId: string, contacts: SyncContactInput[], syncedAt = new Date()): Promise<ContactSyncResult> {
    const existing = await this.collection().where("userId", "==", userId).get();
    const existingIndex = await this.indexCollection().where("userId", "==", userId).get();
    let batch = this.firestore.batch();
    let operations = 0;
    const commitIfNeeded = async () => {
      if (operations >= 450) {
        await batch.commit();
        batch = this.firestore.batch();
        operations = 0;
      }
    };
    for (const doc of existing.docs) {
      batch.delete(doc.ref);
      operations += 1;
      await commitIfNeeded();
    }
    for (const doc of existingIndex.docs) {
      batch.delete(doc.ref);
      operations += 1;
      await commitIfNeeded();
    }

    let syncedCount = 0;
    let phoneNumberCount = 0;
    for (const input of contacts) {
      const phoneNumbers = normalizePhoneNumbers(input.phoneNumbers);
      if (!input.displayName.trim() || phoneNumbers.length === 0) {
        continue;
      }

      const id = contactId(userId, input.source, input.sourceContactId);
      const contact: Contact = {
        id,
        userId,
        source: input.source,
        sourceContactId: input.sourceContactId,
        displayName: input.displayName.trim(),
        phoneNumbers,
        createdAt: syncedAt,
        updatedAt: syncedAt,
        lastSyncedAt: syncedAt
      };
      batch.set(this.collection().doc(id), removeUndefinedDeep({
        ...contact,
        phoneNumbersRaw: phoneNumbers.map((phoneNumber) => phoneNumber.number)
      }));
      operations += 1;
      await commitIfNeeded();
      for (const phoneNumber of phoneNumbers) {
        batch.set(this.indexCollection().doc(phoneIndexId(userId, phoneNumber.number)), {
          userId,
          phoneNumber: phoneNumber.number,
          contactId: id,
          updatedAt: syncedAt
        });
        operations += 1;
        await commitIfNeeded();
      }
      syncedCount += 1;
      phoneNumberCount += phoneNumbers.length;
    }

    if (operations > 0) {
      await batch.commit();
    }
    return { syncedCount, phoneNumberCount, syncedAt };
  }

  async findByPhoneNumber(userId: string, phoneNumber: string): Promise<Contact | undefined> {
    const normalized = normalizePhoneNumber(phoneNumber);
    if (!normalized) {
      return undefined;
    }
    const index = await this.indexCollection().doc(phoneIndexId(userId, normalized)).get();
    const contactIdValue = index.exists ? getString(index.data()?.contactId) : undefined;
    if (!contactIdValue) {
      return undefined;
    }
    const contact = await this.collection().doc(contactIdValue).get();
    return contact.exists ? contactFromFirestore(contact.id, contact.data() ?? {}) : undefined;
  }

  async countForUser(userId: string): Promise<number> {
    const snapshot = await this.collection().where("userId", "==", userId).get();
    return snapshot.size;
  }

  private collection() {
    return this.firestore.collection(COLLECTION);
  }

  private indexCollection() {
    return this.firestore.collection(INDEX_COLLECTION);
  }
}

function normalizePhoneNumbers(values: SyncContactInput["phoneNumbers"]): ContactPhoneNumber[] {
  const seen = new Set<string>();
  return values
    .map((phoneNumber) => ({
      number: normalizePhoneNumber(phoneNumber.number),
      label: phoneNumber.label?.trim() || undefined
    }))
    .filter((phoneNumber) => {
      if (!phoneNumber.number || seen.has(phoneNumber.number)) {
        return false;
      }
      seen.add(phoneNumber.number);
      return true;
    });
}

function contactFromFirestore(id: string, data: Record<string, unknown>): Contact {
  return {
    id: getString(data.id) ?? id,
    userId: getString(data.userId) ?? "",
    source: "android_contacts",
    sourceContactId: getString(data.sourceContactId) ?? "",
    displayName: getString(data.displayName) ?? "",
    phoneNumbers: Array.isArray(data.phoneNumbers) ? data.phoneNumbers.map(phoneNumberFromFirestore).filter(isContactPhoneNumber) : [],
    createdAt: firestoreDate(data.createdAt) ?? new Date(0),
    updatedAt: firestoreDate(data.updatedAt) ?? new Date(0),
    lastSyncedAt: firestoreDate(data.lastSyncedAt) ?? new Date(0)
  };
}

function phoneNumberFromFirestore(value: unknown): ContactPhoneNumber | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const number = getString(record.number);
  if (!number) {
    return undefined;
  }
  return { number, label: getString(record.label) };
}

function isContactPhoneNumber(value: ContactPhoneNumber | undefined): value is ContactPhoneNumber {
  return value !== undefined;
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function contactId(userId: string, source: string, sourceContactId: string): string {
  return `contact_${createHash("sha256").update(`${userId}:${source}:${sourceContactId}`).digest("base64url").slice(0, 32)}`;
}

function phoneIndexId(userId: string, phoneNumber: string): string {
  return `contact_phone_${createHash("sha256").update(`${userId}:${phoneNumber}`).digest("base64url").slice(0, 32)}`;
}
