import { Router } from "express";
import type { CallerMemoryRepository } from "../domain/callers/callerMemory.js";
import type { ContactRepository } from "../domain/contacts/contact.js";
import { notFound } from "../shared/httpErrors.js";
import { contactSyncSchema, updateCallerProfileSchema } from "./clientSchemas.js";
import { asyncHandler, currentUserId, requireRouteParam } from "./routeSupport.js";

export function contactRoutes(input: {
  callerMemory: CallerMemoryRepository;
  contacts: ContactRepository;
}) {
  const router = Router();

  router.get("/callers", asyncHandler(async (_req, res) => {
    const callers = await input.callerMemory.listProfiles(currentUserId(res));
    res.status(200).json({ callers });
  }));

  router.get("/contacts/status", asyncHandler(async (_req, res) => {
    const status = await input.contacts.statusForUser(currentUserId(res));
    res.status(200).json({ status });
  }));

  router.post("/contacts/sync", asyncHandler(async (req, res) => {
    const parsed = contactSyncSchema.parse(req.body);
    const result = await input.contacts.syncForUser(currentUserId(res), parsed.contacts);
    res.status(200).json({ result });
  }));

  router.delete("/contacts/sync", asyncHandler(async (_req, res) => {
    const status = await input.contacts.disconnectForUser(currentUserId(res));
    res.status(200).json({ status });
  }));

  router.get("/callers/:callerId", asyncHandler(async (req, res) => {
    const callerId = requireRouteParam(req.params.callerId, "callerId");
    const caller = await input.callerMemory.getProfile(currentUserId(res), callerId);
    if (!caller) {
      throw notFound("caller_not_found", "Caller profile was not found.");
    }
    res.status(200).json({ caller });
  }));

  router.patch("/callers/:callerId", asyncHandler(async (req, res) => {
    const callerId = requireRouteParam(req.params.callerId, "callerId");
    const parsed = updateCallerProfileSchema.parse(req.body);
    const caller = await input.callerMemory.updateProfile(currentUserId(res), callerId, parsed);
    if (!caller) {
      throw notFound("caller_not_found", "Caller profile was not found.");
    }
    res.status(200).json({ caller });
  }));

  return router;
}
