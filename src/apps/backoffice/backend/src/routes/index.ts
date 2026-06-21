import { Router } from "express";
import { CommandBus } from "../../../../../Contexts/Shared/domain/CommandBus.js";
import { QueryBus } from "../../../../../Contexts/Shared/domain/QueryBus.js";
import { SSEAlertNotifier } from "../../../../../Contexts/Monitoring/AlertNotification/domain/SSEAlertNotifier.js";
import { DemoDependencies } from "../demo/DemoDependencies.js";
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
  demoDeps: DemoDependencies,
): void {
  // /alerts/stream を /alerts/:id より先に登録する（後者が "stream" を id として捕捉するのを防ぐ）
  registerStreamRoutes(router, sseNotifier);
  registerAlertRoutes(router, commandBus, queryBus);
  registerPatternRoutes(router, commandBus, queryBus);
  registerAnalyticsRoutes(router, queryBus);
  registerDemoRoutes(router, queryBus, demoDeps);
}
