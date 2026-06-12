import "dotenv/config";
import { createHash } from "node:crypto";
import { createFirestore, removeUndefinedDeep } from "../src/infrastructure/persistence/firestoreClient.js";

const REVIEWER_USER_ID = process.env.PLAY_REVIEWER_USER_ID ?? "firebase_l3SzW1VY3wNvC7WofZx3S0qPGKS2";
const REVIEWER_FIREBASE_UID = process.env.PLAY_REVIEWER_FIREBASE_UID ?? "l3SzW1VY3wNvC7WofZx3S0qPGKS2";
const REVIEWER_EMAIL = process.env.PLAY_REVIEWER_EMAIL ?? "play-reviewer@callheld.app";
const REVIEWER_DISPLAY_NAME = process.env.PLAY_REVIEWER_DISPLAY_NAME ?? "Play Reviewer";
const REVIEWER_PROTECTED_NUMBER = process.env.PLAY_REVIEWER_PROTECTED_NUMBER ?? "+15550109999";
const REVIEWER_ASSISTANT_NUMBER = process.env.PLAY_REVIEWER_ASSISTANT_NUMBER ?? "+15550108888";
const REVIEWER_TRANSFER_NUMBER = process.env.PLAY_REVIEWER_TRANSFER_NUMBER ?? REVIEWER_PROTECTED_NUMBER;

const firestore = createFirestore(process.env.FIRESTORE_DATABASE_ID);

type TopicSeed = {
  id: string;
  title: string;
  description: string;
  communicationIds: string[];
  decisions?: Array<{ id: string; title: string; description: string; status: "pending" | "made"; selectedOptionId?: string }>;
  openQuestions?: Array<{ id: string; question: string }>;
  tasks?: Array<{ id: string; title: string; description: string; dueInDays: number }>;
  suggestedNextActions?: string[];
};

type CommunicationSeed = {
  id: string;
  channel: "phone_call" | "email" | "manual_note" | "calendar_event";
  direction: "inbound" | "outbound" | "internal";
  sourceProvider: string;
  providerItemId: string;
  senderName: string;
  senderPhone?: string;
  senderEmail?: string;
  occurredAt: Date;
  summary: string;
  bodyText?: string;
  transcriptText?: string;
  facts?: string[];
  tasks?: string[];
  decisions?: Array<{ title: string; status: "made" | "pending"; selectedOption?: string }>;
  questions?: string[];
  topicId: string;
  confidence: number;
};

type CallSeed = {
  id: string;
  providerCallId: string;
  fromNumber: string;
  toNumber: string;
  callerName: string;
  startedAt: Date;
  endedAt: Date;
  intent: string;
  urgency: "low" | "normal" | "high";
  followUp: string;
  summary: string;
  transcript: string;
};

const now = new Date();

const topicIds = {
  homeRepair: "play_demo_topic_home_repair",
  familySchedule: "play_demo_topic_family_schedule",
  workFollowUps: "play_demo_topic_work_followups"
} as const;

