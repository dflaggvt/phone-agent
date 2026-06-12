import "dotenv/config";
import { createFirestore, removeUndefinedDeep } from "../src/infrastructure/persistence/firestoreClient.js";

type Routing = Record<string, unknown>;

const apply = process.env.APPLY_ASSISTANT_NUMBER_MIGRATION === "true";
const firestore = createFirestore(process.env.FIRESTORE_DATABASE_ID);

const snapshot = await firestore.collection("userConfigs").get();
let candidates = 0;
let updated = 0;
let skipped = 0;
let batch = firestore.batch();
let batchSize = 0;

for (const doc of snapshot.docs) {
  const data = doc.data();
  const routing = record(data.phoneRouting);
  const migrated = migratedRouting(routing);
  if (!migrated) {
    skipped += 1;
    continue;
  }
  candidates += 1;
  if (!apply) {
    continue;
  }
  batch.update(doc.ref, removeUndefinedDeep({ phoneRouting: migrated }));
  batchSize += 1;
  updated += 1;
  if (batchSize >= 400) {
    await batch.commit();
    batch = firestore.batch();
    batchSize = 0;
  }
}

if (apply && batchSize > 0) {
  await batch.commit();
}

console.log(JSON.stringify({
  mode: apply ? "apply" : "dry_run",
  scanned: snapshot.size,
  candidates,
  updated,
  skipped
}, null, 2));

function migratedRouting(routing: Routing | undefined): Routing | undefined {
  if (!routing) {
    return undefined;
  }
  const legacyNumber = stringValue(routing.retellPhoneNumber);
  const assistantNumber = stringValue(routing.assistantPhoneNumber);
  if (!legacyNumber || assistantNumber) {
    return undefined;
  }
  return {
    ...routing,
    assistantPhoneNumber: legacyNumber,
    voiceAgentId: stringValue(routing.voiceAgentId) ?? stringValue(routing.retellAgentId),
    providerNumberType: providerNumberType(routing.providerNumberType) ?? providerNumberType(routing.retellNumberProvider),
    assistantNumberAssignedAt: routing.assistantNumberAssignedAt ?? routing.retellNumberAssignedAt,
    assistantNumberProvisioningStatus: "assigned"
  };
}

function record(value: unknown): Routing | undefined {
  return value && typeof value === "object" ? value as Routing : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function providerNumberType(value: unknown): "twilio" | "telnyx" | "custom" | undefined {
  return value === "twilio" || value === "telnyx" || value === "custom" ? value : undefined;
}
