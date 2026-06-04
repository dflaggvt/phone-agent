import { createWriteStream } from "node:fs";
import { dirname, resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { Firestore } from "@google-cloud/firestore";

const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || "phone-agent-43313";
const databaseId = process.env.FIRESTORE_DATABASE_ID;
const since = optionalDate(process.env.ANALYTICS_EXPORT_SINCE);
const until = optionalDate(process.env.ANALYTICS_EXPORT_UNTIL);
const outputPath = resolve(process.env.ANALYTICS_EXPORT_OUTPUT || `analytics-export-${new Date().toISOString().slice(0, 10)}.ndjson`);

const firestore = new Firestore({
  projectId,
  ...(databaseId ? { databaseId } : {})
});

let query = firestore.collection("productAnalyticsEvents").orderBy("receivedAt", "asc");
if (since) {
  query = query.where("receivedAt", ">=", since);
}
if (until) {
  query = query.where("receivedAt", "<", until);
}

await mkdir(dirname(outputPath), { recursive: true });
const stream = createWriteStream(outputPath, { encoding: "utf8" });
let exported = 0;

const snapshot = await query.get();
for (const doc of snapshot.docs) {
  const row = sanitizeAnalyticsRow(doc.id, doc.data());
  stream.write(`${JSON.stringify(row)}\n`);
  exported += 1;
}

await new Promise((resolveStream, rejectStream) => {
  stream.end(resolveStream);
  stream.on("error", rejectStream);
});

console.log(JSON.stringify({
  exportedAt: new Date().toISOString(),
  projectId,
  databaseId: databaseId || "(default)",
  since: since?.toISOString(),
  until: until?.toISOString(),
  outputPath,
  exported
}, null, 2));

function sanitizeAnalyticsRow(id, data) {
  return {
    id,
    userId: stringValue(data.userId),
    sessionId: stringValue(data.sessionId),
    eventName: stringValue(data.eventName),
    screen: stringValue(data.screen),
    surface: stringValue(data.surface),
    action: stringValue(data.action),
    result: stringValue(data.result),
    objectType: stringValue(data.objectType),
    objectId: stringValue(data.objectId),
    latencyMs: numberValue(data.latencyMs),
    sequence: numberValue(data.sequence),
    appVersion: stringValue(data.appVersion),
    buildType: stringValue(data.buildType),
    deviceClass: stringValue(data.deviceClass),
    osVersion: stringValue(data.osVersion),
    networkStatus: stringValue(data.networkStatus),
    attributes: safeAttributes(data.attributes),
    occurredAt: dateValue(data.occurredAt)?.toISOString(),
    receivedAt: dateValue(data.receivedAt)?.toISOString()
  };
}

function safeAttributes(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const safe = {};
  for (const [key, child] of Object.entries(value)) {
    if (isBlockedAttributeKey(key)) {
      continue;
    }
    if (typeof child === "string" || typeof child === "number" || typeof child === "boolean") {
      safe[key] = child;
    }
  }
  return safe;
}

function isBlockedAttributeKey(key) {
  return /transcript|summary|note|answer|query|contact|calendar|payment|secret|token|payload/i.test(key);
}

function optionalDate(value) {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }
  return date;
}

function dateValue(value) {
  if (!value) {
    return undefined;
  }
  if (value instanceof Date) {
    return value;
  }
  if (typeof value.toDate === "function") {
    return value.toDate();
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function stringValue(value) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberValue(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