const communications: CommunicationSeed[] = [
  {
    id: "play_demo_comm_contractor_estimate",
    channel: "phone_call",
    direction: "inbound",
    sourceProvider: "play_review_demo",
    providerItemId: "play_demo_call_contractor_estimate",
    senderName: "Greg Mason",
    senderPhone: "+15550102001",
    occurredAt: daysAgo(1, 10, 24),
    summary: "Greg called about the basement plumbing change. He said the revised line needs approval by Friday and the estimate should include labor and permit fees.",
    transcriptText: "Greg: I wanted to confirm the plumbing change order before Friday. Assistant: Does the estimate include labor and permits? Greg: Yes, I will send the written version this afternoon.",
    facts: [
      "Basement plumbing change needs approval by Friday.",
      "Greg said labor and permit fees are included in the revised estimate."
    ],
    tasks: ["Review Greg's written estimate when it arrives."],
    decisions: [{ title: "Approve basement plumbing change", status: "pending" }],
    questions: ["Does the revised estimate match the architect's latest drawing?"],
    topicId: topicIds.homeRepair,
    confidence: 0.96
  },
  {
    id: "play_demo_comm_architect_email",
    channel: "email",
    direction: "inbound",
    sourceProvider: "play_review_demo",
    providerItemId: "play_demo_email_architect_permits",
    senderName: "Maya Chen",
    senderEmail: "maya@example.test",
    occurredAt: daysAgo(2, 14, 10),
    summary: "Maya sent updated basement drawings and noted that the permit revision may be required if the plumbing line moves more than twelve inches.",
    bodyText: "Attached are the updated drawings. If the plumbing line moves more than twelve inches, the inspector may require a permit revision.",
    facts: ["Permit revision may be required if the plumbing line moves more than twelve inches."],
    questions: ["How far is the plumbing line moving in Greg's revised plan?"],
    topicId: topicIds.homeRepair,
    confidence: 0.92
  },
  {
    id: "play_demo_comm_theresa_schedule",
    channel: "phone_call",
    direction: "inbound",
    sourceProvider: "play_review_demo",
    providerItemId: "play_demo_call_theresa_schedule",
    senderName: "Theresa",
    senderPhone: "+15550102002",
    occurredAt: daysAgo(0, 8, 42),
    summary: "Theresa called to coordinate tonight's schedule. She asked whether you can pick up dinner after practice and wanted the assistant to remember that Wednesday pickups are usually yours.",
    transcriptText: "Theresa: Can you ask him if he can pick up dinner after practice? Assistant: I can pass that along and note the Wednesday pickup pattern.",
    facts: ["Wednesday practice pickup is usually assigned to the user."],
    tasks: ["Confirm dinner pickup after practice."],
    questions: ["Should the assistant remind the user at 5:15 PM on practice days?"],
    topicId: topicIds.familySchedule,
    confidence: 0.94
  },
  {
    id: "play_demo_comm_recruiter_call",
    channel: "phone_call",
    direction: "inbound",
    sourceProvider: "play_review_demo",
    providerItemId: "play_demo_call_recruiter_followup",
    senderName: "Nina Patel",
    senderPhone: "+15550102003",
    occurredAt: daysAgo(3, 16, 5),
    summary: "Nina called about scheduling a follow-up interview. The assistant captured two time windows and noted that compensation details should be clarified before the next conversation.",
    transcriptText: "Nina: We would like to schedule the next conversation. Assistant: What windows should I pass along? Nina: Tuesday morning or Thursday afternoon.",
    facts: ["Nina offered Tuesday morning or Thursday afternoon for a follow-up interview."],
    tasks: ["Choose interview availability and reply to Nina."],
    questions: ["Should compensation range be clarified before the next interview?"],
    topicId: topicIds.workFollowUps,
    confidence: 0.9
  }
];

const topics: TopicSeed[] = [
  {
    id: topicIds.homeRepair,
    title: "Home Repair",
    description: "Basement renovation calls, estimates, permit questions, contractor follow-ups, and decisions.",
    communicationIds: ["play_demo_comm_contractor_estimate", "play_demo_comm_architect_email"],
    decisions: [{
      id: "play_demo_decision_plumbing_change",
      title: "Approve basement plumbing change",
      description: "Greg says the change keeps the project on schedule, but the estimate should be checked against the architect's note.",
      status: "pending"
    }],
    openQuestions: [{
      id: "play_demo_question_plumbing_distance",
      question: "Does the plumbing line move more than twelve inches and require a permit revision?"
    }],
    tasks: [{
      id: "play_demo_task_review_estimate",
      title: "Review written estimate",
      description: "Confirm labor, permit fees, and schedule impact before approving the change.",
      dueInDays: 2
    }],
    suggestedNextActions: ["Ask Greg to send the written change order.", "Compare the estimate against Maya's permit note."]
  },
  {
    id: topicIds.familySchedule,
    title: "Family Schedule",
    description: "Practice pickups, dinner plans, appointments, reminders, and household coordination.",
    communicationIds: ["play_demo_comm_theresa_schedule"],
    tasks: [{
      id: "play_demo_task_dinner_pickup",
      title: "Confirm dinner pickup",
      description: "Theresa asked whether dinner can be picked up after practice.",
      dueInDays: 0
    }],
    suggestedNextActions: ["Reply to Theresa about dinner pickup.", "Create a recurring reminder for Wednesday practice days."]
  },
  {
    id: topicIds.workFollowUps,
    title: "Work Follow-Ups",
    description: "Recruiting calls, interview scheduling, pending replies, and work-related decisions.",
    communicationIds: ["play_demo_comm_recruiter_call"],
    openQuestions: [{
      id: "play_demo_question_comp_range",
      question: "Should compensation range be clarified before the next interview?"
    }],
    tasks: [{
      id: "play_demo_task_reply_nina",
      title: "Reply with interview availability",
      description: "Nina offered Tuesday morning or Thursday afternoon.",
      dueInDays: 1
    }],
    suggestedNextActions: ["Choose a time window for Nina.", "Ask for compensation range before confirming."]
  }
];

