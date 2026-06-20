import { Router } from "express";
import { QueryBus } from "../../../../../Contexts/Shared/domain/QueryBus.js";
import { AnalyticsGetController } from "../controllers/analytics/AnalyticsGetController.js";

export function registerAnalyticsRoutes(router: Router, queryBus: QueryBus): void {
  const controller = new AnalyticsGetController(queryBus);
  router.get("/analytics", controller.run.bind(controller));
}
