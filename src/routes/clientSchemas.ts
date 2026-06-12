import { z } from "zod";

export const spendingLimitUpdateSchema = z.object({
  monthlySpendingCapCents: z.number().int().min(500).max(100000)
});

const analyticsAttributeValueSchema = z.union([z.string().max(200), z.number().finite(), z.boolean()]);

const analyticsEventSchema = z.object({
  sessionId: z.string().min(8).max(120),
  eventName: z.string().min(1).max(120).regex(/^[a-z0-9_.-]+$/),
  screen: z.string().min(1).max(120).optional(),
  surface: z.string().min(1).max(120).optional(),
  action: z.string().min(1).max(120).optional(),
  result: z.string().min(1).max(120).optional(),
  objectType: z.string().min(1).max(80).optional(),
  objectId: z.string().min(1).max(200).optional(),
  latencyMs: z.number().int().nonnegative().max(120_000).optional(),
  sequence: z.number().int().nonnegative().max(10_000_000).optional(),
  appVersion: z.string().min(1).max(80).optional(),
  buildType: z.string().min(1).max(40).optional(),
  deviceClass: z.string().min(1).max(120).optional(),
  osVersion: z.string().min(1).max(80).optional(),
  networkStatus: z.string().min(1).max(80).optional(),
  attributes: z.record(analyticsAttributeValueSchema).optional(),
  occurredAt: z.string().datetime({ offset: true }).optional().transform((value) => value ? new Date(value) : undefined)
});

export const analyticsEventsSchema = z.object({
  events: z.array(analyticsEventSchema).min(1).max(100)
});

export const updateCallerProfileSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  organization: z.string().min(1).max(200).optional(),
  relationship: z
    .enum(["unknown", "family", "close_friend", "coworker", "vendor", "healthcare", "school", "spam", "blocked"])
    .optional(),
  trustLevel: z.enum(["unknown", "trusted", "standard", "low", "blocked"]).optional()
});

const contactPhoneNumberSchema = z.object({
  number: z.string().min(3).max(40),
  label: z.string().min(1).max(80).optional()
});

export const contactSyncSchema = z.object({
  contacts: z.array(z.object({
    source: z.literal("android_contacts").default("android_contacts"),
    sourceContactId: z.string().min(1).max(200),
    displayName: z.string().min(1).max(200),
    phoneNumbers: z.array(contactPhoneNumberSchema).min(1).max(20)
  })).max(10000)
});

const phoneRoutingUpdateSchema = z.object({
  primaryPhoneNumber: z.string().min(3).max(40).optional(),
  transferPhoneNumber: z.string().min(3).max(40).optional()
});

const assistantRatingSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);

export const assistantProfileUpdateSchema = z.object({
  assistantName: z.string().min(1).max(80).optional(),
  greetingStyle: z.enum(["concise", "warm", "formal", "protective"]).optional(),
  disclosureStyle: z.enum(["standard", "explicit"]).optional(),
  warmth: assistantRatingSchema.optional(),
  brevity: assistantRatingSchema.optional(),
  proactivity: assistantRatingSchema.optional(),
  unknownCallerPolicy: z.enum(["screen", "message_only", "ring_me"]).optional(),
  trustedCallerPolicy: z.enum(["can_interrupt", "ask_first", "message_only"]).optional(),
  transferPolicy: z.enum(["approval_required", "trusted_can_transfer", "never_transfer"]).optional(),
  calendarPolicy: z.enum(["free_busy_only", "create_events", "disabled"]).optional(),
  topicMemoryPolicy: z.enum(["use_relevant_threads", "ask_before_using", "disabled"]).optional()
});

export const assistantNumberAssignmentSchema = z.object({
  areaCode: z.number().int().min(200).max(999).optional()
}).strict();

export const userConfigUpdateSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  phoneRouting: phoneRoutingUpdateSchema.optional(),
  billing: z
    .object({
      plan: z.string().min(1).max(100).optional(),
      monthlyIncludedMinutes: z.number().int().nonnegative().optional(),
      monthlyClassificationLimit: z.number().int().nonnegative().optional()
    })
    .optional()
});

export const pushTokenRegistrationSchema = z.object({
  token: z.string().min(20).max(4096),
  platform: z.literal("android"),
  deviceId: z.string().min(1).max(200).optional(),
  appVersion: z.string().min(1).max(80).optional()
});

export const topicCreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000).optional(),
  participantIds: z.array(z.string().min(1).max(200)).max(50).optional()
});

export const topicAttachCommunicationSchema = z.object({
  communicationItemId: z.string().min(1).max(200),
  confidence: z.number().min(0).max(1).optional(),
  reason: z.string().min(1).max(500).optional()
});

export const decisionCreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000).optional(),
  requiredApproverParticipantIds: z.array(z.string().min(1).max(200)).max(20).optional(),
  dueAt: z.string().datetime({ offset: true }).optional().transform((value) => value ? new Date(value) : undefined),
  sourceCommunicationItemIds: z.array(z.string().min(1).max(200)).max(20).optional()
});

export const openQuestionCreateSchema = z.object({
  question: z.string().min(1).max(500),
  ownerParticipantId: z.string().min(1).max(200).optional(),
  dueAt: z.string().datetime({ offset: true }).optional().transform((value) => value ? new Date(value) : undefined),
  sourceCommunicationItemIds: z.array(z.string().min(1).max(200)).max(20).optional()
});

export const topicTaskCreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000).optional(),
  assigneeParticipantId: z.string().min(1).max(200).optional(),
  dueAt: z.string().datetime({ offset: true }).optional().transform((value) => value ? new Date(value) : undefined),
  sourceCommunicationItemIds: z.array(z.string().min(1).max(200)).max(20).optional()
});

const optionalDate = z
  .string()
  .datetime()
  .optional()
  .transform((value) => (value ? new Date(value) : undefined));

export const agentNoteCreateSchema = z.object({
  text: z.string().min(1).max(2000),
  title: z.string().min(1).max(200).optional(),
  targetPhoneNumber: z.string().min(3).max(40).optional(),
  targetCallerName: z.string().min(1).max(200).optional(),
  topic: z.string().min(1).max(200).optional(),
  oneTime: z.boolean().optional(),
  expiresAt: optionalDate
});

export const agentNoteUpdateSchema = z.object({
  text: z.string().min(1).max(2000).optional(),
  title: z.string().min(1).max(200).optional(),
  targetPhoneNumber: z.string().min(3).max(40).optional(),
  targetCallerName: z.string().min(1).max(200).optional(),
  topic: z.string().min(1).max(200).optional(),
  oneTime: z.boolean().optional(),
  status: z.enum(["active", "archived"]).optional(),
  expiresAt: z
    .union([z.string().datetime().transform((value) => new Date(value)), z.null()])
    .optional()
});

export const answerRequestReplySchema = z.object({
  answer: z.string().min(1).max(2000)
});