const calls: CallSeed[] = [
  {
    id: "play_demo_session_theresa_schedule",
    providerCallId: "play_demo_call_theresa_schedule",
    fromNumber: "+15550102002",
    toNumber: REVIEWER_ASSISTANT_NUMBER,
    callerName: "Theresa",
    startedAt: daysAgo(0, 8, 42),
    endedAt: daysAgo(0, 8, 47),
    intent: "Coordinate tonight's schedule and dinner pickup after practice.",
    urgency: "normal",
    followUp: "Confirm whether dinner pickup after practice works.",
    summary: "Theresa asked whether you can pick up dinner after practice and wanted the assistant to remember the usual Wednesday pickup pattern.",
    transcript: "Assistant: Hi Theresa, this is Addison. Daryl cannot answer right now, but I can help. Theresa: Can you ask him if he can pick up dinner after practice? Assistant: I will pass that along and note the Wednesday pickup pattern."
  },
  {
    id: "play_demo_session_contractor_estimate",
    providerCallId: "play_demo_call_contractor_estimate",
    fromNumber: "+15550102001",
    toNumber: REVIEWER_ASSISTANT_NUMBER,
    callerName: "Greg Mason",
    startedAt: daysAgo(1, 10, 24),
    endedAt: daysAgo(1, 10, 31),
    intent: "Request approval for basement plumbing change order.",
    urgency: "high",
    followUp: "Review the written change order by Friday.",
    summary: "Greg requested approval for the basement plumbing change and said he will send a written estimate including labor and permit fees.",
    transcript: "Assistant: Hi Greg, Addison here. What can I help Daryl with? Greg: I need approval on the plumbing change before Friday. Assistant: Does the estimate include labor and permit fees? Greg: Yes, I will send the written version this afternoon."
  },
  {
    id: "play_demo_session_recruiter_followup",
    providerCallId: "play_demo_call_recruiter_followup",
    fromNumber: "+15550102003",
    toNumber: REVIEWER_ASSISTANT_NUMBER,
    callerName: "Nina Patel",
    startedAt: daysAgo(3, 16, 5),
    endedAt: daysAgo(3, 16, 12),
    intent: "Schedule a follow-up interview.",
    urgency: "low",
    followUp: "Choose Tuesday morning or Thursday afternoon for the next interview.",
    summary: "Nina called to schedule a follow-up interview and offered Tuesday morning or Thursday afternoon.",
    transcript: "Assistant: Daryl is unavailable, but I can take the details. Nina: We would like to schedule the next conversation. Tuesday morning or Thursday afternoon would work."
  }
];

async function main() {
  const batch = firestore.batch();

  set(batch, "userConfigs", REVIEWER_USER_ID, reviewerUserConfig());
  set(batch, "billingAccounts", REVIEWER_USER_ID, reviewerBillingAccount());

  for (const topic of topics) {
    set(batch, "topicThreads", topic.id, topicDocument(topic));
  }

  for (const communication of communications) {
    set(batch, "communicationItems", communication.id, communicationDocument(communication));
  }

  for (const call of calls) {
    set(batch, "callSessions", call.id, callDocument(call));
  }

  set(batch, "topicSuggestions", "play_demo_suggestion_family_schedule", topicSuggestionDocument());
  set(batch, "answerRequests", "play_demo_answer_theresa_dinner", answerRequestDocument());
  set(batch, "agentNotes", "play_demo_note_theresa_eta", agentNoteDocument());

  await batch.commit();
  await seedContactSync();

  console.log(`Seeded Play reviewer demo data for ${REVIEWER_USER_ID}.`);
  console.log(`Topics: ${topics.length}; communications: ${communications.length}; calls: ${calls.length}; answer requests: 1; notes: 1.`);
}

