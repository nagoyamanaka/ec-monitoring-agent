import { Router } from "express";
import { CommandBus } from "../../../../../Contexts/Shared/domain/CommandBus.js";
import { QueryBus } from "../../../../../Contexts/Shared/domain/QueryBus.js";
import { SSEAlertNotifier } from "../../../../../Contexts/Monitoring/AlertNotification/domain/SSEAlertNotifier.js";
import { registerAlertRoutes } from "./alertRoutes.js";
import { registerStreamRoutes } from "./streamRoutes.js";
import { registerPatternRoutes } from "./patternRoutes.js";
import { registerAnalyticsRoutes } from "./analyticsRoutes.js";
import { registerDemoRoutes } from "./demoRoutes.js";

export function registerRoutes(
  router: Router,
  commandBus: CommandBus,
  queryBus: QueryBus,
  sseNotifier: SSEAlertNotifier,
): void {
  registerAlertRoutes(router, commandBus, queryBus);
  registerStreamRoutes(router, sseNotifier);
  registerPatternRoutes(router, commandBus, queryBus);
  registerAnalyticsRoutes(router, queryBus);
  registerDemoRoutes(router, commandBus);
}
