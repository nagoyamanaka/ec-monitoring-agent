import { Router } from "express";
import { CommandBus } from "../../../../../Contexts/Shared/domain/CommandBus.js";

// TODO(task7): POST /demo/** コントローラを実装する（DEMO_ENABLED で本番無効化）
export function registerDemoRoutes(
  _router: Router,
  _commandBus: CommandBus,
): void {}
