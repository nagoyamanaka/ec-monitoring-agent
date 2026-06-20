import { Router } from "express";
import { CommandBus } from "../../../../../Contexts/Shared/domain/CommandBus.js";
import { QueryBus } from "../../../../../Contexts/Shared/domain/QueryBus.js";
import { SSEAlertNotifier } from "../../../../../Contexts/Monitoring/AlertNotification/domain/SSEAlertNotifier.js";

// TODO(task4-7): alertRoutes / patternRoutes / analyticsRoutes / streamRoutes / demoRoutes を登録する
export function registerRoutes(
  _router: Router,
  _commandBus: CommandBus,
  _queryBus: QueryBus,
  _sseNotifier: SSEAlertNotifier,
): void {}
