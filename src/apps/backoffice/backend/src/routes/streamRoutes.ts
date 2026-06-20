import { Router } from "express";
import { SSEAlertNotifier } from "../../../../../Contexts/Monitoring/AlertNotification/domain/SSEAlertNotifier.js";
import { AlertsStreamController } from "../controllers/stream/AlertsStreamController.js";

export function registerStreamRoutes(router: Router, sseNotifier: SSEAlertNotifier): void {
  const controller = new AlertsStreamController(sseNotifier);
  router.get("/alerts/stream", controller.run.bind(controller));
}
