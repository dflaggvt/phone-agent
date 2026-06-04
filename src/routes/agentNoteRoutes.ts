import { Router } from "express";
import type { AgentNoteService } from "../application/agentNotes/agentNoteService.js";
import { notFound } from "../shared/httpErrors.js";
import { agentNoteCreateSchema, agentNoteUpdateSchema } from "./clientSchemas.js";
import { asyncHandler, currentUserId, requireRouteParam } from "./routeSupport.js";

export function agentNoteRoutes(input: {
  agentNotes: AgentNoteService;
}) {
  const router = Router();

  router.get("/agent-notes", asyncHandler(async (_req, res) => {
    const notes = await input.agentNotes.list(currentUserId(res));
    res.status(200).json({ notes });
  }));

  router.post("/agent-notes", asyncHandler(async (req, res) => {
    const parsed = agentNoteCreateSchema.parse(req.body);
    const note = await input.agentNotes.create({ userId: currentUserId(res), ...parsed });
    res.status(201).json({ note });
  }));

  router.patch("/agent-notes/:noteId", asyncHandler(async (req, res) => {
    const noteId = requireRouteParam(req.params.noteId, "noteId");
    const parsed = agentNoteUpdateSchema.parse(req.body);
    const note = await input.agentNotes.update(noteId, currentUserId(res), parsed);
    if (!note) {
      throw notFound("agent_note_not_found", "Agent note was not found.");
    }
    res.status(200).json({ note });
  }));

  router.delete("/agent-notes/:noteId", asyncHandler(async (req, res) => {
    const noteId = requireRouteParam(req.params.noteId, "noteId");
    const note = await input.agentNotes.archive(noteId, currentUserId(res));
    if (!note) {
      throw notFound("agent_note_not_found", "Agent note was not found.");
    }
    res.status(200).json({ note });
  }));

  return router;
}
