import { Router } from "express";
import { QueryBus } from "../../../../../Contexts/Shared/domain/QueryBus.js";
import { AlertEvidenceGetController } from "../controllers/alerts/AlertEvidenceGetController.js";

export function registerEvidenceRoutes(router: Router, queryBus: QueryBus): void {
  const controller = new AlertEvidenceGetController(queryBus);

  router.get("/alerts/:id/evidence", controller.evidence.bind(controller));
}
