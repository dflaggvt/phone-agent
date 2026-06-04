import { Router } from "express";
import type { CommunicationItemRepository } from "../domain/communications/communicationItem.js";
import { notFound } from "../shared/httpErrors.js";
import { asyncHandler, currentUserId, requireRouteParam } from "./routeSupport.js";

export function communicationRoutes(input: {
  communicationItems: CommunicationItemRepository;
}) {
  const router = Router();

  router.get("/communications", asyncHandler(async (_req, res) => {
    const items = await input.communicationItems.listRecentForUser(currentUserId(res));
    res.status(200).json({ communicationItems: items });
  }));

  router.get("/communications/:communicationItemId", asyncHandler(async (req, res) => {
    const communicationItemId = requireRouteParam(req.params.communicationItemId, "communicationItemId");
    const item = await input.communicationItems.get(communicationItemId);
    if (!item || item.userId !== currentUserId(res)) {
      throw notFound("communication_item_not_found", "Communication item was not found.");
    }
    res.status(200).json({ communicationItem: item });
  }));

  return router;
}
