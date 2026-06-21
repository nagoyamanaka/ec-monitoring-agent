import { Router } from "express";
import { CommandBus } from "../../../../../Contexts/Shared/domain/CommandBus.js";
import { QueryBus } from "../../../../../Contexts/Shared/domain/QueryBus.js";
import { AlertsGetController } from "../controllers/alerts/AlertsGetController.js";
import { AlertGetController } from "../controllers/alerts/AlertGetController.js";
import { AlertFeedbackPatchController } from "../controllers/alerts/AlertFeedbackPatchController.js";

export function registerAlertRoutes(router: Router, commandBus: CommandBus, queryBus: QueryBus): void {
  const alertsGetController = new AlertsGetController(queryBus);
  const alertGetController = new AlertGetController(queryBus);
  const alertFeedbackPatchController = new AlertFeedbackPatchController(commandBus);

  router.get("/alerts", alertsGetController.run.bind(alertsGetController));
  router.get("/alerts/:id", alertGetController.run.bind(alertGetController));
  router.patch("/alerts/:id/feedback", alertFeedbackPatchController.run.bind(alertFeedbackPatchController));
}
