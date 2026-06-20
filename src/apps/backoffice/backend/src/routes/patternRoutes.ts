import { Router } from "express";
import { CommandBus } from "../../../../../Contexts/Shared/domain/CommandBus.js";
import { QueryBus } from "../../../../../Contexts/Shared/domain/QueryBus.js";
import { PatternsGetController } from "../controllers/patterns/PatternsGetController.js";
import { PatternPromotePostController } from "../controllers/patterns/PatternPromotePostController.js";

export function registerPatternRoutes(router: Router, commandBus: CommandBus, queryBus: QueryBus): void {
  const patternsGetController = new PatternsGetController(queryBus);
  const patternPromotePostController = new PatternPromotePostController(commandBus);

  router.get("/patterns", patternsGetController.run.bind(patternsGetController));
  router.post("/patterns/:id/promote", patternPromotePostController.run.bind(patternPromotePostController));
}
