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
