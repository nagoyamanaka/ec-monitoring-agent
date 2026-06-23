import { Router } from "express";
import { CommandBus } from "../../../../../Contexts/Shared/domain/CommandBus.js";
import { QueryBus } from "../../../../../Contexts/Shared/domain/QueryBus.js";
import { RemediationDraftPrPostController } from "../controllers/remediation/RemediationDraftPrPostController.js";
import { RemediationGetController } from "../controllers/remediation/RemediationGetController.js";

export function registerRemediationRoutes(
  router: Router,
  commandBus: CommandBus,
  queryBus: QueryBus,
): void {
  const draftPrController = new RemediationDraftPrPostController(commandBus);
  const getController = new RemediationGetController(queryBus);

  router.post(
    "/alerts/:id/remediation/draft-pr",
    draftPrController.run.bind(draftPrController),
  );
  router.get(
    "/alerts/:id/remediation",
    getController.run.bind(getController),
  );
}