function reviewerUserConfig() {
  return {
    userId: REVIEWER_USER_ID,
    accountStatus: "active",
    displayName: REVIEWER_DISPLAY_NAME,
    auth: {
      firebaseUid: REVIEWER_FIREBASE_UID,
      email: REVIEWER_EMAIL,
      phoneNumber: REVIEWER_PROTECTED_NUMBER,
      primaryPhoneVerifiedAt: daysAgo(12, 9, 0)
    },
    assistantProfile: {
      assistantName: "Addison",
      greetingStyle: "warm",
      disclosureStyle: "standard",
      warmth: 4,
      brevity: 3,
      proactivity: 4,
      unknownCallerPolicy: "screen",
      trustedCallerPolicy: "can_interrupt",
      transferPolicy: "approval_required",
      calendarPolicy: "create_events",
      topicMemoryPolicy: "use_relevant_threads",
      profileVersion: 1
    },
    phoneRouting: {
      primaryPhoneNumber: REVIEWER_PROTECTED_NUMBER,
      assistantPhoneNumber: REVIEWER_ASSISTANT_NUMBER,
      voiceAgentId: "play_review_demo_agent",
      providerNumberType: "custom",
      assistantNumberAssignedAt: daysAgo(12, 9, 2),
      assistantNumberProvisioningStatus: "assigned",
      forwardingInstructionsViewedAt: daysAgo(11, 11, 20),
      transferPhoneNumber: REVIEWER_TRANSFER_NUMBER
    },
    billing: {
      plan: "play_review_demo",
      monthlyIncludedMinutes: 50,
      monthlyClassificationLimit: 1000,
      assistantNumberProvisioningAllowed: false
    },
    onboarding: {
      accountCreatedAt: daysAgo(12, 9, 0),
      assistantProfileConfiguredAt: daysAgo(12, 9, 5),
      forwardingConfiguredAt: daysAgo(11, 11, 20),
      firstTestCallAt: daysAgo(3, 16, 5),
      firstUsefulHandledCallAt: daysAgo(1, 10, 31)
    },
    createdAt: daysAgo(12, 9, 0),
    updatedAt: now
  };
}

function reviewerBillingAccount() {
  return {
    userId: REVIEWER_USER_ID,
    provider: "stripe",
    providerCustomerId: "cus_play_review_demo",
    providerSubscriptionId: "sub_play_review_demo",
    providerSubscriptionStatus: "active",
    status: "active",
    currency: "usd",
    monthlySpendingCapCents: 4000,
    currentPeriodSpendCents: 835,
    paymentMethod: {
      provider: "stripe",
      providerPaymentMethodId: "pm_play_review_demo",
      brand: "visa",
      last4: "4242",
      expMonth: 12,
      expYear: 2030,
      updatedAt: daysAgo(12, 9, 8)
    },
    createdAt: daysAgo(12, 9, 8),
    updatedAt: now
  };
}

function topicDocument(topic: TopicSeed) {
  return {
    id: topic.id,
    userId: REVIEWER_USER_ID,
    title: topic.title,
    description: topic.description,
    status: "active",
    participants: [],
    communicationItemIds: topic.communicationIds,
    decisions: (topic.decisions ?? []).map((decision) => ({
      id: decision.id,
      topicThreadId: topic.id,
      title: decision.title,
      description: decision.description,
      status: decision.status,
      options: [],
      selectedOptionId: decision.selectedOptionId,
      requiredApproverParticipantIds: [],
      sourceCommunicationItemIds: topic.communicationIds,
      createdAt: daysAgo(1, 10, 32),
      updatedAt: now
    })),
    openQuestions: (topic.openQuestions ?? []).map((question) => ({
      id: question.id,
      topicThreadId: topic.id,
      question: question.question,
      status: "open",
      sourceCommunicationItemIds: topic.communicationIds,
      createdAt: daysAgo(1, 10, 33),
      updatedAt: now
    })),
    tasks: (topic.tasks ?? []).map((task) => ({
      id: task.id,
      topicThreadId: topic.id,
      title: task.title,
      description: task.description,
      status: "open",
      dueAt: addDays(now, task.dueInDays),
      sourceCommunicationItemIds: topic.communicationIds,
      createdAt: daysAgo(1, 10, 34),
      updatedAt: now
    })),
    documents: [],
    conflicts: [],
    suggestedNextActions: topic.suggestedNextActions ?? [],
    createdAt: daysAgo(12, 9, 30),
    updatedAt: now
  };
}

