import { Router } from "express";
import { CommandBus } from "../../../../../Contexts/Shared/domain/CommandBus.js";
import { QueryBus } from "../../../../../Contexts/Shared/domain/QueryBus.js";
import { AlertsGetController } from "../controllers/alerts/AlertsGetController.js";
import { AlertGetController } from "../controllers/alerts/AlertGetController.js";
import { AlertFeedbackPatchController } from "../controllers/alerts/AlertFeedbackPatchController.js";
import { AlertReinvestigatePostController } from "../controllers/alerts/AlertReinvestigatePostController.js";
import { AlertReportPostController } from "../controllers/alerts/AlertReportPostController.js";
import { AlertPromotePostController } from "../controllers/alerts/AlertPromotePostController.js";

export function registerAlertRoutes(router: Router, commandBus: CommandBus, queryBus: QueryBus): void {
  const alertsGetController = new AlertsGetController(queryBus);
  const alertGetController = new AlertGetController(queryBus);
  const alertFeedbackPatchController = new AlertFeedbackPatchController(commandBus);
  const alertReinvestigatePostController = new AlertReinvestigatePostController(commandBus);
  const alertReportPostController = new AlertReportPostController(commandBus);
  const alertPromotePostController = new AlertPromotePostController(commandBus);

  router.get("/alerts", alertsGetController.run.bind(alertsGetController));
  router.get("/alerts/:id", alertGetController.run.bind(alertGetController));
  router.patch("/alerts/:id/feedback", alertFeedbackPatchController.run.bind(alertFeedbackPatchController));
  router.post("/alerts/:id/reinvestigate", alertReinvestigatePostController.run.bind(alertReinvestigatePostController));
  // 既知一致はAI自動起動しないので、今回paramで報告が要るときの明示要求（オンデマンド調査）。
  router.post("/alerts/:id/report", alertReportPostController.run.bind(alertReportPostController));
  // 手動即時昇格（この Alert を回数不問で既知パターンへ結晶化）。
  router.post("/alerts/:id/promote", alertPromotePostController.run.bind(alertPromotePostController));
}
