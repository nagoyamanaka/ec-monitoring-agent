import { Router } from "express";
import { CommandBus } from "../../../../../Contexts/Shared/domain/CommandBus.js";
import { QueryBus } from "../../../../../Contexts/Shared/domain/QueryBus.js";

// TODO(task7): GET /patterns・POST /patterns/:id/promote コントローラを実装する
export function registerPatternRoutes(
  _router: Router,
  _commandBus: CommandBus,
  _queryBus: QueryBus,
): void {}