function communicationDocument(input: CommunicationSeed) {
  return {
    id: input.id,
    userId: REVIEWER_USER_ID,
    channel: input.channel,
    direction: input.direction,
    sourceProvider: input.sourceProvider,
    providerItemId: input.providerItemId,
    sender: {
      displayName: input.senderName,
      phoneNumber: input.senderPhone,
      email: input.senderEmail
    },
    recipients: [{ displayName: REVIEWER_DISPLAY_NAME, phoneNumber: REVIEWER_PROTECTED_NUMBER }],
    participants: [
      { displayName: input.senderName, phoneNumber: input.senderPhone, email: input.senderEmail },
      { displayName: REVIEWER_DISPLAY_NAME, phoneNumber: REVIEWER_PROTECTED_NUMBER }
    ],
    occurredAt: input.occurredAt,
    receivedAt: input.occurredAt,
    rawContentRef: {
      storageProvider: "inline",
      contentType: input.channel === "email" ? "text/plain" : "text/transcript"
    },
    bodyText: input.bodyText,
    transcriptText: input.transcriptText,
    summary: input.summary,
    extractedFacts: (input.facts ?? []).map((text) => ({ text, confidence: 0.91, sourceCommunicationItemId: input.id })),
    extractedTasks: (input.tasks ?? []).map((title) => ({ title, confidence: 0.89 })),
    extractedDecisions: (input.decisions ?? []).map((decision) => ({ ...decision, confidence: 0.88 })),
    extractedOpenQuestions: (input.questions ?? []).map((question) => ({ question, confidence: 0.86 })),
    topicAssociations: [{
      topicThreadId: input.topicId,
      confidence: input.confidence,
      mode: "auto",
      reason: "Seeded demo communication for Google Play review.",
      attachedAt: input.occurredAt
    }],
    sensitivity: "normal",
    consentRequired: input.channel === "phone_call",
    retentionPolicyId: "default",
    createdAt: input.occurredAt,
    updatedAt: now
  };
}

function callDocument(input: CallSeed) {
  return {
    id: input.id,
    provider: "retell",
    providerCallId: input.providerCallId,
    direction: "inbound",
    status: "completed",
    fromNumber: input.fromNumber,
    toNumber: input.toNumber,
    agentId: "play_review_demo_agent",
    urgency: input.urgency,
    intent: input.intent,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    transcript: input.transcript,
    transcriptSegments: [
      { speaker: "assistant", text: input.transcript.split(". ")[0] ?? input.transcript, startMs: 0, endMs: 9000 },
      { speaker: "caller", text: input.intent, startMs: 9000, endMs: 18000 }
    ],
    summary: {
      text: input.summary,
      successful: true,
      sentiment: "neutral",
      structuredData: {
        custom_analysis_data: {
          caller_name: input.callerName,
          caller_intent: input.intent,
          urgency: input.urgency,
          requested_follow_up: input.followUp,
          call_summary: input.summary
        }
      }
    },
    metadata: {
      seededFor: "play_review",
      callerName: input.callerName
    },
    createdAt: input.startedAt,
    updatedAt: input.endedAt
  };
}

