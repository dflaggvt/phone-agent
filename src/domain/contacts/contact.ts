export interface ContactPhoneNumber {
  number: string;
  label?: string;
}

export interface Contact {
  id: string;
  userId: string;
  source: "android_contacts";
  sourceContactId: string;
  displayName: string;
  phoneNumbers: ContactPhoneNumber[];
  createdAt: Date;
  updatedAt: Date;
  lastSyncedAt: Date;
}

export interface SyncContactInput {
  source: "android_contacts";
  sourceContactId: string;
  displayName: string;
  phoneNumbers: ContactPhoneNumber[];
}

export interface ContactSyncResult {
  syncedCount: number;
  phoneNumberCount: number;
  syncedAt: Date;
}

export interface ContactSyncStatus {
  syncedCount: number;
  phoneNumberCount: number;
  lastSyncedAt?: Date;
}

export interface ContactRepository {
  syncForUser(userId: string, contacts: SyncContactInput[], syncedAt?: Date): Promise<ContactSyncResult>;
  findByPhoneNumber(userId: string, phoneNumber: string): Promise<Contact | undefined>;
  countForUser(userId: string): Promise<number>;
  statusForUser(userId: string): Promise<ContactSyncStatus>;
}
