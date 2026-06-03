import { randomUUID } from "node:crypto";
import type {
  Contact,
  ContactRepository,
  ContactSyncStatus,
  ContactSyncResult,
  SyncContactInput
} from "../../domain/contacts/contact.js";
import { normalizePhoneNumber } from "./contactNormalization.js";

export class InMemoryContactRepository implements ContactRepository {
  private readonly contacts = new Map<string, Contact>();
  private readonly phoneIndex = new Map<string, string>();

  async syncForUser(userId: string, contacts: SyncContactInput[], syncedAt = new Date()): Promise<ContactSyncResult> {
    for (const existing of [...this.contacts.values()]) {
      if (existing.userId === userId) {
        this.contacts.delete(existing.id);
      }
    }
    for (const key of [...this.phoneIndex.keys()]) {
      if (key.startsWith(`${userId}:`)) {
        this.phoneIndex.delete(key);
      }
    }

    let phoneNumberCount = 0;
    for (const input of contacts) {
      const phoneNumbers = normalizePhoneNumbers(input.phoneNumbers);
      if (!input.displayName.trim() || phoneNumbers.length === 0) {
        continue;
      }

      const contact: Contact = {
        id: randomUUID(),
        userId,
        source: input.source,
        sourceContactId: input.sourceContactId,
        displayName: input.displayName.trim(),
        phoneNumbers,
        createdAt: syncedAt,
        updatedAt: syncedAt,
        lastSyncedAt: syncedAt
      };

      this.contacts.set(contact.id, contact);
      for (const phoneNumber of contact.phoneNumbers) {
        this.phoneIndex.set(phoneIndexKey(userId, phoneNumber.number), contact.id);
        phoneNumberCount += 1;
      }
    }

    return { syncedCount: [...this.contacts.values()].filter((contact) => contact.userId === userId).length, phoneNumberCount, syncedAt };
  }

  async findByPhoneNumber(userId: string, phoneNumber: string): Promise<Contact | undefined> {
    const normalized = normalizePhoneNumber(phoneNumber);
    if (!normalized) {
      return undefined;
    }
    const id = this.phoneIndex.get(phoneIndexKey(userId, normalized));
    return id ? this.contacts.get(id) : undefined;
  }

  async countForUser(userId: string): Promise<number> {
    return [...this.contacts.values()].filter((contact) => contact.userId === userId).length;
  }

  async statusForUser(userId: string): Promise<ContactSyncStatus> {
    const contacts = [...this.contacts.values()].filter((contact) => contact.userId === userId);
    return {
      syncedCount: contacts.length,
      phoneNumberCount: contacts.reduce((count, contact) => count + contact.phoneNumbers.length, 0),
      lastSyncedAt: contacts.reduce<Date | undefined>((latest, contact) => {
        if (!latest || contact.lastSyncedAt.getTime() > latest.getTime()) {
          return contact.lastSyncedAt;
        }
        return latest;
      }, undefined)
    };
  }
}

function normalizePhoneNumbers(values: SyncContactInput["phoneNumbers"]) {
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

function phoneIndexKey(userId: string, phoneNumber: string): string {
  return `${userId}:${phoneNumber}`;
}