function topicSuggestionDocument() {
  return {
    id: "play_demo_suggestion_family_schedule",
    userId: REVIEWER_USER_ID,
    communicationItemId: "play_demo_comm_theresa_schedule",
    targetType: "existing_topic",
    suggestedTopicThreadId: topicIds.familySchedule,
    suggestedTitle: "Family Schedule",
    suggestedDescription: "Theresa's call appears related to recurring family logistics.",
    confidence: 0.95,
    reason: "Theresa mentioned dinner pickup and practice, which matches the Family Schedule topic.",
    evidence: ["Caller is Theresa.", "Call mentions practice pickup and dinner logistics."],
    status: "pending",
    createdAt: daysAgo(0, 8, 50),
    updatedAt: daysAgo(0, 8, 50)
  };
}

function answerRequestDocument() {
  return {
    id: "play_demo_answer_theresa_dinner",
    userId: REVIEWER_USER_ID,
    type: "live_answer",
    status: "pending",
    providerCallId: "play_demo_call_theresa_schedule",
    callerNumber: "+15550102002",
    callerName: "Theresa",
    question: "Theresa is asking if you can pick up dinner after practice tonight. What should Addison tell her?",
    reason: "The caller is a trusted contact and needs a specific answer while the assistant is handling the call.",
    urgency: "normal",
    createdAt: now,
    expiresAt: addDays(now, 7)
  };
}

function agentNoteDocument() {
  return {
    id: "play_demo_note_theresa_eta",
    userId: REVIEWER_USER_ID,
    status: "active",
    title: "Dinner pickup answer",
    text: "If Theresa calls about dinner, tell her I can pick it up after practice and should be home around 6:30.",
    targetPhoneNumber: "+15550102002",
    targetCallerName: "Theresa",
    topic: "Family Schedule",
    oneTime: false,
    createdAt: daysAgo(0, 8, 30),
    updatedAt: now,
    expiresAt: addDays(now, 14)
  };
}

async function seedContactSync() {
  const syncedAt = now;
  const contacts = [
    { sourceContactId: "play_demo_contact_theresa", displayName: "Theresa", number: "+15550102002", label: "mobile" },
    { sourceContactId: "play_demo_contact_greg", displayName: "Greg Mason", number: "+15550102001", label: "work" },
    { sourceContactId: "play_demo_contact_nina", displayName: "Nina Patel", number: "+15550102003", label: "work" }
  ];
  const batch = firestore.batch();
  for (const contact of contacts) {
    const id = contactId(REVIEWER_USER_ID, "android_contacts", contact.sourceContactId);
    batch.set(firestore.collection("contacts").doc(id), removeUndefinedDeep({
      id,
      userId: REVIEWER_USER_ID,
      source: "android_contacts",
      sourceContactId: contact.sourceContactId,
      displayName: contact.displayName,
      phoneNumbers: [{ number: contact.number, label: contact.label }],
      phoneNumbersRaw: [contact.number],
      createdAt: syncedAt,
      updatedAt: syncedAt,
      lastSyncedAt: syncedAt
    }), { merge: true });
    batch.set(firestore.collection("contactPhoneIndex").doc(phoneIndexId(REVIEWER_USER_ID, contact.number)), {
      userId: REVIEWER_USER_ID,
      phoneNumber: contact.number,
      contactId: id,
      updatedAt: syncedAt
    }, { merge: true });
  }
  batch.set(firestore.collection("contactSyncStatus").doc(REVIEWER_USER_ID), {
    userId: REVIEWER_USER_ID,
    syncedCount: contacts.length,
    phoneNumberCount: contacts.length,
    lastSyncedAt: syncedAt,
    updatedAt: syncedAt
  }, { merge: true });
  await batch.commit();
}

function set(batch: FirebaseFirestore.WriteBatch, collection: string, id: string, value: Record<string, unknown>) {
  batch.set(firestore.collection(collection).doc(id), removeUndefinedDeep(value), { merge: true });
}

function daysAgo(days: number, hour: number, minute: number) {
  const date = new Date(now);
  date.setDate(date.getDate() - days);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function contactId(userId: string, source: string, sourceContactId: string): string {
  return `contact_${createHash("sha256").update(`${userId}:${source}:${sourceContactId}`).digest("base64url").slice(0, 32)}`;
}

function phoneIndexId(userId: string, phoneNumber: string): string {
  return `contact_phone_${createHash("sha256").update(`${userId}:${phoneNumber}`).digest("base64url").slice(0, 32)}`;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
